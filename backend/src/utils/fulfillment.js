const INVENTORY_STORE = 'Inventory Store';

/**
 * Create assignment + inventory audit from approved request
 */
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
  const assetResult = await client.query(
    'SELECT status, name FROM assets WHERE id = $1 FOR UPDATE',
    [assetId]
  );

  if (!assetResult.rows.length) {
    throw new Error(`Asset ${assetId} not found`);
  }

  if (assetResult.rows[0].status !== 'available') {
    throw new Error(`Asset "${assetResult.rows[0].name}" is not available`);
  }

  const employee = await client.query(
    `SELECT id, department_id FROM users WHERE id = $1 AND is_active = true`,
    [assignedTo]
  );

  if (!employee.rows.length) {
    throw new Error('Employee not found or inactive');
  }

  if (employee.rows[0].department_id !== departmentId) {
    throw new Error('Employee must belong to requesting department');
  }

  const assignmentResult = await client.query(
    `INSERT INTO asset_assignments
      (asset_id, assigned_to, assigned_by, department_id, request_id, request_item_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [assetId, assignedTo, assignedBy, departmentId, requestId, requestItemId, notes || null]
  );

  const assignmentId = assignmentResult.rows[0].id;

  await client.query(
    `UPDATE assets
     SET status = 'assigned', current_location = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [departmentName, assetId]
  );

  await client.query(
    `INSERT INTO assignment_history
      (assignment_id, asset_id, from_user, to_user, performed_by, action, notes)
     VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
    [assignmentId, assetId, assignedTo, assignedBy, 'Assigned from request', notes || null]
  );

  await client.query(
    `INSERT INTO inventory_transactions
      (asset_id, transaction_type, from_location, to_location, performed_by, notes)
     VALUES ($1, 'assignment', $2, $3, $4, $5)`,
    [assetId, INVENTORY_STORE, departmentName, assignedBy, notes || `Request #${requestId}`]
  );

  return assignmentResult.rows[0];
}

/**
 * Get available assets for request item (matches store pool logic)
 */
export async function getAvailableAssetsForItem(
  client,
  categoryId,
  departmentId,
  ownerDeptId = null
) {
  const result = await client.query(
    `SELECT a.id, a.name, a.serial_number, a.condition, a.brand, a.model,
            ac.name AS category_name,
            sd.name AS store_department_name
     FROM assets a
     JOIN asset_categories ac ON a.category_id = ac.id
     LEFT JOIN departments sd ON a.store_department_id = sd.id
     WHERE a.category_id = $1
       AND a.status = 'available'
       AND a.store_department_id IS NOT NULL
       AND (
         $2::integer IS NULL
         OR a.store_department_id = $2
         OR ac.specialist_department_id = $2
       )
     ORDER BY
       CASE WHEN a.store_department_id = $3 THEN 0 ELSE 1 END,
       a.name`,
    [categoryId, ownerDeptId, departmentId]
  );

  return result.rows;
}

async function getOwnerDeptIdsForRequest(client, requestId) {
  const result = await client.query(
    `SELECT DISTINCT COALESCE(ac.specialist_department_id, ar.department_id) AS owner_dept_id
     FROM asset_request_items ari
     JOIN asset_requests ar ON ar.id = ari.request_id
     JOIN asset_categories ac ON ari.category_id = ac.id
     WHERE ari.request_id = $1`,
    [requestId]
  );
  return result.rows.map((r) => r.owner_dept_id);
}

async function getSubmittedOwnerDeptIds(client, requestId, performingDeptId) {
  const result = await client.query(
    `SELECT DISTINCT u.department_id
     FROM request_timeline rt
     JOIN users u ON rt.actor_id = u.id
     WHERE rt.request_id = $1
       AND rt.action LIKE 'Department assigned assets%'`,
    [requestId]
  );
  const ids = new Set(result.rows.map((r) => r.department_id));
  if (performingDeptId) ids.add(performingDeptId);
  return ids;
}

/**
 * Department assigns assets before inventory approval
 */
export async function deptAssignRequest(
  client,
  requestId,
  fulfillments,
  performedBy,
  role,
  notes
) {
  const reqResult = await client.query(
    `SELECT ar.*, d.name AS department_name
     FROM asset_requests ar
     JOIN departments d ON ar.department_id = d.id
     WHERE ar.id = $1
     FOR UPDATE`,
    [requestId]
  );

  if (!reqResult.rows.length) {
    throw new Error('Request not found');
  }

  const request = reqResult.rows[0];

  if (request.status !== 'pending_dept_assignment') {
    throw new Error(`Request status is ${request.status}`);
  }

  if (!request.assigned_to) {
    throw new Error('No employee assigned on request');
  }

  const performerDept = await client.query(
    'SELECT department_id FROM users WHERE id = $1',
    [performedBy]
  );
  const performingDeptId = performerDept.rows[0]?.department_id;
  if (!performingDeptId) {
    throw new Error('Could not determine your department');
  }

  const result = await applyFulfillments(
    client,
    request,
    fulfillments,
    performedBy,
    performingDeptId,
    notes
  );

  const ownerDeptIds = await getOwnerDeptIdsForRequest(client, requestId);
  const submittedDeptIds = await getSubmittedOwnerDeptIds(client, requestId, performingDeptId);
  const allDeptsSubmitted = ownerDeptIds.every((id) => submittedDeptIds.has(id));

  if (allDeptsSubmitted) {
    await client.query(
      `UPDATE asset_requests
       SET status = 'pending_inventory', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );
  }

  return {
    totalAssigned: result.totalAssigned,
    actionMsg: allDeptsSubmitted
      ? 'Department assigned assets — forwarded to inventory'
      : 'Department assigned assets — awaiting other owning departments',
    forwardedToInventory: allDeptsSubmitted,
  };
}

/**
 * Inventory approval
 */
export async function inventoryConfirmRequest(
  client,
  requestId,
  action,
  performedBy,
  notes
) {
  const req = await client.query(
    'SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE',
    [requestId]
  );

  if (!req.rows.length) {
    throw new Error('Request not found');
  }

  const request = req.rows[0];
  if (!['pending_inventory', 'pending_procurement'].includes(request.status)) {
    throw new Error(`Request is not awaiting inventory approval (status: ${request.status})`);
  }

  if (action === 'reject') {
    await client.query(
      `UPDATE asset_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [requestId]
    );
    return { newStatus: 'rejected', actionMsg: 'Inventory rejected request' };
  }

  const check = await client.query(
    `SELECT COUNT(*) FILTER (WHERE COALESCE(fulfilled_quantity, 0) < quantity) AS incomplete
     FROM asset_request_items
     WHERE request_id = $1`,
    [requestId]
  );

  const complete = parseInt(check.rows[0].incomplete, 10) === 0;
  const newStatus = complete ? 'fulfilled' : 'partially_fulfilled';

  await client.query(
    `UPDATE asset_requests
     SET status = $1,
         fulfilled_at = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE fulfilled_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [newStatus, complete, requestId]
  );

  return {
    newStatus,
    actionMsg: complete
      ? 'Inventory confirmed request fulfilled'
      : 'Inventory confirmed partially fulfilled',
  };
}

async function applyFulfillments(
  client,
  request,
  fulfillments,
  performedBy,
  performingDeptId,
  notes
) {
  const items = await client.query(
    'SELECT ari.*, ac.specialist_department_id FROM asset_request_items ari JOIN asset_categories ac ON ari.category_id = ac.id WHERE ari.request_id = $1',
    [request.id]
  );

  const itemsMap = Object.fromEntries(items.rows.map((item) => [item.id, item]));
  let totalAssigned = 0;

  for (const f of fulfillments || []) {
    const item = itemsMap[f.request_item_id];
    if (!item) {
      throw new Error('Invalid request item');
    }

    const ownerDeptId = item.specialist_department_id || request.department_id;
    if (ownerDeptId !== performingDeptId) {
      throw new Error('You can only assign assets for categories owned by your department');
    }

    const assetIds = f.asset_ids || [];

    for (const assetId of assetIds) {
      const asset = await client.query(
        'SELECT category_id FROM assets WHERE id = $1',
        [assetId]
      );

      if (!asset.rows.length || asset.rows[0].category_id !== item.category_id) {
        throw new Error('Asset category mismatch');
      }

      await assignAssetFromRequest(client, {
        assetId,
        assignedTo: request.assigned_to,
        assignedBy: performedBy,
        departmentId: request.department_id,
        departmentName: request.department_name,
        requestId: request.id,
        requestItemId: item.id,
        notes,
      });

      totalAssigned++;
    }

    if (assetIds.length > 0) {
      await client.query(
        `UPDATE asset_request_items
         SET fulfilled_quantity = COALESCE(fulfilled_quantity, 0) + $1
         WHERE id = $2`,
        [assetIds.length, item.id]
      );
    }
  }

  return { totalAssigned };
}

/** Legacy compatibility */
export async function fulfillRequest(client, requestId, fulfillments, performedBy, role, notes) {
  return deptAssignRequest(client, requestId, fulfillments, performedBy, role, notes);
}
