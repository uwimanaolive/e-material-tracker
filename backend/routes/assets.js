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

// Get procurement store availability for a department
router.get('/store/department', authenticateToken, async (req, res) => {
  try {
    const departmentName = req.query.department || req.user.department;

    const deptResult = await pool.query('SELECT id, name FROM departments WHERE name = $1', [departmentName]);
    if (deptResult.rows.length === 0) {
      return res.status(400).json({ error: 'Department not found' });
    }
    const deptId = deptResult.rows[0].id;

    const summaryResult = await pool.query(
      `SELECT ac.id as category_id, ac.name as category_name,
        COUNT(a.id) FILTER (
          WHERE a.status = 'available'
          AND (a.store_department_id IS NULL OR a.store_department_id = $1)
        ) as available_count,
        COUNT(a.id) FILTER (
          WHERE a.status = 'available' AND a.store_department_id = $1
        ) as reserved_for_department
       FROM asset_categories ac
       LEFT JOIN department_categories dc ON dc.category_id = ac.id AND dc.department_id = $1
       LEFT JOIN assets a ON a.category_id = ac.id
       WHERE dc.id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM department_categories WHERE department_id = $1)
       GROUP BY ac.id, ac.name
       ORDER BY ac.name`,
      [deptId]
    );

    const itemsResult = await pool.query(
      `SELECT a.id, a.name, a.serial_number, a.brand, a.model, a.condition,
        ac.name as category_name,
        sd.name as store_department_name,
        CASE WHEN a.store_department_id IS NULL THEN 'general' ELSE 'reserved' END as pool_type
       FROM assets a
       JOIN asset_categories ac ON a.category_id = ac.id
       LEFT JOIN departments sd ON a.store_department_id = sd.id
       LEFT JOIN department_categories dc ON dc.category_id = ac.id AND dc.department_id = $1
       WHERE a.status = 'available'
         AND (a.store_department_id IS NULL OR a.store_department_id = $1)
         AND (dc.id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM department_categories WHERE department_id = $1))
       ORDER BY ac.name, a.name`,
      [deptId]
    );

    res.json({
      department: deptResult.rows[0].name,
      summary: summaryResult.rows,
      items: itemsResult.rows,
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
router.post('/', authenticateToken, authorizeRoles('procurement'), async (req, res) => {
  try {
    const { name, category, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, store_department } = req.body;
    
    const categoryResult = await pool.query('SELECT id FROM asset_categories WHERE name = $1', [category]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    let storeDeptId = null;
    if (store_department) {
      const sd = await pool.query('SELECT id FROM departments WHERE name = $1', [store_department]);
      if (sd.rows.length > 0) storeDeptId = sd.rows[0].id;
    }
    
    const result = await pool.query(
      'INSERT INTO assets (name, category_id, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, store_department_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [name, categoryResult.rows[0].id, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, storeDeptId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update asset
router.put('/:id', authenticateToken, authorizeRoles('procurement'), async (req, res) => {
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
      if (store_department) {
        const sd = await pool.query('SELECT id FROM departments WHERE name = $1', [store_department]);
        if (sd.rows.length > 0) storeDeptId = sd.rows[0].id;
      }
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
router.delete('/:id', authenticateToken, authorizeRoles('procurement'), async (req, res) => {
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
