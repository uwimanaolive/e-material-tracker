import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding database...');
    
    // Insert roles
    const roles = [
      { name: 'employee', description: 'Regular employee' },
      { name: 'head', description: 'Department head/manager' },
      { name: 'specialist', description: 'Specialist department for approvals' },
      { name: 'procurement', description: 'Procurement department' },
      { name: 'hr', description: 'Human Resources - manages employees and departments' }
    ];
    
    const roleIds = {};
    for (const role of roles) {
      const result = await client.query(
        'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
        [role.name, role.description]
      );
      if (result.rows.length > 0) {
        roleIds[role.name] = result.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM roles WHERE name = $1', [role.name]);
        roleIds[role.name] = existing.rows[0].id;
      }
    }
    
    // Insert departments
    const departments = [
      { name: 'Finance', description: 'Finance Department' },
      { name: 'ICT', description: 'Information and Communication Technology' },
      { name: 'Facilities', description: 'Facilities Management' },
      { name: 'Administration', description: 'Administration Department' },
      { name: 'Logistics', description: 'Logistics and Transport' },
      { name: 'Procurement', description: 'Procurement Department' },
      { name: 'Human Resources', description: 'Human Resources Department' }
    ];
    
    const departmentIds = {};
    for (const dept of departments) {
      const result = await client.query(
        'INSERT INTO departments (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
        [dept.name, dept.description]
      );
      if (result.rows.length > 0) {
        departmentIds[dept.name] = result.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM departments WHERE name = $1', [dept.name]);
        departmentIds[dept.name] = existing.rows[0].id;
      }
    }
    
    // Insert asset categories with owning department
    const categories = [
      { name: 'Computers', description: 'Desktop and laptop computers', ownerDept: 'ICT' },
      { name: 'Printers', description: 'Printing equipment', ownerDept: 'ICT' },
      { name: 'Network Equipment', description: 'Routers, switches, and networking gear', ownerDept: 'ICT' },
      { name: 'Furniture', description: 'Office furniture and fixtures', ownerDept: 'Facilities' },
      { name: 'Vehicles', description: 'Company vehicles', ownerDept: 'Logistics' }
    ];
    
    const categoryIds = {};
    for (const cat of categories) {
      const ownerDeptId = departmentIds[cat.ownerDept] || null;
      const result = await client.query(
        'INSERT INTO asset_categories (name, description, specialist_department_id) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING id',
        [cat.name, cat.description, ownerDeptId]
      );
      if (result.rows.length > 0) {
        categoryIds[cat.name] = result.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM asset_categories WHERE name = $1', [cat.name]);
        categoryIds[cat.name] = existing.rows[0].id;
      }
    }
    
    // Insert users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = [
      { name: 'OLIVE UWIMANA', username: 'olive', role: 'employee', department: 'Finance' },
      { name: 'Bob Nkurunziza', username: 'bob', role: 'head', department: 'Finance' },
      { name: 'Kevin Mugisha', username: 'kevin', role: 'head', department: 'ICT' },
      { name: 'Espoire Rutagayingabo', username: 'espoire', role: 'employee', department: 'ICT' },
      { name: 'Chantal Uwimana', username: 'chantal', role: 'employee', department: 'Administration' },
      { name: 'Jean Claude', username: 'jean', role: 'head', department: 'Administration' },
      { name: 'Marie Claire', username: 'marie', role: 'head', department: 'Facilities' },
      { name: 'Peter Niyonzima', username: 'peter', role: 'head', department: 'Logistics' },
      { name: 'Alice Mukamana', username: 'alice', role: 'procurement', department: 'Procurement' },
      { name: 'Sarah HR Manager', username: 'sarah', role: 'hr', department: 'Human Resources' }
    ];
    
    const userIds = {};
    for (const user of users) {
      const result = await client.query(
        'INSERT INTO users (name, username, password_hash, role_id, department_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING RETURNING id',
        [user.name, user.username, passwordHash, roleIds[user.role], departmentIds[user.department]]
      );
      if (result.rows.length > 0) {
        userIds[user.username] = result.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM users WHERE username = $1', [user.username]);
        userIds[user.username] = existing.rows[0].id;
      }
    }
    
    // Insert assets — all available in procurement store (sample inventory)
    const assets = [
      { name: 'MacBook Pro 14"', category: 'Computers', serial: 'MBP-001', brand: 'Apple', model: 'MacBook Pro 14"', status: 'available', condition: 'good' },
      { name: 'Dell XPS 15', category: 'Computers', serial: 'DXP-002', brand: 'Dell', model: 'XPS 15', status: 'available', condition: 'good' },
      { name: 'HP EliteBook', category: 'Computers', serial: 'HEB-003', brand: 'HP', model: 'EliteBook 840', status: 'available', condition: 'good' },
      { name: 'Lenovo ThinkPad', category: 'Computers', serial: 'LTP-004', brand: 'Lenovo', model: 'ThinkPad X1', status: 'available', condition: 'good' },
      { name: 'HP LaserJet Pro', category: 'Printers', serial: 'HLP-006', brand: 'HP', model: 'LaserJet Pro M404', status: 'available', condition: 'good' },
      { name: 'Office Desk', category: 'Furniture', serial: 'ODK-011', brand: 'Steelcase', model: 'Gesture Desk', status: 'available', condition: 'good' },
      { name: 'Ergonomic Chair', category: 'Furniture', serial: 'ECH-012', brand: 'Herman Miller', model: 'Aeron Chair', status: 'available', condition: 'good' },
      { name: 'Toyota Hilux', category: 'Vehicles', serial: 'VTH-014', brand: 'Toyota', model: 'Hilux 4x4', status: 'available', condition: 'good' },
    ];
    
    for (const asset of assets) {
      await client.query(
        'INSERT INTO assets (name, category_id, serial_number, brand, model, status, condition, current_location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (serial_number) DO NOTHING',
        [asset.name, categoryIds[asset.category], asset.serial, asset.brand, asset.model, asset.status, asset.condition, 'Procurement Store']
      );
    }

    // Demo assignments for gate pass & issue report testing
    const assetIds = {};
    for (const serial of ['MBP-001', 'LTP-004', 'ODK-011']) {
      const r = await client.query('SELECT id FROM assets WHERE serial_number = $1', [serial]);
      if (r.rows.length) assetIds[serial] = r.rows[0].id;
    }
    const demoAssignments = [
      { asset: 'MBP-001', to: 'olive', by: 'bob', department: 'Finance' },
      { asset: 'LTP-004', to: 'espoire', by: 'kevin', department: 'ICT' },
      { asset: 'ODK-011', to: 'olive', by: 'bob', department: 'Finance' },
    ];
    for (const a of demoAssignments) {
      if (!assetIds[a.asset]) continue;
      await client.query(
        `INSERT INTO asset_assignments (asset_id, assigned_to, assigned_by, department_id, status)
         SELECT $1, u.id, h.id, d.id, 'active'
         FROM users u, users h, departments d
         WHERE u.username = $2 AND h.username = $3 AND d.name = $4
         ON CONFLICT DO NOTHING`,
        [assetIds[a.asset], a.to, a.by, a.department]
      );
      await client.query(`UPDATE assets SET status = 'assigned', current_location = $1 WHERE id = $2`, [a.department, assetIds[a.asset]]);
    }
    
    await client.query('COMMIT');
    console.log('Database seeded successfully!');
    console.log('\nDemo users (password: password123):');
    console.log('Employee: olive / Finance, espoire / ICT');
    console.log('Head: bob / Finance, kevin / ICT, marie / Facilities');
    console.log('Procurement: alice / Procurement');
    console.log('HR: sarah / Human Resources');
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
