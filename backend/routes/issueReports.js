import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';
import { nextStatusAfterHseApproval, getAssetOwnerDeptId } from '../src/utils/workflow.js';
import { enrichRows } from '../src/utils/statusLabels.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png) and documents (pdf, doc, docx) are allowed'));
    }
  }
});

// Helper to generate report number
const generateReportNumber = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    "SELECT COUNT(*) FROM issue_reports WHERE report_number LIKE $1",
    [`IR-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `IR-${year}-${String(count).padStart(6, '0')}`;
};

// Helper to add timeline entry
const addTimelineEntry = async (pool, reportId, userId, role, action, notes) => {
  await pool.query(
    'INSERT INTO issue_timeline (issue_report_id, actor_id, actor_role, action, notes) VALUES ($1, $2, $3, $4, $5)',
    [reportId, userId, role, action, notes]
  );
};

const IR_BASE = `
  SELECT ir.*, a.name as asset_name, a.serial_number,
    u.name as reporter_name, d.name as reporter_department,
    od.name as owner_department_name
  FROM issue_reports ir
  LEFT JOIN assets a ON ir.asset_id = a.id
  LEFT JOIN asset_categories ac ON a.category_id = ac.id
  LEFT JOIN departments od ON ac.specialist_department_id = od.id
  LEFT JOIN users u ON ir.reported_by = u.id
  LEFT JOIN departments d ON u.department_id = d.id
`;

// Get all issue reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, issue_type } = req.query;
    
    let query = IR_BASE + ' WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND ir.status = $${paramCount}`;
      params.push(status);
    }
    
    if (issue_type) {
      paramCount++;
      query += ` AND ir.issue_type = $${paramCount}`;
      params.push(issue_type);
    }
    
    query += ' ORDER BY ir.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(enrichRows(result.rows));
  } catch (error) {
    console.error('Get issue reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get issue reports for current user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE} WHERE ir.reported_by = $1 ORDER BY ir.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    console.error('Get my issue reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending issue reports for head acknowledgement
router.get('/head/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE}
      WHERE ir.status = 'pending_head'
      AND d.id = (SELECT department_id FROM users WHERE id = $1)
      ORDER BY ir.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    console.error('Get head pending issue reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/head/department', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE}
      WHERE d.id = (SELECT department_id FROM users WHERE id = $1)
      ORDER BY ir.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending for owning department assessment
router.get('/owner/pending', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE}
       JOIN asset_categories ac2 ON a.category_id = ac2.id
       WHERE ir.status = 'pending_owner_dept'
         AND ac2.specialist_department_id = (SELECT department_id FROM users WHERE id = $1)
       ORDER BY ir.created_at DESC`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/owner/tracking', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ir.*, a.name as asset_name, u.name as reporter_name, d.name as reporter_department
       FROM issue_reports ir
       JOIN assets a ON ir.asset_id = a.id
       JOIN asset_categories ac ON a.category_id = ac.id
       LEFT JOIN users u ON ir.reported_by = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ac.specialist_department_id = (SELECT department_id FROM users WHERE id = $1)
         AND ir.status IN ('pending_inventory', 'pending_procurement', 'resolved', 'rejected')
         AND EXISTS (
           SELECT 1 FROM issue_timeline it
           WHERE it.issue_report_id = ir.id AND it.action LIKE '%Owning department assessed%'
         )
       ORDER BY ir.updated_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/hse/pending', authenticateToken, authorizeRoles('hse'), async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE} WHERE ir.status = 'pending_hse' ORDER BY ir.created_at DESC`
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const result = await pool.query(
      `${IR_BASE} WHERE ir.status IN ('pending_inventory', 'pending_procurement') ORDER BY ir.created_at DESC`
    );
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory/history', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const result = await pool.query(`${IR_BASE} ORDER BY ir.updated_at DESC LIMIT 100`);
    res.json(enrichRows(result.rows));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/procurement/history', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const result = await pool.query(`${IR_BASE} ORDER BY ir.updated_at DESC LIMIT 100`);
  res.json(enrichRows(result.rows));
});

// Get pending issue reports for inventory resolution
router.get('/procurement/pending', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const result = await pool.query(
    `${IR_BASE} WHERE ir.status IN ('pending_inventory', 'pending_procurement') ORDER BY ir.created_at DESC`
  );
  res.json(enrichRows(result.rows));
});

// Get issue report by ID with timeline
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`${IR_BASE} WHERE ir.id = $1`, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue report not found' });
    }
    
    const report = enrichRows([result.rows[0]])[0];
    
    // Get timeline
    const timelineResult = await pool.query(
      `SELECT it.*, u.name as actor_name
       FROM issue_timeline it
       LEFT JOIN users u ON it.actor_id = u.id
       WHERE it.issue_report_id = $1
       ORDER BY it.created_at ASC`,
      [req.params.id]
    );
    report.timeline = timelineResult.rows;
    
    res.json(report);
  } catch (error) {
    console.error('Get issue report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create issue report (employee only)
router.post('/', authenticateToken, authorizeRoles('employee'), upload.single('attachment'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { asset_id, issue_type, description } = req.body;
    const attachment = req.file ? `/uploads/${req.file.filename}` : null;

    // Verify asset is assigned to employee
    const assignmentResult = await client.query(
      'SELECT * FROM asset_assignments WHERE asset_id = $1 AND assigned_to = $2 AND status = $3',
      [asset_id, req.user.id, 'active']
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error('Asset is not assigned to you');
    }

    const reportNumber = await generateReportNumber();

    const reportResult = await client.query(
      'INSERT INTO issue_reports (report_number, asset_id, reported_by, issue_type, description, attachment, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [reportNumber, asset_id, req.user.id, issue_type, description, attachment, 'pending_head']
    );

    const reportId = reportResult.rows[0].id;

    // Add timeline entry
    await addTimelineEntry(client, reportId, req.user.id, req.user.role, 'Issue reported', description);

    await client.query('COMMIT');

    res.status(201).json(reportResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create issue report error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Department head review (approve/reject → HSE)
router.put('/:id/head-action', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');

    const reportResult = await client.query('SELECT * FROM issue_reports WHERE id = $1', [req.params.id]);
    if (!reportResult.rows.length) throw new Error('Issue report not found');
    if (reportResult.rows[0].status !== 'pending_head') throw new Error('Report is not awaiting department head review');

    if (action === 'approve') {
      await client.query('UPDATE issue_reports SET status = $1 WHERE id = $2', ['pending_hse', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role,
        'Department head approved — forwarded to HSE', notes);
    } else {
      await client.query('UPDATE issue_reports SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'Department head rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Issue report updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// HSE review (approve/reject)
router.put('/:id/hse-action', authenticateToken, authorizeRoles('hse'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { action, notes } = req.body;
    if (!notes?.trim()) throw new Error('Comment is required');

    const reportResult = await client.query('SELECT * FROM issue_reports WHERE id = $1', [req.params.id]);
    if (!reportResult.rows.length) throw new Error('Issue report not found');
    if (reportResult.rows[0].status !== 'pending_hse') throw new Error('Report is not awaiting HSE review');

    const report = reportResult.rows[0];

    if (action === 'approve') {
      const empDept = await client.query('SELECT department_id FROM users WHERE id = $1', [report.reported_by]);
      const nextStatus = await nextStatusAfterHseApproval(client, report.asset_id, empDept.rows[0].department_id);
      const ownerDeptId = await getAssetOwnerDeptId(client, report.asset_id);
      let ownerName = '';
      if (ownerDeptId) {
        const od = await client.query('SELECT name FROM departments WHERE id = $1', [ownerDeptId]);
        ownerName = od.rows[0]?.name || '';
      }
      await client.query('UPDATE issue_reports SET status = $1 WHERE id = $2', [nextStatus, req.params.id]);
      const msg = nextStatus === 'pending_owner_dept'
        ? `HSE approved — forwarded to ${ownerName} Department for assessment`
        : 'HSE approved — forwarded to Inventory Department';
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, msg, notes);
    } else {
      await client.query('UPDATE issue_reports SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, 'HSE rejected', notes);
    }
    await client.query('COMMIT');
    res.json({ message: 'Issue report updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Owning department assessment (head)
router.put('/:id/owner-action', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { assessment_notes, recommendation } = req.body;
    if (!assessment_notes?.trim()) throw new Error('Comment is required');
    await client.query(
      'UPDATE issue_reports SET status = $1, assessment_recommendation = $2 WHERE id = $3',
      ['pending_inventory', recommendation, req.params.id]
    );
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role,
      `Owning department assessed — Recommendation: ${recommendation}`, assessment_notes);
    await client.query('COMMIT');
    res.json({ message: 'Issue report assessed' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Resolve issue report (inventory)
router.put('/:id/inventory-action', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { resolution_outcome, resolution_notes } = req.body;
    if (!resolution_notes?.trim()) throw new Error('Comment is required');

    const reportResult = await client.query('SELECT * FROM issue_reports WHERE id = $1', [req.params.id]);
    if (reportResult.rows.length === 0) {
      throw new Error('Issue report not found');
    }
    
    const report = reportResult.rows[0];

    const activeAssignment = await client.query(
      "SELECT id FROM asset_assignments WHERE asset_id = $1 AND status = 'active' LIMIT 1",
      [report.asset_id]
    );

    if (resolution_outcome === 'write-off') {
      await client.query('UPDATE assets SET status = $1 WHERE id = $2', ['written_off', report.asset_id]);
      if (activeAssignment.rows.length) {
        await client.query("UPDATE asset_assignments SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [activeAssignment.rows[0].id]);
      }
    } else if (resolution_outcome === 'disposed') {
      await client.query('UPDATE assets SET status = $1 WHERE id = $2', ['disposed', report.asset_id]);
      if (activeAssignment.rows.length) {
        await client.query("UPDATE asset_assignments SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [activeAssignment.rows[0].id]);
      }
    } else if (resolution_outcome === 'replace' || resolution_outcome === 'replaced') {
      await client.query('UPDATE assets SET status = $1 WHERE id = $2', ['replaced', report.asset_id]);
      if (activeAssignment.rows.length) {
        await client.query("UPDATE asset_assignments SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [activeAssignment.rows[0].id]);
      }
    } else if (resolution_outcome === 'repair' || resolution_outcome === 'repaired') {
      await client.query('UPDATE assets SET condition = $1 WHERE id = $2', ['good', report.asset_id]);
    }
    
    await client.query('UPDATE issue_reports SET status = $1, resolution_outcome = $2, resolution_notes = $3 WHERE id = $4', ['resolved', resolution_outcome, resolution_notes, req.params.id]);
    await addTimelineEntry(client, req.params.id, req.user.id, req.user.role, `Inventory resolved — Outcome: ${resolution_outcome}`, resolution_notes);
    
    await client.query('COMMIT');
    res.json({ message: 'Issue report resolved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id/procurement-action', authenticateToken, authorizeRoles('inventory'), async (req, res, next) => {
  req.url = req.url.replace('procurement-action', 'inventory-action');
  const layer = router.stack.find((r) => r.route?.path === '/:id/inventory-action');
  if (layer) return layer.route.stack[0].handle(req, res, next);
  res.status(404).json({ error: 'Not found' });
});

export default router;
