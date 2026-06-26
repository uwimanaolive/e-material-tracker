import pool from '../config/database.js';

async function patch3() {
  console.log('Applying fulfillment patch v3...');

  await pool.query(`
    ALTER TABLE asset_requests
      ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE asset_request_items
      ADD COLUMN IF NOT EXISTS fulfilled_quantity INTEGER DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE asset_assignments
      ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES asset_requests(id),
      ADD COLUMN IF NOT EXISTS request_item_id INTEGER REFERENCES asset_request_items(id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asset_request_owner_approvals (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
      owner_department_id INTEGER NOT NULL REFERENCES departments(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      UNIQUE(request_id, owner_department_id)
    )
  `);

  await pool.query(`
    ALTER TABLE issue_reports
      ADD COLUMN IF NOT EXISTS assessment_recommendation VARCHAR(50)
  `);

  // Migrate approved-but-unfulfilled requests back to pending_procurement for re-fulfillment
  await pool.query(`
    UPDATE asset_requests SET status = 'pending_procurement'
    WHERE status = 'approved'
      AND fulfilled_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM asset_assignments aa WHERE aa.request_id = asset_requests.id
      )
  `);

  console.log('Fulfillment patch v3 applied!');
  process.exit(0);
}

patch3().catch((e) => { console.error(e); process.exit(1); });
