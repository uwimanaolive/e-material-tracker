import pool from '../config/database.js';

async function check() {
  const noReturn = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='gate_passes' AND column_name='no_return'"
  );
  const roles = await pool.query('SELECT name FROM roles ORDER BY name');
  const users = await pool.query(
    `SELECT u.username, r.name as role, u.is_active FROM users u JOIN roles r ON u.role_id=r.id WHERE u.username IN ('hse.admin','superadmin')`
  );
  const depts = await pool.query("SELECT name FROM departments WHERE name IN ('HSE','Inventory','Procurement') ORDER BY name");
  console.log('no_return column:', noReturn.rows);
  console.log('roles:', roles.rows.map((r) => r.name));
  console.log('users:', users.rows);
  console.log('depts:', depts.rows.map((r) => r.name));
  process.exit(0);
}
check().catch((e) => { console.error(e); process.exit(1); });
