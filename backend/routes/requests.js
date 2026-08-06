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
} from '../src/utils/fulfillment.js';
import { enrichRows, enrichWithStatusDisplay } from '../src/utils/statusLabels.js';

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

const enrichRequest = async (request) => {
  const items = await pool.query(
    `SELECT ari.*, ac.name as category_name, od.name as owner_department_name
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
    if (item.fulfilled_quantity > 0) {
      const assets = await pool.query(
        `SELECT a.id, a.name, a.serial_number FROM assets a
         JOIN asset_assignments aa ON aa.asset_id = a.id
         WHERE aa.request_item_id = $1`,
        [item.id]
      );
      item.assigned_assets = assets.rows;
    } else {
      item.assigned_assets = [];
    }
  }
  request.timeline = timeline.rows;
  request.assignee_name = assignee.rows[0]?.name || null;
  request.reporter_department_name = request.department_name;
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
       WHERE ar.status = 'pending_dept_assignment'
         AND ac.specialist_department_id = $1
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
      'SELECT id, category_id, quantity, fulfilled_quantity FROM asset_request_items WHERE request_id = $1',
      [req.params.id]
    );
    const result = {};
    for (const item of items.rows) {
      result[item.id] = await getAvailableAssetsForItem(
        client, item.category_id, reqRow.rows[0].department_id, headDeptId
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

router.put('/:id/owner-action', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
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
      client, req.params.id, fulfillments || [], req.user.id, req.user.role, notes
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

router.put('/:id/inventory-action', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');

    const { newStatus, actionMsg } = await inventoryConfirmRequest(
      client, req.params.id, action, req.user.id, notes
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

router.put('/:id/procurement-action', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  req.body.action = req.body.action || 'approve';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');
    const { newStatus, actionMsg } = await inventoryConfirmRequest(
      client, req.params.id, action, req.user.id, notes
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

export default router;
