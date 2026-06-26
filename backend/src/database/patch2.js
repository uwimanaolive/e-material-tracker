import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

async function patch2() {
  console.log('Applying workflow patch v2...');

  // Migrate statuses
  await pool.query(`UPDATE asset_requests SET status = 'pending_owner_dept' WHERE status = 'pending_specialist'`);
  await pool.query(`UPDATE gate_passes SET status = 'pending_owner_dept' WHERE status = 'pending_specialist'`);
  await pool.query(`UPDATE issue_reports SET status = 'pending_owner_dept' WHERE status = 'pending_specialist'`);
  await pool.query(`UPDATE asset_requests SET status = 'pending_procurement' WHERE status = 'specialist_approved'`);

  // Convert specialist users to head
  const headRole = await pool.query("SELECT id FROM roles WHERE name = 'head'");
  if (headRole.rows.length) {
    await pool.query(
      `UPDATE users SET role_id = $1
       WHERE role_id = (SELECT id FROM roles WHERE name = 'specialist')`,
      [headRole.rows[0].id]
    );
  }

  // Ensure HR role and user
  await pool.query(`
    INSERT INTO roles (name, description)
    VALUES ('hr', 'Human Resources')
    ON CONFLICT (name) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO departments (name, description)
    VALUES ('Human Resources', 'Human Resources Department')
    ON CONFLICT (name) DO NOTHING
  `);

  const hrRole = await pool.query("SELECT id FROM roles WHERE name = 'hr'");
  const hrDept = await pool.query("SELECT id FROM departments WHERE name = 'Human Resources'");
  if (hrRole.rows.length && hrDept.rows.length) {
    const hash = await bcrypt.hash('password123', 10);
    const existing = await pool.query("SELECT id FROM users WHERE username = 'sarah'");
    if (existing.rows.length) {
      await pool.query(
        `UPDATE users SET role_id = $1, department_id = $2, password_hash = $3, is_active = true WHERE username = 'sarah'`,
        [hrRole.rows[0].id, hrDept.rows[0].id, hash]
      );
    } else {
      await pool.query(
        `INSERT INTO users (name, username, password_hash, email, role_id, department_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Sarah HR Manager', 'sarah', hash, 'sarah@assets.local', hrRole.rows[0].id, hrDept.rows[0].id]
      );
    }
  }

  console.log('Workflow patch v2 applied!');
  process.exit(0);
}

patch2().catch((e) => { console.error(e); process.exit(1); });
