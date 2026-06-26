import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();
const HR_ROLES = authorizeRoles('hr', 'procurement');

// Get all departments with staff counts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.is_active = true) as staff_count
      FROM departments d
      ORDER BY d.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get department staff
router.get('/:id/staff', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, r.name as role, d.name as department, u.is_active, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.department_id = $1
       ORDER BY u.name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get department staff error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories linked to a department
router.get('/:id/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.id, ac.name, ac.description
       FROM department_categories dc
       JOIN asset_categories ac ON dc.category_id = ac.id
       WHERE dc.department_id = $1
       ORDER BY ac.name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get department categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set categories for a department
router.put('/:id/categories', authenticateToken, HR_ROLES, async (req, res) => {
  const client = await pool.connect();
  try {
    const { category_ids } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM department_categories WHERE department_id = $1', [req.params.id]);
    for (const catId of category_ids || []) {
      await client.query(
        'INSERT INTO department_categories (department_id, category_id) VALUES ($1, $2)',
        [req.params.id, catId]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Department categories updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update department categories error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get department by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.is_active = true) as staff_count
       FROM departments d WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create department (HR or procurement)
router.post('/', authenticateToken, HR_ROLES, async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create department error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Department already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update department
router.put('/:id', authenticateToken, HR_ROLES, async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await pool.query(
      'UPDATE departments SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
