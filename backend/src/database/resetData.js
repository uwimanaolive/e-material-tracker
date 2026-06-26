import pool from '../config/database.js';

/**
 * Clears all workflow/transaction data.
 * Keeps: users, departments, roles, categories, department_categories, sample assets (store).
 */
async function resetData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Resetting transactional data...');

    await client.query(`
      TRUNCATE TABLE
        notifications,
        issue_timeline,
        gate_pass_timeline,
        request_timeline,
        assignment_history,
        asset_movements,
        inventory_transactions,
        asset_request_owner_approvals,
        asset_request_items,
        asset_requests,
        asset_assignments,
        gate_passes,
        issue_reports
      RESTART IDENTITY CASCADE
    `);

    // Reset all assets to available in procurement store
    await client.query(`
      UPDATE assets SET
        status = 'available',
        condition = CASE WHEN condition IN ('fair','poor') THEN condition ELSE 'good' END,
        current_location = 'Procurement Store',
        store_department_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Demo assignments so employees can test gate pass & issue reports
    const demoAssignments = [
      { serial: 'MBP-001', username: 'olive', head: 'bob', dept: 'Finance' },
      { serial: 'LTP-004', username: 'espoire', head: 'kevin', dept: 'ICT' },
      { serial: 'ODK-011', username: 'olive', head: 'bob', dept: 'Finance' },
    ];

    for (const a of demoAssignments) {
      const asset = await client.query('SELECT id FROM assets WHERE serial_number = $1', [a.serial]);
      const user = await client.query('SELECT id FROM users WHERE username = $1', [a.username]);
      const head = await client.query('SELECT id FROM users WHERE username = $1', [a.head]);
      const dept = await client.query('SELECT id FROM departments WHERE name = $1', [a.dept]);
      if (asset.rows.length && user.rows.length && dept.rows.length) {
        await client.query(
          `INSERT INTO asset_assignments (asset_id, assigned_to, assigned_by, department_id, status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [asset.rows[0].id, user.rows[0].id, head.rows[0].id, dept.rows[0].id]
        );
        await client.query(
          `UPDATE assets SET status = 'assigned', current_location = $1 WHERE id = $2`,
          [a.dept, asset.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Data reset complete. Users, departments, and sample store inventory preserved.');
    console.log('Demo assignments: olive (MacBook + Desk), espoire (ThinkPad)');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

resetData();
