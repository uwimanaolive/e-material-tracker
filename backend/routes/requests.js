import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';
import {
  analyzeRequestItems,
  initialRequestStatus,
  STATUS_AFTER_OWNER_APPROVAL,
} from '../src/utils/workflow.js';
import {
  deptAssignRequest,
  inventoryConfirmRequest,
  getAvailableAssetsForItem,
  releaseAllRequestAssignments,
} from '../src/utils/fulfillment.js';
import { enrichRows, enrichWithStatusDisplay } from '../src/utils/statusLabels.js';

const RETURN_NOTE_FIELDS = `
  , (SELECT rt.notes FROM request_timeline rt
     WHERE rt.request_id = ar.id
       AND (rt.action ILIKE '%returned%' OR rt.action ILIKE '%Recall%' OR rt.action ILIKE '%Resubmit requested%' OR rt.action ILIKE '%Rejected with comment%')
     ORDER BY rt.created_at DESC LIMIT 1) as return_notes
  , (SELECT rt.action FROM request_timeline rt
     WHERE rt.request_id = ar.id
       AND (rt.action ILIKE '%returned%' OR rt.action ILIKE '%Recall%' OR rt.action ILIKE '%Resubmit requested%' OR rt.action ILIKE '%Rejected with comment%')
     ORDER BY rt.created_at DESC LIMIT 1) as return_action
`;

const REQUEST_LIST_FIELDS = `
  , d.name as reporter_department_name,
  (SELECT od.name FROM asset_request_items ari
   JOIN asset_categories ac ON ari.category_id = ac.id
   JOIN departments od ON ac.specialist_department_id = od.id
   LEFT JOIN asset_request_owner_approvals oa ON oa.request_id = ar.id AND oa.owner_department_id = od.id
   WHERE ari.request_id = ar.id AND oa.id IS NULL
   LIMIT 1) as owner_department_name
`;

const router = express.Router();

const generateRequestNumber = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    "SELECT COUNT(*) FROM asset_requests WHERE request_number LIKE $1",
    [`REQ-${year}-%`]
  );
  return `REQ-${year}-${String(parseInt(result.rows[0].count) + 1).padStart(6, '0')}`;
};

const addTimelineEntry = async (client, requestId, userId, role, action, notes) => {
  await client.query(
    'INSERT INTO request_timeline (request_id, actor_id, actor_role, action, notes) VALUES ($1, $2, $3, $4, $5)',
    [requestId, userId, role, action, notes]
  );
};

const getUserDeptId = async (userId) => {
  const r = await pool.query('SELECT department_id FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.department_id;
};

const hasProcurementApproval = async (client, requestId) => {
  const result = await client.query(
    `SELECT 1 FROM request_timeline
     WHERE request_id = $1 AND action = 'Procurement approved — returned to store assignment'
     LIMIT 1`,
    [requestId]
  );
  return result.rows.length > 0;
};

const enrichRequest = async (request) => {
  const items = await pool.query(
    `SELECT ari.*, ac.name as category_name, ac.specialist_department_id as owner_department_id,
            od.name as owner_department_name
     FROM asset_request_items ari
     LEFT JOIN asset_categories ac ON ari.category_id = ac.id
     LEFT JOIN departments od ON ac.specialist_department_id = od.id
     WHERE ari.request_id = $1`,
    [request.id]
  );
  const timeline = await pool.query(
    `SELECT rt.*, u.name as actor_name FROM request_timeline rt
     LEFT JOIN users u ON rt.actor_id = u.id
     WHERE rt.request_id = $1 ORDER BY rt.created_at ASC`,
    [request.id]
  );
  const assignee = request.assigned_to
    ? await pool.query('SELECT name FROM users WHERE id = $1', [request.assigned_to])
    : { rows: [] };
  request.items = items.rows;
  for (const item of request.items) {
    const assets = await pool.query(
      `SELECT a.id, a.name, a.serial_number, a.condition, u.name as assigned_to_name
       FROM assets a
       JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.status = 'active'
       LEFT JOIN users u ON aa.assigned_to = u.id
       WHERE aa.request_item_id = $1`,
      [item.id]
    );
    item.assigned_assets = assets.rows;
  }
  request.timeline = timeline.rows;
  request.assignee_name = assignee.rows[0]?.name || null;
  request.reporter_department_name = request.department_name;
  const lastReturn = [...timeline.rows].reverse().find((entry) =>
    /recall|resubmit|returned|reject/i.test(entry.action || '')
  );
  request.return_notes = request.status === 'returned' ? (lastReturn?.notes || null) : null;
  request.return_action = request.status === 'returned' ? (lastReturn?.action || null) : null;
  const ownerDept = await pool.query(
    `SELECT od.name FROM asset_request_items ari
     JOIN asset_categories ac ON ari.category_id = ac.id
     JOIN departments od ON ac.specialist_department_id = od.id
     LEFT JOIN asset_request_owner_approvals oa ON oa.request_id = $1 AND oa.owner_department_id = od.id
     WHERE ari.request_id = $1 AND oa.id IS NULL LIMIT 1`,
    [request.id]
  );
  request.owner_department_name = ownerDept.rows[0]?.name || null;
  return enrichWithStatusDisplay(request);
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, department } = req.query;
    let role = req.user.role === 'specialist' ? 'head' : req.user.role;
    if (role === 'procurement') role = 'inventory';
    let query = `
      SELECT ar.*, u.name as requester_name, d.name as department_name,
        ae.name as assignee_name, COUNT(ari.id) as item_count
        ${REQUEST_LIST_FIELDS}
      FROM asset_requests ar
      LEFT JOIN users u ON ar.requested_by = u.id
      LEFT JOIN users ae ON ar.assigned_to = ae.id
      LEFT JOIN departments d ON ar.department_id = d.id
      LEFT JOIN asset_request_items ari ON ar.id = ari.request_id
      WHERE 1=1
    `;
    const params = [];
    let n = 0;

    if (role === 'head') {
      const deptId = await getUserDeptId(req.user.id);
      n++;
      query += ` AND (ar.department_id = $${n} OR EXISTS (
        SELECT 1 FROM asset_request_items ari2
        JOIN asset_categories ac ON ari2.category_id = ac.id
        WHERE ari2.request_id = ar.id AND ac.specialist_department_id = $${n}
      ))`;
      params.push(deptId);
    } else if (role === 'employee') {
      n++;
      query += ` AND ar.assigned_to = $${n}`;
      params.push(req.user.id);
    } else if (role !== 'inventory' && role !== 'hr' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (status) { n++; query += ` AND ar.status = $${n}`; params.push(status); }
    if (department) { n++; query += ` AND d.name = $${n}`; params.push(department); }
    query += ' GROUP BY ar.id, u.name, d.name, ae.name ORDER BY ar.created_at DESC';
    res.json(enrichRows((await pool.query(query, params)).rows));
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.requested_by = $1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/returned', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const deptId = await getUserDeptId(req.user.id);
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
        ${RETURN_NOTE_FIELDS}
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.department_id = $1 AND ar.status = 'returned'
       ORDER BY ar.updated_at DESC`,
      [deptId]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.get('/assigned-to-me', authenticateToken, authorizeRoles('employee'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.assigned_to = $1
       ORDER BY ar.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/owner/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const deptId = await getUserDeptId(req.user.id);
    const result = await pool.query(
      `SELECT DISTINCT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       JOIN asset_request_items ari ON ar.id = ari.request_id
       JOIN asset_categories ac ON ari.category_id = ac.id
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.status = 'pending_owner_dept'
         AND ac.specialist_department_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM asset_request_owner_approvals oa
           WHERE oa.request_id = ar.id AND oa.owner_department_id = $1
         )
       ORDER BY ar.created_at DESC`,
      [deptId]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dept-assignment/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const deptId = await getUserDeptId(req.user.id);
    const result = await pool.query(
      `SELECT DISTINCT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       JOIN asset_request_items ari ON ar.id = ari.request_id
       JOIN asset_categories ac ON ari.category_id = ac.id
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ac.specialist_department_id = $1
         AND ar.status IN ('pending_dept_assignment', 'pending_inventory', 'pending_procurement')
       ORDER BY ar.created_at DESC`,
      [deptId]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/owner/tracking', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const deptId = await getUserDeptId(req.user.id);
    const result = await pool.query(
      `SELECT DISTINCT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       JOIN asset_request_owner_approvals oa ON ar.id = oa.request_id
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE oa.owner_department_id = $1
         AND ar.status IN ('pending_dept_assignment', 'pending_inventory', 'fulfilled', 'partially_fulfilled', 'rejected')
       ORDER BY ar.updated_at DESC LIMIT 50`,
      [deptId]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        COUNT(ari.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       LEFT JOIN asset_request_items ari ON ar.id = ari.request_id
       WHERE ar.status IN ('pending_inventory', 'pending_procurement')
       GROUP BY ar.id, u.name, d.name, ae.name ORDER BY ar.created_at DESC`
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory/history', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
        (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count
        ${REQUEST_LIST_FIELDS}
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users ae ON ar.assigned_to = ae.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.status IN ('fulfilled', 'partially_fulfilled', 'rejected')
       ORDER BY ar.updated_at DESC LIMIT 50`
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy procurement paths → inventory
router.get('/procurement/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  req.url = '/inventory/pending';
  const result = await pool.query(
    `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
      COUNT(ari.id) as item_count ${REQUEST_LIST_FIELDS}
     FROM asset_requests ar
     LEFT JOIN users u ON ar.requested_by = u.id
     LEFT JOIN users ae ON ar.assigned_to = ae.id
     LEFT JOIN departments d ON ar.department_id = d.id
     LEFT JOIN asset_request_items ari ON ar.id = ari.request_id
     WHERE ar.status IN ('pending_inventory', 'pending_procurement')
     GROUP BY ar.id, u.name, d.name, ae.name ORDER BY ar.created_at DESC`
  );
  res.json(enrichRows(result.rows));
});
router.get('/procurement/history', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const result = await pool.query(
    `SELECT ar.*, u.name as requester_name, d.name as department_name, ae.name as assignee_name,
      (SELECT COUNT(*) FROM asset_request_items WHERE request_id = ar.id) as item_count ${REQUEST_LIST_FIELDS}
     FROM asset_requests ar
     LEFT JOIN users u ON ar.requested_by = u.id
     LEFT JOIN users ae ON ar.assigned_to = ae.id
     LEFT JOIN departments d ON ar.department_id = d.id
     WHERE ar.status IN ('fulfilled', 'partially_fulfilled', 'rejected')
     ORDER BY ar.updated_at DESC LIMIT 50`
  );
  res.json(enrichRows(result.rows));
});

router.get('/:id/available-assets', authenticateToken, authorizeRoles('head', 'inventory'), async (req, res) => {
  const client = await pool.connect();
  try {
    const reqRow = await client.query('SELECT department_id FROM asset_requests WHERE id = $1', [req.params.id]);
    if (!reqRow.rows.length) return res.status(404).json({ error: 'Request not found' });
    const headDeptId = req.user.role === 'head' ? await getUserDeptId(req.user.id) : null;
    const items = await client.query(
      `SELECT ari.id, ari.category_id, ari.quantity, ari.fulfilled_quantity, ac.specialist_department_id
       FROM asset_request_items ari
       JOIN asset_categories ac ON ari.category_id = ac.id
       WHERE ari.request_id = $1`,
      [req.params.id]
    );
    const result = {};
    for (const item of items.rows) {
      if (headDeptId && item.specialist_department_id !== headDeptId) {
        continue;
      }
      result[item.id] = await getAvailableAssetsForItem(
        client,
        item.category_id,
        reqRow.rows[0].department_id,
        headDeptId,
        { requestId: parseInt(req.params.id, 10), requestItemId: item.id }
      );
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as requester_name, d.name as department_name
       FROM asset_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN departments d ON ar.department_id = d.id
       WHERE ar.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });
    res.json(await enrichRequest(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { department, justification, urgency, items, assigned_to } = req.body;
    if (!assigned_to) throw new Error('Please select an employee to assign equipment to');
    if (!items?.length) throw new Error('At least one item is required');

    const deptResult = await client.query('SELECT id FROM departments WHERE name = $1', [department]);
    if (!deptResult.rows.length) throw new Error('Invalid department');
    const requesterDeptId = deptResult.rows[0].id;

    const assignee = await client.query(
      'SELECT id FROM users WHERE id = $1 AND department_id = $2 AND is_active = true',
      [assigned_to, requesterDeptId]
    );
    if (!assignee.rows.length) throw new Error('Assignee must be an active employee in your department');

    const requestNumber = await generateRequestNumber();
    const { needsOwnerApproval } = await analyzeRequestItems(client, requesterDeptId, items);
    const status = initialRequestStatus(needsOwnerApproval);

    const requestResult = await client.query(
      `INSERT INTO asset_requests (request_number, requested_by, department_id, assigned_to, justification, urgency, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [requestNumber, req.user.id, requesterDeptId, assigned_to, justification, urgency, status]
    );
    const requestId = requestResult.rows[0].id;

    for (const item of items) {
      const cat = await client.query(
        'SELECT id FROM asset_categories WHERE name = $1',
        [item.category]
      );

      if (!cat.rows.length) {
        throw new Error(`Category "${item.category}" not found`);
      }

      await client.query(
        `INSERT INTO asset_request_items
        (request_id, category_id, quantity, specifications)
        VALUES ($1, $2, $3, $4)`,
        [
          requestId,
          cat.rows[0].id,
          item.quantity,
          item.specifications || ''
        ]
      );
    }


    const assigneeName = await client.query(
      'SELECT name FROM users WHERE id = $1',
      [assigned_to]
    );


    await addTimelineEntry(
      client,
      requestId,
      req.user.id,
      req.user.role,
      needsOwnerApproval
        ? `Request submitted for ${assigneeName.rows[0].name} — awaiting owning department approval`
        : `Request submitted for ${assigneeName.rows[0].name} — awaiting department store assignment`,
      justification
    );


    await client.query('COMMIT');

    res.status(201).json({
      ...requestResult.rows[0],
      status
    });


  } catch (error) {

    await client.query('ROLLBACK');

    res.status(500).json({
      error: error.message || 'Server error'
    });


  } finally {

    client.release();

  }
});

const replaceRequestItems = async (client, requestId, items) => {
  if (!items?.length) throw new Error('At least one item is required');
  await client.query(
    `UPDATE asset_assignments
     SET request_item_id = NULL
     WHERE request_item_id IN (SELECT id FROM asset_request_items WHERE request_id = $1)`,
    [requestId]
  );
  await client.query('DELETE FROM asset_request_items WHERE request_id = $1', [requestId]);
  for (const item of items) {
    const cat = await client.query('SELECT id FROM asset_categories WHERE name = $1', [item.category]);
    if (!cat.rows.length) throw new Error(`Category "${item.category}" not found`);
    await client.query(
      `INSERT INTO asset_request_items (request_id, category_id, quantity, specifications)
       VALUES ($1, $2, $3, $4)`,
      [requestId, cat.rows[0].id, item.quantity, item.specifications || '']
    );
  }
};

router.put('/:id/edit', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { assigned_to, justification, urgency, items } = req.body;
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];

    const headDeptId = await getUserDeptId(req.user.id);
    if (request.department_id !== headDeptId) {
      throw new Error('Only the requesting department can edit this request');
    }

    const assignmentCount = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM asset_assignments WHERE request_id = $1 AND status = 'active'`,
      [req.params.id]
    );
    const hasAssignments = assignmentCount.rows[0].cnt > 0;
    const editableStatuses = ['pending_owner_dept', 'pending_dept_assignment', 'returned'];
    if (!editableStatuses.includes(request.status)) {
      throw new Error('This request can no longer be edited');
    }
    if (request.status === 'pending_dept_assignment' && await hasProcurementApproval(client, req.params.id)) {
      throw new Error('This request can no longer be edited after Procurement approval');
    }
    if (request.status === 'pending_dept_assignment' && hasAssignments) {
      throw new Error('Assets are already assigned — recall the request first, then edit and resubmit');
    }
    if (request.status === 'pending_owner_dept' && hasAssignments) {
      throw new Error('This request already has assigned assets');
    }

    if (!assigned_to) throw new Error('Please select an employee to assign equipment to');
    if (!justification?.trim()) throw new Error('Justification is required');
    if (!items?.length) throw new Error('At least one item is required');

    const assignee = await client.query(
      'SELECT id FROM users WHERE id = $1 AND department_id = $2 AND is_active = true',
      [assigned_to, request.department_id]
    );
    if (!assignee.rows.length) throw new Error('Assignee must be an active employee in your department');

    await client.query(
      `UPDATE asset_requests
       SET assigned_to = $1, justification = $2, urgency = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [assigned_to, justification, urgency || request.urgency, req.params.id]
    );

    await replaceRequestItems(client, req.params.id, items);
    await client.query('DELETE FROM asset_request_owner_approvals WHERE request_id = $1', [req.params.id]);

    const { needsOwnerApproval } = await analyzeRequestItems(client, request.department_id, items);
    const nextStatus = initialRequestStatus(needsOwnerApproval);
    await client.query(
      `UPDATE asset_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [nextStatus, req.params.id]
    );

    const isResubmit = request.status === 'returned';
    await addTimelineEntry(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      isResubmit ? 'Request edited and resubmitted' : 'Request edited before approval',
      justification
    );

    await client.query('COMMIT');
    res.json({
      message: isResubmit ? 'Request resubmitted' : 'Request updated',
      status: nextStatus,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/return-to-requester', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (action === 'reject' && !notes?.trim()) throw new Error('Comment is required');
    const allowed = ['return', 'reject'];
    if (!allowed.includes(action)) throw new Error('Invalid action');

    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];

    const returnable = ['pending_owner_dept', 'pending_dept_assignment', 'pending_inventory', 'pending_procurement'];
    if (!returnable.includes(request.status)) {
      throw new Error('Request is not awaiting your review');
    }

    const headDeptId = await getUserDeptId(req.user.id);
    const ownsItems = await client.query(
      `SELECT 1 FROM asset_request_items ari
       JOIN asset_categories ac ON ari.category_id = ac.id
       WHERE ari.request_id = $1 AND ac.specialist_department_id = $2 LIMIT 1`,
      [req.params.id, headDeptId]
    );
    if (!ownsItems.rows.length) {
      throw new Error('Your department does not own equipment in this request');
    }

    await releaseAllRequestAssignments(client, req.params.id, req.user.id, notes);
    await client.query('DELETE FROM asset_request_owner_approvals WHERE request_id = $1', [req.params.id]);

    const nextStatus = action === 'reject' ? 'rejected' : 'returned';
    await client.query(
      `UPDATE asset_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [nextStatus, req.params.id]
    );

    const actionLabel = action === 'reject'
      ? 'Rejected with comment'
      : 'Returned with comment — requester may edit and resubmit';

    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, actionLabel, notes);
    await client.query('COMMIT');
    res.json({ message: actionLabel, status: nextStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/recall', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];

    const headDeptId = await getUserDeptId(req.user.id);
    if (request.department_id !== headDeptId) {
      throw new Error('Only the requesting department can recall this request');
    }

    const recallable = ['pending_owner_dept', 'pending_dept_assignment', 'pending_inventory', 'pending_procurement'];
    if (!recallable.includes(request.status)) {
      throw new Error('This request cannot be recalled at the current stage');
    }
    if (request.status === 'pending_dept_assignment' && await hasProcurementApproval(client, req.params.id)) {
      throw new Error('This request can no longer be recalled after Procurement approval');
    }

    // If at pending_owner_dept stage and owner approvals already exist, prevent recall
    if (request.status === 'pending_owner_dept') {
      const approvals = await client.query(
        'SELECT id FROM asset_request_owner_approvals WHERE request_id = $1 LIMIT 1',
        [req.params.id]
      );
      if (approvals.rows.length > 0) {
        throw new Error('Cannot recall — the owning department has already approved this request');
      }
    }

    await releaseAllRequestAssignments(client, req.params.id, req.user.id, req.body?.notes || 'Recalled by requester');
    await client.query('DELETE FROM asset_request_owner_approvals WHERE request_id = $1', [req.params.id]);
    await client.query(
      `UPDATE asset_requests SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    await addTimelineEntry(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      'Recalled by requester',
      req.body?.notes || 'Requester recalled the request for editing'
    );
    await client.query('COMMIT');
    res.json({ message: 'Request recalled — you can edit and resubmit', status: 'returned' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/cancel', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];
    if (request.status !== 'returned') {
      throw new Error('Only returned requests can be cancelled');
    }
    const headDeptId = await getUserDeptId(req.user.id);
    if (request.department_id !== headDeptId) {
      throw new Error('Only the requesting department can cancel this request');
    }
    await client.query(
      `UPDATE asset_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    await addTimelineEntry(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      'Request cancelled by requester',
      req.body?.notes || 'Cancelled — will not be resubmitted'
    );
    await client.query('COMMIT');
    res.json({ message: 'Request cancelled', status: 'cancelled' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/owner-action', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    if (reqRow.rows[0].status !== 'pending_owner_dept') throw new Error('Request is not awaiting owner department approval');

    const headDeptId = await getUserDeptId(req.user.id);
    const ownsItems = await client.query(
      `SELECT 1 FROM asset_request_items ari
       JOIN asset_categories ac ON ari.category_id = ac.id
       WHERE ari.request_id = $1 AND ac.specialist_department_id = $2 LIMIT 1`,
      [req.params.id, headDeptId]
    );
    if (!ownsItems.rows.length) throw new Error('Your department does not own equipment in this request');

    if (action === 'approve') {
      await client.query(
        `INSERT INTO asset_request_owner_approvals (request_id, owner_department_id, approved_by, notes)
         VALUES ($1, $2, $3, $4) ON CONFLICT (request_id, owner_department_id) DO NOTHING`,
        [req.params.id, headDeptId, req.user.id, notes]
      );

      const { ownerDeptIds } = await analyzeRequestItems(client, reqRow.rows[0].department_id,
        (await client.query(
          `SELECT ac.name as category FROM asset_request_items ari JOIN asset_categories ac ON ari.category_id = ac.id WHERE ari.request_id = $1`,
          [req.params.id]
        )).rows.map((r) => ({ category: r.category }))
      );

      const approved = await client.query(
        'SELECT owner_department_id FROM asset_request_owner_approvals WHERE request_id = $1',
        [req.params.id]
      );
      const approvedSet = new Set(approved.rows.map((r) => r.owner_department_id));
      const allApproved = ownerDeptIds.every((id) => approvedSet.has(id));

      if (allApproved) {
        await client.query('UPDATE asset_requests SET status = $1 WHERE id = $2', [STATUS_AFTER_OWNER_APPROVAL, req.params.id]);
        await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'All owning departments approved — awaiting store assignment', notes);
      } else {
        await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Owning department approved — awaiting other owning departments', notes);
      }
    } else {
      await client.query('UPDATE asset_requests SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Owning department rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Request updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/dept-assign', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { fulfillments, notes } = req.body;
    const { totalAssigned, actionMsg } = await deptAssignRequest(
      client, req.params.id, fulfillments || [], req.user.id, req.user.role, notes, { replace: false }
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, actionMsg, notes);
    await client.query('COMMIT');
    res.json({ message: actionMsg, totalAssigned });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/dept-assign-update', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { fulfillments, notes } = req.body;
    const { totalAssigned, actionMsg } = await deptAssignRequest(
      client, req.params.id, fulfillments || [], req.user.id, req.user.role, notes, { replace: true }
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, actionMsg, notes);
    await client.query('COMMIT');
    res.json({ message: actionMsg, totalAssigned });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/send-to-procurement', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];
    if (request.status !== 'pending_dept_assignment') {
      throw new Error('Request is not awaiting store assignment');
    }

    const headDeptId = await getUserDeptId(req.user.id);
    const ownedItems = await client.query(
      `SELECT ari.id, ari.category_id, ac.name AS category_name
       FROM asset_request_items ari
       JOIN asset_categories ac ON ari.category_id = ac.id
       WHERE ari.request_id = $1 AND ac.specialist_department_id = $2`,
      [req.params.id, headDeptId]
    );
    if (!ownedItems.rows.length) throw new Error('Your department does not own equipment in this request');

    let unavailable = false;
    for (const item of ownedItems.rows) {
      const available = await getAvailableAssetsForItem(
        client,
        item.category_id,
        request.department_id,
        headDeptId,
        { requestId: request.id, requestItemId: item.id }
      );
      if (available.length === 0) unavailable = true;
    }
    if (!unavailable) throw new Error('Available assets exist in your store; continue the normal process');

    const notes = req.body?.notes || 'No available assets in store';
    await client.query(
      `UPDATE asset_requests SET status = 'pending_procurement', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Sent to Procurement', notes);

    const procurementUsers = await client.query(
      `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN departments d ON d.id = u.department_id
       WHERE u.is_active = true
         AND r.name IN ('inventory', 'procurement')
         AND d.name IN ('Inventory', 'Procurement')`
    );
    for (const user of procurementUsers.rows) {
      await client.query(
        `INSERT INTO notifications
          (user_id, title, message, type, is_read, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, false, $5, $6)`,
        [
          user.id,
          'Asset Request Sent to Procurement',
          `Request ${request.request_number} has no available assets in store and requires Procurement approval.`,
          'procurement_request',
          'asset_request',
          request.id,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Request sent to Procurement', status: 'pending_procurement' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/recall-from-procurement', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];
    if (request.status !== 'pending_procurement') {
      throw new Error('This request is no longer awaiting Procurement approval');
    }

    const headDeptId = await getUserDeptId(req.user.id);
    const ownsItems = await client.query(
      `SELECT 1
       FROM asset_request_items ari
       JOIN asset_categories ac ON ac.id = ari.category_id
       WHERE ari.request_id = $1 AND ac.specialist_department_id = $2
       LIMIT 1`,
      [req.params.id, headDeptId]
    );
    if (!ownsItems.rows.length) {
      throw new Error('Only the owning store department can recall this request');
    }

    const notes = req.body?.notes || 'Recalled from Procurement for store review';
    await client.query(
      `UPDATE asset_requests SET status = 'pending_dept_assignment', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Recalled from Procurement', notes);
    await client.query('COMMIT');
    res.json({ message: 'Request recalled to store assignment', status: 'pending_dept_assignment' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/inventory-action', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');
    if (action !== 'approve') {
      throw new Error('Only Approve is available at inventory stage');
    }

    const { newStatus, actionMsg } = await inventoryConfirmRequest(
      client, req.params.id, action, req.user.id, notes
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, actionMsg, notes);

    // Notify assignee that assets have been assigned (workflow complete)
    const req_data = await client.query(
      'SELECT assigned_to, request_number FROM asset_requests WHERE id = $1',
      [req.params.id]
    );
    if (req_data.rows.length > 0 && req_data.rows[0].assigned_to) {
      const complete = newStatus === 'fulfilled';
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, false, $5, $6)`,
        [
          req_data.rows[0].assigned_to,
          complete ? 'Assets Assigned' : 'Assets Partially Assigned',
          `Request ${req_data.rows[0].request_number} has been ${complete ? 'approved' : 'partially approved'} by Inventory. Your assets are ready.`,
          'request_fulfilled',
          'asset_request',
          req.params.id,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ message: actionMsg, status: newStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/procurement-action', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    if (reqRow.rows[0].status !== 'pending_procurement') {
      throw new Error('Request is not awaiting Procurement approval');
    }
    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid Procurement action');

    const newStatus = action === 'approve' ? 'pending_dept_assignment' : 'returned';
    const actionMsg = action === 'approve'
      ? 'Procurement approved — returned to store assignment'
      : 'Procurement rejected with comment — returned to requester';
    await client.query(
      `UPDATE asset_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newStatus, req.params.id]
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, actionMsg, notes);
    await client.query('COMMIT');
    res.json({ message: actionMsg, status: newStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/employee-action', authenticateToken, authorizeRoles('employee'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!['approve', 'reject'].includes(action)) throw new Error('Invalid employee action');
    if (action === 'reject' && !notes?.trim()) throw new Error('Rejection reason is required');

    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];
    if (request.status !== 'pending_employee_approval') {
      throw new Error('Request is not awaiting employee approval');
    }
    if (request.assigned_to !== req.user.id) {
      throw new Error('You can only action requests assigned to you');
    }

    if (action === 'reject') {
      await client.query(
        `UPDATE asset_requests SET status = 'pending_inventory', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.params.id]
      );
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Employee rejected asset assignment', notes);

      const inventoryUsers = await client.query(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN departments d ON d.id = u.department_id
         WHERE u.is_active = true
           AND r.name IN ('inventory', 'procurement')
           AND d.name IN ('Inventory', 'Procurement')`
      );
      for (const user of inventoryUsers.rows) {
        await client.query(
          `INSERT INTO notifications
            (user_id, title, message, type, is_read, related_entity_type, related_entity_id)
           VALUES ($1, $2, $3, $4, false, $5, $6)`,
          [
            user.id,
            'Employee Rejected Asset Assignment',
            `Request ${request.request_number} was rejected by the employee. Reason: ${notes}`,
            'employee_assignment_rejected',
            'asset_request',
            request.id,
          ]
        );
      }

      await client.query('COMMIT');
      return res.json({ message: 'Assignment rejected and returned to Inventory', status: 'pending_inventory' });
    }

    const check = await client.query(
      `SELECT COUNT(*) FILTER (WHERE COALESCE(fulfilled_quantity, 0) < quantity) AS incomplete
       FROM asset_request_items WHERE request_id = $1`,
      [req.params.id]
    );
    const complete = parseInt(check.rows[0].incomplete, 10) === 0;
    const finalStatus = complete ? 'fulfilled' : 'partially_fulfilled';
    await client.query(
      `UPDATE asset_requests SET status = $1, fulfilled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [finalStatus, req.params.id]
    );
    await addTimelineEntry(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      complete ? 'Employee approved — assignment complete' : 'Employee approved — partial fulfillment complete',
      notes || 'Employee approved the asset assignment'
    );
    await client.query('COMMIT');
    res.json({ message: complete ? 'Assignment approved' : 'Partial assignment approved', status: finalStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/employee-approve', authenticateToken, authorizeRoles('employee'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { notes } = req.body;
    
    const reqRow = await client.query('SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!reqRow.rows.length) throw new Error('Request not found');
    const request = reqRow.rows[0];
    
    if (request.status !== 'pending_employee_approval') {
      throw new Error('Request is not awaiting employee approval');
    }
    
    if (request.assigned_to !== req.user.id) {
      throw new Error('You can only approve requests assigned to you');
    }

    // Check if any items are incomplete
    const check = await client.query(
      `SELECT COUNT(*) FILTER (WHERE COALESCE(fulfilled_quantity, 0) < quantity) AS incomplete
       FROM asset_request_items
       WHERE request_id = $1`,
      [req.params.id]
    );
    const complete = parseInt(check.rows[0].incomplete, 10) === 0;
    const finalStatus = complete ? 'fulfilled' : 'partially_fulfilled';

    await client.query(
      `UPDATE asset_requests
       SET status = $1, fulfilled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [finalStatus, req.params.id]
    );

    await addTimelineEntry(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      complete ? 'Employee approved — assignment complete' : 'Employee approved — partial fulfillment complete',
      notes || 'Employee approved the asset assignment'
    );

    await client.query('COMMIT');
    res.json({ 
      message: complete ? 'Assignment approved' : 'Partial assignment approved',
      status: finalStatus 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
