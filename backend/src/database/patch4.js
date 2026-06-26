import pool from '../config/database.js';

async function patch4() {
  console.log('Applying patch v4 (asset selection + gate pass tokens)...');

  await pool.query(`
    ALTER TABLE asset_request_items
      ADD COLUMN IF NOT EXISTS selected_asset_ids INTEGER[] DEFAULT '{}'
  `);

  await pool.query(`
    ALTER TABLE gate_passes
      ADD COLUMN IF NOT EXISTS pass_token VARCHAR(64) UNIQUE,
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
  `);

  await pool.query(`
    UPDATE gate_passes SET pass_token = gen_random_uuid()::text
    WHERE status = 'active' AND pass_token IS NULL
  `);

  console.log('Patch v4 applied!');
  process.exit(0);
}

patch4().catch((e) => { console.error(e); process.exit(1); });
