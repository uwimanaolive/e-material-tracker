import express from 'express';
import crypto from 'crypto';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';
import {
  nextStatusAfterHeadApproval,
  nextStatusAfterHseApproval,
  GATE_PASS_STATUS_AFTER_OWNER,
} from '../src/utils/workflow.js';
import { enrichRows } from '../src/utils/statusLabels.js';

const router = express.Router();

const generateGatePassNumber = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    "SELECT COUNT(*) FROM gate_passes WHERE gate_pass_number LIKE $1",
    [`GP-${year}-%`]
  );
  return `GP-${year}-${String(parseInt(result.rows[0].count) + 1).padStart(6, '0')}`;
};

const addTimelineEntry = async (client, gatePassId, userId, role, action, notes) => {
  await client.query(
    'INSERT INTO gate_pass_timeline (gate_pass_id, actor_id, actor_role, action, notes) VALUES ($1, $2, $3, $4, $5)',
    [gatePassId, userId, role, action, notes]
  );
};

const GP_BASE = `
  SELECT gp.*, a.name as asset_name, a.serial_number, u.name as employee_name, d.name as employee_department,
    od.name as owner_department_name
  FROM gate_passes gp
  LEFT JOIN assets a ON gp.asset_id = a.id
  LEFT JOIN asset_categories ac ON a.category_id = ac.id
  LEFT JOIN departments od ON ac.specialist_department_id = od.id
  LEFT JOIN users u ON gp.employee_id = u.id
  LEFT JOIN departments d ON u.department_id = d.id
`;

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = GP_BASE + ' WHERE 1=1';
    const params = [];
    if (status) { query += ' AND gp.status = $1'; params.push(status); }
    query += ' ORDER BY gp.created_at DESC';
    res.json(enrichRows((await pool.query(query, params)).rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `${GP_BASE} WHERE gp.employee_id = $1 ORDER BY gp.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/head/department', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${GP_BASE} WHERE d.id = (SELECT department_id FROM users WHERE id = $1) ORDER BY gp.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/head/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${GP_BASE} WHERE gp.status = 'pending_head'
       AND d.id = (SELECT department_id FROM users WHERE id = $1)
       ORDER BY gp.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/owner/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${GP_BASE} WHERE gp.status = 'pending_owner_dept'
       AND ac.specialist_department_id = (SELECT department_id FROM users WHERE id = $1)
       ORDER BY gp.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const result = await pool.query(
      `${GP_BASE} WHERE gp.status IN ('pending_inventory', 'pending_procurement') ORDER BY gp.created_at DESC`
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/procurement/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const result = await pool.query(
    `${GP_BASE} WHERE gp.status IN ('pending_inventory', 'pending_procurement') ORDER BY gp.created_at DESC`
  );
  res.json(enrichRows(result.rows));
});

router.get('/verify/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gp.gate_pass_number, gp.status, gp.from_location, gp.to_location, gp.reason,
        gp.departure_date, gp.expected_return_date, gp.activated_at, gp.no_return,
        a.name as asset_name, a.serial_number, u.name as employee_name, d.name as employee_department
       FROM gate_passes gp
       LEFT JOIN assets a ON gp.asset_id = a.id
       LEFT JOIN users u ON gp.employee_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE gp.pass_token = $1`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ valid: false, error: 'Gate pass not found' });
    const gp = result.rows[0];
    if (gp.status !== 'active') return res.json({ valid: false, error: `Pass is ${gp.status}`, gatePass: gp });
    res.json({ valid: true, gatePass: gp });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/owner/tracking', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const deptId = (await pool.query('SELECT department_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.department_id;
    const result = await pool.query(
      `SELECT DISTINCT gp.*, a.name as asset_name, u.name as employee_name, d.name as employee_department
       FROM gate_passes gp
       JOIN assets a ON gp.asset_id = a.id
       JOIN asset_categories ac ON a.category_id = ac.id
       LEFT JOIN users u ON gp.employee_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ac.specialist_department_id = $1
         AND gp.status IN ('pending_inventory', 'pending_procurement', 'active', 'closed', 'rejected')
         AND EXISTS (
           SELECT 1 FROM gate_pass_timeline gt
           WHERE gt.gate_pass_id = gp.id AND gt.action LIKE '%Owning department approved%'
         )
       ORDER BY gp.updated_at DESC LIMIT 50`,
      [deptId]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`${GP_BASE} WHERE gp.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Gate pass not found' });
    const gatePass = result.rows[0];
    const timeline = await pool.query(
      `SELECT gt.*, u.name as actor_name FROM gate_pass_timeline gt
       LEFT JOIN users u ON gt.actor_id = u.id WHERE gt.gate_pass_id = $1 ORDER BY gt.created_at ASC`,
      [req.params.id]
    );
    gatePass.timeline = timeline.rows;
    res.json(enrichRows([gatePass])[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, authorizeRoles('employee'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { asset_id, from_location, to_location, reason, departure_date, expected_return_date, notes, no_return } = req.body;
    const isPermanent = no_return === true || no_return === 'true';

    if (!isPermanent && !expected_return_date) {
      throw new Error('Expected return date is required unless this is a permanent move');
    }

    const assignment = await client.query(
      "SELECT * FROM asset_assignments WHERE asset_id = $1 AND assigned_to = $2 AND status = 'active'",
      [asset_id, req.user.id]
    );
    if (!assignment.rows.length) throw new Error('Asset is not assigned to you');

    const gatePassNumber = await generateGatePassNumber();
    const gp = await client.query(
      `INSERT INTO gate_passes (gate_pass_number, asset_id, employee_id, from_location, to_location, reason,
        departure_date, expected_return_date, notes, no_return, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [gatePassNumber, asset_id, req.user.id, from_location, to_location, reason, departure_date,
        isPermanent ? null : expected_return_date, notes, isPermanent, 'pending_head']
    );
    await addTimelineEntry(client, gp.rows[0].id, req.user.id, req.user.role,
      isPermanent ? 'Permanent move gate pass requested' : 'Gate pass requested', notes);
    await client.query('COMMIT');
    res.status(201).json(gp.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/head-action', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');
    const gp = await client.query('SELECT * FROM gate_passes WHERE id = $1', [req.params.id]);
    if (!gp.rows.length) throw new Error('Gate pass not found');
    const gatePass = gp.rows[0];

    if (action === 'approve') {
      const empDept = await client.query('SELECT department_id FROM users WHERE id = $1', [gatePass.employee_id]);
      const nextStatus = await nextStatusAfterHeadApproval(client, gatePass.asset_id, empDept.rows[0].department_id);
      await client.query('UPDATE gate_passes SET status = $1 WHERE id = $2', [nextStatus, req.params.id]);
      const msg = nextStatus === 'pending_owner_dept'
        ? 'Department head approved — awaiting owning department'
        : 'Department head approved — forwarded to Inventory';
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, msg, notes);
    } else {
      await client.query('UPDATE gate_passes SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Department head rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Gate pass updated' });
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
    if (action === 'approve') {
      await client.query('UPDATE gate_passes SET status = $1 WHERE id = $2', [GATE_PASS_STATUS_AFTER_OWNER, req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Owning department approved — forwarded to Inventory', notes);
    } else {
      await client.query('UPDATE gate_passes SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Owning department rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Gate pass updated' });
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
    const gp = await client.query('SELECT * FROM gate_passes WHERE id = $1', [req.params.id]);
    if (!gp.rows.length) throw new Error('Gate pass not found');
    const gatePass = gp.rows[0];

    if (action === 'approve') {
      const passToken = crypto.randomUUID();
      if (gatePass.no_return) {
        await client.query(
          `UPDATE gate_passes SET status = $1, pass_token = $2, activated_at = CURRENT_TIMESTAMP,
           actual_return_date = NULL WHERE id = $3`,
          ['closed', passToken, req.params.id]
        );
        await client.query('UPDATE assets SET current_location = $1 WHERE id = $2', [gatePass.to_location, gatePass.asset_id]);
      } else {
        await client.query(
          'UPDATE gate_passes SET status = $1, pass_token = $2, activated_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['active', passToken, req.params.id]
        );
        await client.query('UPDATE assets SET current_location = $1 WHERE id = $2', [gatePass.to_location, gatePass.asset_id]);
      }
      await client.query(
        'INSERT INTO asset_movements (asset_id, gate_pass_id, from_location, to_location, moved_by, notes) VALUES ($1,$2,$3,$4,$5,$6)',
        [gatePass.asset_id, req.params.id, gatePass.from_location, gatePass.to_location, req.user.id, notes]
      );
      const msg = gatePass.no_return
        ? 'Inventory approved — permanent move completed'
        : 'Inventory approved — gate pass active (QR issued)';
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, msg, notes);
    } else {
      await client.query('UPDATE gate_passes SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Inventory rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Gate pass updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/procurement-action', authenticateToken, authorizeRoles('inventory'), async (req, res, next) => {
  req.url = req.url.replace('procurement-action', 'inventory-action');
  const handler = router.stack.find((r) => r.route?.path === '/:id/inventory-action' && r.route.methods.put);
  if (handler) return handler.route.stack[0].handle(req, res, next);
  res.status(404).json({ error: 'Not found' });
});

router.put('/:id/complete', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { notes } = req.body;
    const gp = await client.query('SELECT * FROM gate_passes WHERE id = $1', [req.params.id]);
    if (!gp.rows.length) throw new Error('Gate pass not found');
    const gatePass = gp.rows[0];

    if (gatePass.no_return) {
      throw new Error('Permanent move passes are closed on approval — no return step');
    }

    await client.query(
      'INSERT INTO asset_movements (asset_id, gate_pass_id, from_location, to_location, moved_by, notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [gatePass.asset_id, req.params.id, gatePass.to_location, gatePass.from_location, req.user.id, notes]
    );
    await client.query('UPDATE assets SET current_location = $1 WHERE id = $2', [gatePass.from_location, gatePass.asset_id]);
    await client.query('UPDATE gate_passes SET status = $1, actual_return_date = CURRENT_DATE WHERE id = $2', ['closed', req.params.id]);
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Gate pass closed — asset returned', notes);
    await client.query('COMMIT');
    res.json({ message: 'Gate pass completed' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
