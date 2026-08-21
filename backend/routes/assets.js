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
    const view = (req.query.view || 'available').toLowerCase();
    let role = req.user.role === 'specialist' ? 'head' : req.user.role;
    if (role === 'procurement') role = 'inventory';
    const isGlobalViewer = ['inventory', 'super_admin', 'admin'].includes(role);

    const userDept = await pool.query('SELECT department_id FROM users WHERE id = $1', [req.user.id]);
    const ownerDeptId = isGlobalViewer ? null : (userDept.rows[0]?.department_id || null);

    if (!isGlobalViewer && !ownerDeptId) {
      return res.json({
        department: req.user.department || null,
        managed_categories_only: true,
        scope: 'all',
        view,
        counts: { available: 0, used: 0, lost: 0, damaged: 0 },
        summary: [],
        items: [],
      });
    }

    let locationDeptId = null;
    let locationDeptName = null;
    const wantsAllLocations = req.query.scope === 'all' || req.query.department === 'all' || !req.query.department;
    if (!wantsAllLocations) {
      const deptResult = await pool.query('SELECT id, name FROM departments WHERE name = $1', [req.query.department]);
      if (!deptResult.rows.length) {
        return res.status(400).json({ error: 'Department not found' });
      }
      locationDeptId = deptResult.rows[0].id;
      locationDeptName = deptResult.rows[0].name;
    }

    const filterParams = [ownerDeptId, locationDeptId];

    const [availableCount, usedCount, lostCount, damagedCount] = await Promise.all([
      pool.query(
        `SELECT COUNT(a.id) AS count
         FROM assets a
         JOIN asset_categories ac ON a.category_id = ac.id
         WHERE a.status = 'available'
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR a.store_department_id = $2)`,
        filterParams
      ),
      pool.query(
        `SELECT COUNT(aa.id) AS count
         FROM asset_assignments aa
         JOIN assets a ON aa.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         WHERE aa.status = 'active'
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR aa.department_id = $2)`,
        filterParams
      ),
      pool.query(
        `SELECT COUNT(ir.id) AS count
         FROM issue_reports ir
         JOIN assets a ON ir.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON ir.reported_by = u.id
         LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.status = 'active'
         WHERE LOWER(ir.issue_type) = 'lost'
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR COALESCE(aa.department_id, u.department_id) = $2)`,
        filterParams
      ),
      pool.query(
        `SELECT COUNT(ir.id) AS count
         FROM issue_reports ir
         JOIN assets a ON ir.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON ir.reported_by = u.id
         LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.status = 'active'
         WHERE LOWER(ir.issue_type) = 'damaged'
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR COALESCE(aa.department_id, u.department_id) = $2)`,
        filterParams
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
                sd.name AS department_name,
                'reserved' AS pool_type
         FROM assets a
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN departments sd ON a.store_department_id = sd.id
         WHERE a.status = 'available'
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR a.store_department_id = $2)
         ORDER BY sd.name NULLS LAST, ac.name, a.name`,
        filterParams
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
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR aa.department_id = $2)
         ORDER BY d.name NULLS LAST, ac.name, a.name`,
        filterParams
      );
      items = itemsResult.rows;
    } else if (view === 'lost' || view === 'damaged') {
      const itemsResult = await pool.query(
        `SELECT ir.id, ir.report_number, ir.status AS report_status, ir.created_at,
                a.id AS asset_id, a.name, a.serial_number, a.brand, a.model, a.condition,
                ac.name AS category_name,
                u.name AS reporter_name,
                COALESCE(ad.name, rd.name) AS department_name,
                emp.name AS assigned_to_name,
                ir.description,
                ir.resolution_outcome
         FROM issue_reports ir
         JOIN assets a ON ir.asset_id = a.id
         JOIN asset_categories ac ON a.category_id = ac.id
         LEFT JOIN users u ON ir.reported_by = u.id
         LEFT JOIN departments rd ON u.department_id = rd.id
         LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.status = 'active'
         LEFT JOIN users emp ON aa.assigned_to = emp.id
         LEFT JOIN departments ad ON aa.department_id = ad.id
         WHERE LOWER(ir.issue_type) = $3
           AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
           AND ($2::integer IS NULL OR COALESCE(aa.department_id, u.department_id) = $2)
         ORDER BY ir.created_at DESC NULLS LAST`,
        [ownerDeptId, locationDeptId, view]
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
       WHERE aa.status = 'active'
         AND ($1::integer IS NULL OR ac.specialist_department_id = $1)
         AND ($2::integer IS NULL OR aa.department_id = $2)
       GROUP BY ac.id, ac.name
       ORDER BY ac.name`,
      filterParams
    );

    res.json({
      department: locationDeptName || (isGlobalViewer ? 'All departments' : req.user.department),
      managed_categories_only: Boolean(ownerDeptId),
      scope: locationDeptId ? 'department' : 'all',
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

// Create asset (inventory or department head for their store)
router.post('/', authenticateToken, authorizeRoles('inventory', 'head'), async (req, res) => {
  try {
    const {
      name, category, serial_number, model, brand, purchase_date, purchase_cost,
      condition, notes, store_department, quantity, current_location,
    } = req.body;
    
    const categoryResult = await pool.query(
      'SELECT id, specialist_department_id FROM asset_categories WHERE name = $1',
      [category]
    );
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    let storeDepartmentName = store_department;
    const userRole = req.user.role === 'specialist' ? 'head' : req.user.role === 'procurement' ? 'inventory' : req.user.role;
    if (userRole === 'head') {
      storeDepartmentName = req.user.department;
      const userDept = await pool.query('SELECT department_id FROM users WHERE id = $1', [req.user.id]);
      const deptId = userDept.rows[0]?.department_id;
      if (!deptId || categoryResult.rows[0].specialist_department_id !== deptId) {
        return res.status(403).json({ error: 'You can only add assets in categories managed by your department' });
      }
    }

    if (!storeDepartmentName) {
      return res.status(400).json({ error: 'Belonging department is required for all assets' });
    }
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Asset name is required' });
    }

    const sd = await pool.query('SELECT id FROM departments WHERE name = $1', [storeDepartmentName]);
    if (!sd.rows.length) return res.status(400).json({ error: 'Invalid belonging department' });
    const storeDeptId = sd.rows[0].id;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const location = current_location || 'Inventory Store';
    const created = [];

    for (let i = 0; i < qty; i += 1) {
      let serial = serial_number || null;
      if (qty > 1 && serial_number) {
        serial = `${serial_number}${qty === 1 ? '' : `-${String(i + 1).padStart(2, '0')}`}`;
      }
      const result = await pool.query(
        `INSERT INTO assets
          (name, category_id, serial_number, model, brand, purchase_date, purchase_cost, condition, notes, store_department_id, current_location, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available')
         RETURNING *`,
        [
          qty > 1 ? `${name} (${i + 1}/${qty})` : name,
          categoryResult.rows[0].id,
          serial,
          model || null,
          brand || null,
          purchase_date || null,
          purchase_cost || null,
          condition || 'good',
          notes || null,
          storeDeptId,
          location,
        ]
      );
      created.push(result.rows[0]);
    }

    res.status(201).json(qty === 1 ? created[0] : { created: created.length, assets: created });
  } catch (error) {
    console.error('Create asset error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: error.message || 'Server error' });
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
