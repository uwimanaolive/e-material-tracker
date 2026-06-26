import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, r.name as role, d.name as department, u.is_active, u.created_at 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       LEFT JOIN departments d ON u.department_id = d.id 
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get users by department
router.get('/department/:departmentId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, r.name as role, d.name as department 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.department_id = $1 AND u.is_active = true
       ORDER BY u.name`,
      [req.params.departmentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get department users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, r.name as role, d.name as department, u.is_active, u.created_at 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (HR or procurement)
router.post('/', authenticateToken, authorizeRoles('hr', 'procurement'), async (req, res) => {
  try {
    const { name, username, password, email, role, department } = req.body;
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
    const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [department]);
    
    if (roleResult.rows.length === 0 || deptResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid role or department' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (name, username, password_hash, email, role_id, department_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, username, email',
      [name, username, passwordHash, email, roleResult.rows[0].id, deptResult.rows[0].id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user (HR or procurement)
router.put('/:id', authenticateToken, authorizeRoles('hr', 'procurement'), async (req, res) => {
  try {
    const { name, email, role, department, is_active } = req.body;
    
    let query = 'UPDATE users SET name = $1, email = $2';
    const params = [name, email];
    let paramCount = 2;
    
    if (role) {
      paramCount++;
      const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
      if (roleResult.rows.length > 0) {
        query += `, role_id = $${paramCount}`;
        params.push(roleResult.rows[0].id);
      }
    }
    
    if (department) {
      paramCount++;
      const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [department]);
      if (deptResult.rows.length > 0) {
        query += `, department_id = $${paramCount}`;
        params.push(deptResult.rows[0].id);
      }
    }

    if (typeof is_active === 'boolean') {
      paramCount++;
      query += `, is_active = $${paramCount}`;
      params.push(is_active);
    }
    
    paramCount++;
    query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, name, username, email`;
    params.push(req.params.id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
