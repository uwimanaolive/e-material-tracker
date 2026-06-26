/** Create assignment + inventory audit from an approved request */
export async function assignAssetFromRequest(client, {
  assetId,
  assignedTo,
  assignedBy,
  departmentId,
  departmentName,
  requestId,
  requestItemId,
  notes,
}) {
  const assetResult = await client.query('SELECT status, name FROM assets WHERE id = $1 FOR UPDATE', [assetId]);
  if (!assetResult.rows.length) throw new Error(`Asset ${assetId} not found`);
  if (assetResult.rows[0].status !== 'available') {
    throw new Error(`Asset "${assetResult.rows[0].name}" is not available`);
  }

  const assignee = await client.query(
    'SELECT id, department_id FROM users WHERE id = $1 AND is_active = true',
    [assignedTo]
  );
  if (!assignee.rows.length) throw new Error('Assignee not found or inactive');
  if (assignee.rows[0].department_id !== departmentId) {
    throw new Error('Assignee must belong to the requesting department');
  }

  const assignmentResult = await client.query(
    `INSERT INTO asset_assignments
      (asset_id, assigned_to, assigned_by, department_id, request_id, request_item_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [assetId, assignedTo, assignedBy, departmentId, requestId, requestItemId, notes]
  );
  const assignmentId = assignmentResult.rows[0].id;

  await client.query(
    'UPDATE assets SET status = $1, current_location = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    ['assigned', departmentName, assetId]
  );

  await client.query(
    `INSERT INTO assignment_history (assignment_id, asset_id, from_user, to_user, performed_by, action, notes)
     VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
    [assignmentId, assetId, assignedTo, assignedBy, 'Assigned from request', notes]
  );

  await client.query(
    `INSERT INTO inventory_transactions (asset_id, transaction_type, from_location, to_location, performed_by, notes)
     VALUES ($1, 'assignment', 'Procurement Store', $2, $3, $4)`,
    [assetId, departmentName, assignedBy, notes || `Request #${requestId}`]
  );

  return assignmentResult.rows[0];
}

/** Available store assets for a request line item and department */
export async function getAvailableAssetsForItem(client, categoryId, departmentId) {
  const result = await client.query(
    `SELECT a.id, a.name, a.serial_number, a.brand, a.model, a.condition, ac.name as category_name,
      CASE WHEN a.store_department_id IS NULL THEN 'general' ELSE 'reserved' END as pool_type
     FROM assets a
     JOIN asset_categories ac ON a.category_id = ac.id
     LEFT JOIN department_categories dc ON dc.category_id = ac.id AND dc.department_id = $2
     WHERE a.category_id = $1
       AND a.status = 'available'
       AND (a.store_department_id IS NULL OR a.store_department_id = $2)
       AND (dc.id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM department_categories WHERE department_id = $2))
     ORDER BY a.name`,
    [categoryId, departmentId]
  );
  return result.rows;
}

/** Fulfill request: assign assets per line item */
export async function fulfillRequest(client, requestId, fulfillments, performedBy, role, notes) {
  const reqResult = await client.query(
    `SELECT ar.*, d.name as department_name
     FROM asset_requests ar
     JOIN departments d ON ar.department_id = d.id
     WHERE ar.id = $1 FOR UPDATE`,
    [requestId]
  );
  if (!reqResult.rows.length) throw new Error('Request not found');
  const request = reqResult.rows[0];

  if (request.status !== 'pending_procurement') {
    throw new Error(`Request cannot be fulfilled (status: ${request.status})`);
  }
  if (!request.assigned_to) {
    throw new Error('No assignee specified on this request');
  }

  const itemsResult = await client.query(
    'SELECT * FROM asset_request_items WHERE request_id = $1',
    [requestId]
  );
  const itemsById = Object.fromEntries(itemsResult.rows.map((i) => [i.id, i]));

  let effectiveFulfillments = fulfillments || [];
  const hasManual = effectiveFulfillments.some((f) => f.asset_ids?.length > 0);
  if (!hasManual) {
    effectiveFulfillments = itemsResult.rows
      .filter((i) => i.selected_asset_ids?.length > 0)
      .map((i) => ({ request_item_id: i.id, asset_ids: i.selected_asset_ids }));
  }

  let totalAssigned = 0;
  for (const f of effectiveFulfillments) {
    const item = itemsById[f.request_item_id];
    if (!item) throw new Error(`Invalid request item ${f.request_item_id}`);
    const assetIds = f.asset_ids || [];
    if (assetIds.length === 0) continue;

    const remaining = item.quantity - (item.fulfilled_quantity || 0);
    if (assetIds.length > remaining) {
      throw new Error(`Too many assets for item (max ${remaining} remaining)`);
    }

    for (const assetId of assetIds) {
      const assetCheck = await client.query(
        'SELECT category_id FROM assets WHERE id = $1',
        [assetId]
      );
      if (assetCheck.rows[0]?.category_id !== item.category_id) {
        throw new Error('Selected asset does not match requested category');
      }

      await assignAssetFromRequest(client, {
        assetId,
        assignedTo: request.assigned_to,
        assignedBy: performedBy,
        departmentId: request.department_id,
        departmentName: request.department_name,
        requestId,
        requestItemId: item.id,
        notes: notes || `Fulfilled via ${request.request_number}`,
      });
      totalAssigned++;
    }

    await client.query(
      'UPDATE asset_request_items SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + $1, asset_id = COALESCE(asset_id, $2) WHERE id = $3',
      [assetIds.length, assetIds[0], item.id]
    );
  }

  if (totalAssigned === 0) {
    throw new Error('Select at least one asset to assign');
  }

  const checkAll = await client.query(
    `SELECT COUNT(*) FILTER (WHERE COALESCE(fulfilled_quantity, 0) < quantity) as incomplete
     FROM asset_request_items WHERE request_id = $1`,
    [requestId]
  );
  const allFulfilled = parseInt(checkAll.rows[0].incomplete) === 0;
  const newStatus = allFulfilled ? 'fulfilled' : 'partially_fulfilled';

  await client.query(
    'UPDATE asset_requests SET status = $1, fulfilled_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE fulfilled_at END, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [newStatus, allFulfilled, requestId]
  );

  const assigneeName = await client.query('SELECT name FROM users WHERE id = $1', [request.assigned_to]);
  const actionMsg = allFulfilled
    ? `Procurement fulfilled — ${totalAssigned} asset(s) assigned to ${assigneeName.rows[0]?.name || 'employee'}`
    : `Procurement partially fulfilled — ${totalAssigned} asset(s) assigned`;

  return { totalAssigned, allFulfilled, newStatus, actionMsg };
}
