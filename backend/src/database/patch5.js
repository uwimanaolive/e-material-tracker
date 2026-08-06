import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

/** Critical schema + roles + users — runs first, always safe */
async function applyCritical(client) {
  await client.query(`
    INSERT INTO roles (name, description) VALUES
      ('inventory', 'Inventory department — manages assets and categories'),
      ('hse', 'Health, Safety & Environment reviewer'),
      ('super_admin', 'System super administrator')
    ON CONFLICT (name) DO NOTHING
  `);

  const invRole = await client.query(`SELECT id FROM roles WHERE name = 'inventory'`);
  const procRole = await client.query(`SELECT id FROM roles WHERE name = 'procurement'`);
  if (procRole.rows.length && invRole.rows.length) {
    await client.query('UPDATE users SET role_id = $1 WHERE role_id = $2', [invRole.rows[0].id, procRole.rows[0].id]);
    await client.query(`DELETE FROM roles WHERE name = 'procurement'`);
  }

  await client.query(`
    INSERT INTO departments (name, description) VALUES ('HSE', 'Health, Safety & Environment Department')
    ON CONFLICT (name) DO NOTHING
  `);
  await client.query(`
    UPDATE departments SET name = 'Inventory', description = 'Inventory Department' WHERE name = 'Procurement'
  `);

  for (const table of ['asset_requests', 'gate_passes', 'issue_reports']) {
    await client.query(`UPDATE ${table} SET status = 'pending_inventory' WHERE status IN ('pending_procurement', 'specialist_approved')`);
  }
  await client.query(`
    UPDATE asset_requests SET status = 'pending_dept_assignment'
    WHERE status = 'pending_inventory'
      AND id NOT IN (SELECT DISTINCT request_id FROM asset_request_items WHERE COALESCE(fulfilled_quantity, 0) > 0)
  `);

  await client.query(`ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS no_return BOOLEAN DEFAULT false`);
  await client.query(`UPDATE assets SET current_location = 'Inventory Store' WHERE current_location = 'Procurement Store'`);

  const depts = await client.query('SELECT id, name FROM departments');
  const deptIds = Object.fromEntries(depts.rows.map((d) => [d.name, d.id]));
  const invDeptId = deptIds['Inventory'] || deptIds['Procurement'];
  if (invDeptId) {
    await client.query('UPDATE assets SET store_department_id = $1 WHERE store_department_id IS NULL', [invDeptId]);
  }

  const hseRole = await client.query(`SELECT id FROM roles WHERE name = 'hse'`);
  const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'super_admin'`);
  const hash = await bcrypt.hash('Hse@2026!', 10);
  const adminHash = await bcrypt.hash('SuperAdmin@2026!', 10);

  await client.query(
    `INSERT INTO users (username, password_hash, name, email, role_id, department_id, is_active)
     VALUES ('hse.admin', $1, 'HSE Administrator', 'hse@company.com', $2, $3, true)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id,
       department_id = EXCLUDED.department_id, is_active = true`,
    [hash, hseRole.rows[0].id, deptIds['HSE']]
  );
  await client.query(
    `INSERT INTO users (username, password_hash, name, email, role_id, department_id, is_active)
     VALUES ('superadmin', $1, 'System Super Admin', 'admin@company.com', $2, $3, true)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id,
       department_id = EXCLUDED.department_id, is_active = true`,
    [adminHash, adminRole.rows[0].id, deptIds['Administration']]
  );
}

const NEW_CATEGORIES = [
  { name: 'Computer Desktop', owner: 'ICT' },
  { name: 'Computer Laptop', owner: 'ICT' },
  { name: 'Computer Workstation', owner: 'ICT' },
  { name: 'Computer Server', owner: 'ICT' },
  { name: 'Computer Accessory', owner: 'ICT' },
  { name: 'Computer Screen', owner: 'ICT' },
  { name: 'Printer', owner: 'ICT' },
  { name: 'Scanner', owner: 'ICT' },
  { name: 'Copier', owner: 'ICT' },
  { name: 'Telephone', owner: 'ICT' },
  { name: 'Communication', owner: 'ICT' },
  { name: 'Furniture', owner: 'Facilities' },
  { name: 'Electrical', owner: 'Facilities' },
  { name: 'Security', owner: 'Administration' },
  { name: 'Vehicle', owner: 'Logistics' },
  { name: 'Tools', owner: 'Logistics' },
  { name: 'Others', owner: 'Administration' },
];

const OLD_TO_NEW = {
  Computers: 'Computer Laptop',
  Printers: 'Printer',
  'Network Equipment': 'Communication',
  Vehicles: 'Vehicle',
};

async function loadDeptIds(client) {
  const depts = await client.query('SELECT id, name FROM departments');
  return Object.fromEntries(depts.rows.map((d) => [d.name, d.id]));
}

async function ensureCategory(client, name, ownerDeptName, deptIds) {
  let r = await client.query('SELECT id FROM asset_categories WHERE name = $1', [name]);
  if (r.rows.length) return r.rows[0].id;
  r = await client.query(
    'INSERT INTO asset_categories (name, description, specialist_department_id) VALUES ($1, $2, $3) RETURNING id',
    [name, name, deptIds[ownerDeptName]]
  );
  return r.rows[0].id;
}

async function remapCategory(client, fromId, toId) {
  if (fromId === toId) return;
  await client.query('UPDATE assets SET category_id = $1 WHERE category_id = $2', [toId, fromId]);
  await client.query('UPDATE asset_request_items SET category_id = $1 WHERE category_id = $2', [toId, fromId]);
  await client.query('DELETE FROM department_categories WHERE category_id = $1', [fromId]);
  await client.query('DELETE FROM asset_categories WHERE id = $1', [fromId]);
}

async function applyCategories(client) {
  let deptIds = await loadDeptIds(client);

  for (const cat of NEW_CATEGORIES) {
    await ensureCategory(client, cat.name, cat.owner, deptIds);
  }
  deptIds = await loadDeptIds(client);

  for (const [oldName, newName] of Object.entries(OLD_TO_NEW)) {
    const oldCat = await client.query('SELECT id FROM asset_categories WHERE name = $1', [oldName]);
    if (!oldCat.rows.length) continue;
    const owner = NEW_CATEGORIES.find((c) => c.name === newName)?.owner || 'Administration';
    const newId = await ensureCategory(client, newName, owner, deptIds);
    await remapCategory(client, oldCat.rows[0].id, newId);
  }

  const othersId = (await client.query(`SELECT id FROM asset_categories WHERE name = 'Others'`)).rows[0]?.id;
  const newNames = NEW_CATEGORIES.map((c) => c.name);
  const existing = await client.query('SELECT id, name FROM asset_categories');
  for (const cat of existing.rows) {
    if (newNames.includes(cat.name)) continue;
    await remapCategory(client, cat.id, othersId);
  }

  deptIds = await loadDeptIds(client);
  const categoryIds = {};
  for (const cat of NEW_CATEGORIES) {
    categoryIds[cat.name] = (await client.query('SELECT id FROM asset_categories WHERE name = $1', [cat.name])).rows[0].id;
    await client.query(
      `UPDATE asset_categories SET description = $1, specialist_department_id = $2 WHERE name = $3`,
      [cat.name, deptIds[cat.owner], cat.name]
    );
  }

  const allDepts = await client.query('SELECT id, name FROM departments');
  for (const dept of allDepts.rows) {
    if (['Inventory', 'HSE'].includes(dept.name)) continue;
    for (const cat of NEW_CATEGORIES) {
      await client.query(
        'INSERT INTO department_categories (department_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [dept.id, categoryIds[cat.name]]
      );
    }
  }
}

async function patch5() {
  const client = await pool.connect();
  try {
    console.log('Applying patch v5...');
    await client.query('BEGIN');
    await applyCritical(client);
    await applyCategories(client);
    await client.query('COMMIT');
    console.log('Patch v5 applied successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Patch v5 FAILED:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

patch5()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
