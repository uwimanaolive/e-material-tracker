import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.*, d.name as specialist_department_name 
       FROM asset_categories ac 
       LEFT JOIN departments d ON ac.specialist_department_id = d.id 
       ORDER BY ac.name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get category by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ac.*, d.name as specialist_department_name 
       FROM asset_categories ac 
       LEFT JOIN departments d ON ac.specialist_department_id = d.id 
       WHERE ac.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category (procurement only)
router.post('/', authenticateToken, authorizeRoles('procurement'), async (req, res) => {
  try {
    const { name, description, specialist_department } = req.body;
    
    let specialistId = null;
    if (specialist_department) {
      const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [specialist_department]);
      if (deptResult.rows.length > 0) {
        specialistId = deptResult.rows[0].id;
      }
    }
    
    const result = await pool.query(
      'INSERT INTO asset_categories (name, description, specialist_department_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, specialistId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category
router.put('/:id', authenticateToken, authorizeRoles('procurement'), async (req, res) => {
  try {
    const { name, description, specialist_department } = req.body;
    
    let specialistId = null;
    if (specialist_department) {
      const deptResult = await pool.query('SELECT id FROM departments WHERE name = $1', [specialist_department]);
      if (deptResult.rows.length > 0) {
        specialistId = deptResult.rows[0].id;
      }
    }
    
    const result = await pool.query(
      'UPDATE asset_categories SET name = $1, description = $2, specialist_department_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, description, specialistId, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
