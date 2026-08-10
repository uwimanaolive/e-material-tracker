import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

// Get all assets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, category, department } = req.query;
    
    let query = `
      SELECT a.*, ac.name as category_name, 
             COALESCE(aa.assigned_to, 0) as assigned_to_id,
             u.name as assigned_to_name,
             d.name as current_department,
             sd.name as store_department_name
      FROM assets a
      LEFT JOIN asset_categories ac ON a.category_id = ac.id
      LEFT JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.status = 'active'
      LEFT JOIN users u ON aa.assigned_to = u.id
      LEFT JOIN departments d ON aa.department_id = d.id
      LEFT JOIN departments sd ON a.store_department_id = sd.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }
    
    if (category) {
      paramCount++;
      query += ` AND ac.name = $${paramCount}`;
      params.push(category);
    }
    
    if (department) {
      paramCount++;
      query += ` AND d.name = $${paramCount}`;
      params.push(department);
    }
    
    query += ' ORDER BY a.name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get inventory store for a department (available / used / lost / damaged)
router.get('/store/department', authenticateToken, async (req, res) => {
  try {
    const departmentName = req.query.department || req.user.department;
    const view = (req.query.view || 'available').toLowerCase();

    const deptResult = await pool.query('SELECT id, name FROM departments WHERE name = $1', [departmentName]);
    if (deptResult.rows.length === 0) {
      return res.status(400).json({ error: 'Department not found' });
    }
    const deptId = deptResult.rows[0].id;

    const [availableCount, usedCount, lostCount, damagedCount] = await Promise.all([
      pool.query(
        `SELECT COUNT(a.id) AS count
         FROM assets a
         WHERE a.status = 'available'
           AND a.store_department_id = $1`,
        [deptId]
      ),
      pool.query(
        `SELECT COUNT(aa.id) AS count
         FROM asset_assignments aa
         WHERE aa.status = 'active'
           AND aa.department_id = $1`,
        [deptId]
      ),
      pool.query(
        `SELECT COUNT(ir.id) AS count
         FROM issue_reports ir
         JOIN users u ON ir.reported_by = u.id
         WHERE u.department_id = $1
           AND LOWER(ir.issue_type) = 'lost'`,
        [deptId]
      ),
      pool.query(
        `SELECT COUNT(ir.id) AS count
         FROM issue_reports ir
         JOIN users u ON ir.reported_by = u.id
         WHERE u.department_id = $1
           AND LOWER(ir.issue_type) = 'damaged'`,
        [deptId]
      ),
    ]);

    const counts = {
      available: parseInt(availableCount.rows[0].count, 10),
      used: parseInt(usedCount.rows[0].count, 10),
      lost: parseInt(lostCount.rows[0].count, 10),
      damaged: parseInt(damagedCount.rows[0].count, 10),
    };

    let items = [];

    if (view === 'available') {
      const itemsResult = await pool.query(
        `SELECT a.id, a.name, a.serial_number, a.brand, a.model, a.condition,
                ac.name AS category_name,
                sd.name AS store_department_name,
                'reserved' AS pool_type
         FROM assets a
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN departments sd ON a.store_department_id = sd.id
         WHERE a.status = 'available'
           AND a.store_department_id = $1
         ORDER BY ac.name, a.name`,
        [deptId]
      );
      items = itemsResult.rows;
    } else if (view === 'used') {
      const itemsResult = await pool.query(
        `SELECT a.id, a.name, a.serial_number, a.brand, a.model, a.condition,
                ac.name AS category_name,
                u.name AS assigned_to_name,
                d.name AS department_name,
                sd.name AS store_department_name,
                aa.assigned_date,
                aa.status AS assignment_status
         FROM asset_assignments aa
         JOIN assets a ON aa.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON aa.assigned_to = u.id
         LEFT JOIN departments d ON aa.department_id = d.id
         LEFT JOIN departments sd ON a.store_department_id = sd.id
         WHERE aa.status = 'active'
           AND aa.department_id = $1
         ORDER BY ac.name, a.name`,
        [deptId]
      );
      items = itemsResult.rows;
    } else if (view === 'lost') {
      const itemsResult = await pool.query(
        `SELECT ir.id, ir.report_number, ir.status AS report_status, ir.created_at,
                a.id AS asset_id, a.name, a.serial_number, a.brand, a.model,
                ac.name AS category_name,
                u.name AS reporter_name,
                d.name AS department_name,
                ir.description,
                ir.resolution_outcome
         FROM issue_reports ir
         JOIN assets a ON ir.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON ir.reported_by = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.department_id = $1
           AND LOWER(ir.issue_type) = 'lost'
         ORDER BY ir.created_at DESC NULLS LAST`,
        [deptId]
      );
      items = itemsResult.rows;
    } else if (view === 'damaged') {
      const itemsResult = await pool.query(
        `SELECT ir.id, ir.report_number, ir.status AS report_status, ir.created_at,
                a.id AS asset_id, a.name, a.serial_number, a.brand, a.model, a.condition,
                ac.name AS category_name,
                u.name AS reporter_name,
                d.name AS department_name,
                ir.description,
                ir.resolution_outcome
         FROM issue_reports ir
         JOIN assets a ON ir.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON ir.reported_by = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.department_id = $1
           AND LOWER(ir.issue_type) = 'damaged'
         ORDER BY ir.created_at DESC NULLS LAST`,
        [deptId]
      );
      items = itemsResult.rows;
    } else {
      return res.status(400).json({ error: 'Invalid view. Use available, used, lost, or damaged.' });
    }

    const summaryResult = await pool.query(
      `SELECT ac.id AS category_id, ac.name AS category_name,
              COUNT(aa.id) FILTER (WHERE aa.status = 'active') AS available_count,
              0 AS reserved_for_department
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       JOIN asset_categories ac ON a.category_id = ac.id
       WHERE aa.department_id = $1 AND aa.status = 'active'
       GROUP BY ac.id, ac.name
       ORDER BY ac.name`,
      [deptId]
    );

    res.json({
      department: deptResult.rows[0].name,
      view,
      counts,
      summary: summaryResult.rows,
      items,
    });
  } catch (error) {
    console.error('Get store availability error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available assets for assignment (must be before /:id)
router.get('/available/list', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `
      SELECT a.*, ac.name as category_name
      FROM assets a
      LEFT JOIN asset_categories ac ON a.category_id = ac.id
      WHERE a.status = 'available'
    `;
    const params = [];
    
    if (category) {
      query += ' AND ac.name = $1';
      params.push(category);
    }
    
    query += ' ORDER BY a.name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get available assets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get asset by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, ac.name as category_name, ac.specialist_department_id, d.name as specialist_department_name
       FROM assets a
       LEFT JOIN asset_categories ac ON a.category_id = ac.id
       LEFT JOIN departments d ON ac.specialist_department_id = d.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Get current assignment
    const assignmentResult = await pool.query(
      `SELECT aa.*, u.name as assigned_to_name, ub.name as assigned_by_name, d.name as department_name
       FROM asset_assignments aa
       LEFT JOIN users u ON aa.assigned_to = u.id
       LEFT JOIN users ub ON aa.assigned_by = ub.id
       LEFT JOIN departments d ON aa.department_id = d.id
       WHERE aa.asset_id = $1 AND aa.status = 'active'
       ORDER BY aa.created_at DESC
       LIMIT 1`,
      [req.params.id]
    );
    
    const asset = result.rows[0];
    asset.current_assignment = assignmentResult.rows[0] || null;
    
    res.json(asset);
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create asset (procurement only)
router.post('/', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const { name, category, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, store_department } = req.body;
    
    const categoryResult = await pool.query('SELECT id FROM asset_categories WHERE name = $1', [category]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!store_department) {
      return res.status(400).json({ error: 'Belonging department is required for all assets' });
    }
    const sd = await pool.query('SELECT id FROM departments WHERE name = $1', [store_department]);
    if (!sd.rows.length) return res.status(400).json({ error: 'Invalid belonging department' });
    const storeDeptId = sd.rows[0].id;
    
    const result = await pool.query(
      'INSERT INTO assets (name, category_id, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, store_department_id, current_location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [name, categoryResult.rows[0].id, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, storeDeptId, 'Inventory Store']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update asset
router.put('/:id', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const { name, category, serial_number, model, brand, purchase_date, purchase_cost, status, condition, notes, store_department } = req.body;
    
    let categoryId = null;
    if (category) {
      const categoryResult = await pool.query('SELECT id FROM asset_categories WHERE name = $1', [category]);
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id;
      }
    }

    let storeDeptId = null;
    if (store_department !== undefined) {
      if (!store_department) throw new Error('Belonging department is required');
      const sd = await pool.query('SELECT id FROM departments WHERE name = $1', [store_department]);
      if (!sd.rows.length) throw new Error('Invalid belonging department');
      storeDeptId = sd.rows[0].id;
    } else {
      const existing = await pool.query('SELECT store_department_id FROM assets WHERE id = $1', [req.params.id]);
      storeDeptId = existing.rows[0]?.store_department_id ?? null;
    }
    
    const result = await pool.query(
      'UPDATE assets SET name = $1, category_id = $2, serial_number = $3, model = $4, brand = $5, purchase_date = $6, purchase_cost = $7, status = $8, condition = $9, notes = $10, store_department_id = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12 RETURNING *',
      [name, categoryId, serial_number, model, brand, purchase_date, purchase_cost, status, condition, notes, storeDeptId, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Retire/delete asset (procurement only) — soft delete via status change
router.delete('/:id', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const assignmentResult = await pool.query(
      "SELECT id FROM asset_assignments WHERE asset_id = $1 AND status = 'active'",
      [req.params.id]
    );

    if (assignmentResult.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot retire asset while it is assigned to an employee' });
    }

    const result = await pool.query(
      "UPDATE assets SET status = 'disposed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ message: 'Asset retired successfully', asset: result.rows[0] });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
