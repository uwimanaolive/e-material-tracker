import pool from '../config/database.js';

async function patch() {
  console.log('Applying database patches...');

  await pool.query(`
    ALTER TABLE issue_reports
    ADD COLUMN IF NOT EXISTS attachment VARCHAR(255);
  `);

  await pool.query(`
    ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS store_department_id INTEGER REFERENCES departments(id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS department_categories (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(department_id, category_id)
    );
  `);

  await pool.query(`
    INSERT INTO roles (name, description)
    VALUES ('hr', 'Human Resources - manages employees and departments')
    ON CONFLICT (name) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO departments (name, description)
    VALUES ('Human Resources', 'Human Resources Department')
    ON CONFLICT (name) DO NOTHING;
  `);

  // Link default categories to all operational departments
  const deptCatLinks = await pool.query(`
    SELECT d.id as dept_id, ac.id as cat_id
    FROM departments d
    CROSS JOIN asset_categories ac
    WHERE d.name IN ('Finance', 'ICT', 'Facilities', 'Administration', 'Logistics')
  `);

  for (const row of deptCatLinks.rows) {
    await pool.query(
      `INSERT INTO department_categories (department_id, category_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [row.dept_id, row.cat_id]
    );
  }

  // ICT/Facilities/Logistics get their specialist categories primarily
  await pool.query(`
    DELETE FROM department_categories dc
    USING departments d, asset_categories ac, departments spec
    WHERE dc.department_id = d.id
      AND dc.category_id = ac.id
      AND ac.specialist_department_id = spec.id
      AND d.id != ac.specialist_department_id
      AND d.name IN ('Finance', 'Administration');
  `);

  // Seed HR user if missing
  const hrRole = await pool.query("SELECT id FROM roles WHERE name = 'hr'");
  const hrDept = await pool.query("SELECT id FROM departments WHERE name = 'Human Resources'");
  if (hrRole.rows.length && hrDept.rows.length) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('password123', 10);
    await pool.query(
      `INSERT INTO users (name, username, password_hash, email, role_id, department_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      ['Sarah HR Manager', 'sarah', hash, 'sarah@assets.local', hrRole.rows[0].id, hrDept.rows[0].id]
    );
  }

  console.log('Database patches applied successfully!');
  process.exit(0);
}

patch().catch((err) => {
  console.error('Patch failed:', err);
  process.exit(1);
});
