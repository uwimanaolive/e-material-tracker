import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

// Helper to add assignment history
const addAssignmentHistory = async (pool, assignmentId, assetId, fromUser, toUser, performedBy, action, notes) => {
  await pool.query(
    'INSERT INTO assignment_history (assignment_id, asset_id, from_user, to_user, performed_by, action, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [assignmentId, assetId, fromUser, toUser, performedBy, action, notes]
  );
};

// Department asset summary by category
router.get('/department/summary', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const departmentName = req.query.department || req.user.department;
    const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [departmentName]);
    if (!deptResult.rows.length) return res.status(400).json({ error: 'Department not found' });
    const deptId = deptResult.rows[0].id;

    const result = await pool.query(
      `SELECT ac.name as category_name, ac.id as category_id,
        COUNT(aa.id) as total_assigned,
        COUNT(aa.id) FILTER (WHERE a.status = 'assigned') as active_count,
        COUNT(aa.id) FILTER (WHERE a.condition IN ('fair', 'poor')) as needs_attention
       FROM asset_categories ac
       LEFT JOIN assets a ON a.category_id = ac.id
       LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.department_id = $1 AND aa.status = 'active'
       GROUP BY ac.id, ac.name
       HAVING COUNT(aa.id) > 0
       ORDER BY ac.name`,
      [deptId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all assignments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { department, status } = req.query;
    
    let query = `
      SELECT aa.*, 
             a.name as asset_name,
             a.serial_number,
             u.name as assigned_to_name,
             ub.name as assigned_by_name,
             d.name as department_name
      FROM asset_assignments aa
      LEFT JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.assigned_to = u.id
      LEFT JOIN users ub ON aa.assigned_by = ub.id
      LEFT JOIN departments d ON aa.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (department) {
      paramCount++;
      query += ` AND d.name = $${paramCount}`;
      params.push(department);
    }
    
    if (status) {
      paramCount++;
      query += ` AND aa.status = $${paramCount}`;
      params.push(status);
    }
    
    query += ' ORDER BY aa.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get assignments for current user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT aa.*, 
             a.name as asset_name,
             a.serial_number,
             a.condition as asset_condition,
             u.name as assigned_to_name,
             ub.name as assigned_by_name,
             d.name as department_name
      FROM asset_assignments aa
      LEFT JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.assigned_to = u.id
      LEFT JOIN users ub ON aa.assigned_by = ub.id
      LEFT JOIN departments d ON aa.department_id = d.id
      WHERE aa.assigned_to = $1 AND aa.status = 'active'
      ORDER BY aa.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get assignments by department
router.get('/department/:departmentId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT aa.*, 
             a.name as asset_name,
             a.serial_number,
             u.name as assigned_to_name,
             ub.name as assigned_by_name,
             d.name as department_name
      FROM asset_assignments aa
      LEFT JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.assigned_to = u.id
      LEFT JOIN users ub ON aa.assigned_by = ub.id
      LEFT JOIN departments d ON aa.department_id = d.id
      WHERE aa.department_id = $1 AND aa.status = 'active'
      ORDER BY aa.created_at DESC`,
      [req.params.departmentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get department assignments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get assignment by ID with history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT aa.*, 
             a.name as asset_name,
             a.serial_number,
             u.name as assigned_to_name,
             ub.name as assigned_by_name,
             d.name as department_name
      FROM asset_assignments aa
      LEFT JOIN assets a ON aa.asset_id = a.id
      LEFT JOIN users u ON aa.assigned_to = u.id
      LEFT JOIN users ub ON aa.assigned_by = ub.id
      LEFT JOIN departments d ON aa.department_id = d.id
      WHERE aa.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const assignment = result.rows[0];
    
    // Get history
    const historyResult = await pool.query(
      `SELECT ah.*, 
             uf.name as from_user_name,
             ut.name as to_user_name,
             ub.name as performed_by_name
       FROM assignment_history ah
       LEFT JOIN users uf ON ah.from_user = uf.id
       LEFT JOIN users ut ON ah.to_user = ut.id
       LEFT JOIN users ub ON ah.performed_by = ub.id
       WHERE ah.assignment_id = $1
       ORDER BY ah.created_at ASC`,
      [req.params.id]
    );
    assignment.history = historyResult.rows;
    
    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create assignment (head or procurement)
router.post('/', authenticateToken, authorizeRoles('head', 'inventory'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { asset_id, assigned_to, department, notes } = req.body;
    
    // Check if asset is available
    const assetResult = await client.query('SELECT status FROM assets WHERE id = $1', [asset_id]);
    if (assetResult.rows.length === 0) {
      throw new Error('Asset not found');
    }
    
    if (assetResult.rows[0].status !== 'available') {
      throw new Error('Asset is not available');
    }
    
    const userResult = await client.query('SELECT id FROM users WHERE id = $1', [assigned_to]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const deptResult = await client.query('SELECT id FROM departments WHERE name = $1', [department]);
    if (deptResult.rows.length === 0) {
      throw new Error('Department not found');
    }
    
    // Create assignment
    const assignmentResult = await client.query(
      'INSERT INTO asset_assignments (asset_id, assigned_to, assigned_by, department_id, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [asset_id, assigned_to, req.user.id, deptResult.rows[0].id, notes]
    );
    
    const assignmentId = assignmentResult.rows[0].id;
    
    // Update asset status
    await client.query('UPDATE assets SET status = $1, current_location = $2 WHERE id = $3', ['assigned', department]);
    
    // Add history
    await addAssignmentHistory(client, assignmentId, asset_id, null, assigned_to, req.user.id, 'Assigned', notes);
    
    await client.query('COMMIT');
    
    res.status(201).json(assignmentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create assignment error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Reassign asset (head only)
router.put('/:id/reassign', authenticateToken, authorizeRoles('head'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { assigned_to, notes } = req.body;
    
    const assignmentResult = await client.query('SELECT * FROM asset_assignments WHERE id = $1', [req.params.id]);
    if (assignmentResult.rows.length === 0) {
      throw new Error('Assignment not found');
    }
    
    const oldAssignment = assignmentResult.rows[0];
    
    const userResult = await client.query('SELECT id FROM users WHERE id = $1', [assigned_to]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    // Close old assignment
    await client.query('UPDATE asset_assignments SET status = $1 WHERE id = $2', ['returned', req.params.id]);
    
    // Add history for return
    await addAssignmentHistory(client, req.params.id, oldAssignment.asset_id, oldAssignment.assigned_to, null, req.user.id, 'Returned', 'Reassignment');
    
    // Create new assignment
    const newAssignmentResult = await client.query(
      'INSERT INTO asset_assignments (asset_id, assigned_to, assigned_by, department_id, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [oldAssignment.asset_id, assigned_to, req.user.id, oldAssignment.department_id, notes]
    );
    
    const newAssignmentId = newAssignmentResult.rows[0].id;
    
    // Add history for new assignment
    await addAssignmentHistory(client, newAssignmentId, oldAssignment.asset_id, oldAssignment.assigned_to, assigned_to, req.user.id, 'Reassigned', notes);
    
    await client.query('COMMIT');
    
    res.json(newAssignmentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reassign error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

// Return asset (head or procurement)
router.put('/:id/return', authenticateToken, authorizeRoles('head', 'inventory'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { notes } = req.body;
    
    const assignmentResult = await client.query('SELECT * FROM asset_assignments WHERE id = $1', [req.params.id]);
    if (assignmentResult.rows.length === 0) {
      throw new Error('Assignment not found');
    }
    
    const assignment = assignmentResult.rows[0];
    
    // Update assignment status
    await client.query('UPDATE asset_assignments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['returned', req.params.id]);
    
    // Update asset status
    await client.query('UPDATE assets SET status = $1, current_location = $2 WHERE id = $3', ['available', 'Inventory Store', assignment.asset_id]);
    
    // Add history
    await addAssignmentHistory(client, req.params.id, assignment.asset_id, assignment.assigned_to, null, req.user.id, 'Returned to Inventory', notes);
    
    await client.query('COMMIT');
    
    res.json({ message: 'Asset returned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Return asset error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
