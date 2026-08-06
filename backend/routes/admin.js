import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/stats', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const [users, depts, cats, assets] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM departments'),
      pool.query('SELECT COUNT(*) FROM asset_categories'),
      pool.query('SELECT COUNT(*) FROM assets'),
    ]);
    res.json({
      total_users: parseInt(users.rows[0].count),
      total_departments: parseInt(depts.rows[0].count),
      total_categories: parseInt(cats.rows[0].count),
      total_assets: parseInt(assets.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// HR user management
router.get('/hr-users', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, d.name as department, u.is_active, u.created_at
       FROM users u JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE r.name = 'hr' ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/hr-users', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, username, password, email, department } = req.body;
    const roleResult = await pool.query(`SELECT id FROM roles WHERE name = 'hr'`);
    const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [department || 'Human Resources']);
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, username, password_hash, email, role_id, department_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, username, email',
      [name, username, hash, email, roleResult.rows[0].id, deptResult.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/hr-users/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, email, department, is_active, password } = req.body;
    let query = 'UPDATE users SET name = $1, email = $2';
    const params = [name, email];
    let n = 2;
    if (department) {
      const d = await pool.query('SELECT id FROM departments WHERE name = $1', [department]);
      if (d.rows.length) { n++; query += `, department_id = $${n}`; params.push(d.rows[0].id); }
    }
    if (typeof is_active === 'boolean') { n++; query += `, is_active = $${n}`; params.push(is_active); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      n++; query += `, password_hash = $${n}`; params.push(hash);
    }
    n++; query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${n} RETURNING id, name, username, email`;
    params.push(req.params.id);
    const result = await pool.query(query, params);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Departments (super admin)
router.post('/departments', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Department already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/departments/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'UPDATE departments SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Categories (super admin)
router.post('/categories', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, description, specialist_department } = req.body;
    let specialistId = null;
    if (specialist_department) {
      const d = await pool.query('SELECT id FROM departments WHERE name = $1', [specialist_department]);
      if (d.rows.length) specialistId = d.rows[0].id;
    }
    const result = await pool.query(
      'INSERT INTO asset_categories (name, description, specialist_department_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, specialistId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

router.put('/categories/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, description, specialist_department } = req.body;
    let specialistId = null;
    if (specialist_department) {
      const d = await pool.query('SELECT id FROM departments WHERE name = $1', [specialist_department]);
      if (d.rows.length) specialistId = d.rows[0].id;
    }
    const result = await pool.query(
      'UPDATE asset_categories SET name = $1, description = $2, specialist_department_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, description, specialistId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

export default router;
