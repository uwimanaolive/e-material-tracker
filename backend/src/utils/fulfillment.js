const INVENTORY_STORE = 'Inventory Store';

async function loadRequestLocked(client, requestId) {
  const reqResult = await client.query(
    'SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE',
    [requestId]
  );

  if (!reqResult.rows.length) {
    throw new Error('Request not found');
  }

  const request = reqResult.rows[0];
  const extras = await client.query(
    `SELECT d.name AS department_name, ae.name AS assignee_name
     FROM departments d
     LEFT JOIN users ae ON ae.id = $2
     WHERE d.id = $1`,
    [request.department_id, request.assigned_to]
  );

  return { ...request, ...extras.rows[0] };
}

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
  ownerDeptId = null,
  { requestId = null, requestItemId = null } = {}
) {
  const params = [categoryId, ownerDeptId];
  let assignedClause = 'AND a.status = \'available\'';

  if (requestId && requestItemId) {
    params.push(requestId, requestItemId);
    assignedClause = `AND (
      a.status = 'available'
      OR EXISTS (
        SELECT 1 FROM asset_assignments aa
        WHERE aa.asset_id = a.id
          AND aa.request_id = $3
          AND aa.request_item_id = $4
          AND aa.status = 'active'
      )
    )`;
  }

  const result = await client.query(
    `SELECT a.id, a.name, a.serial_number, a.condition, a.brand, a.model,
            ac.name AS category_name,
            sd.name AS store_department_name,
            a.status
     FROM assets a
     JOIN asset_categories ac ON a.category_id = ac.id
     LEFT JOIN departments sd ON a.store_department_id = sd.id
     WHERE a.category_id = $1
       AND a.store_department_id = $2
       ${assignedClause}
     ORDER BY a.name`,
    params
  );

  return result.rows;
}

async function getOwnedItemsForDept(client, requestId, performingDeptId) {
  const result = await client.query(
    `SELECT ari.*, ac.name AS category_name, ac.specialist_department_id
     FROM asset_request_items ari
     JOIN asset_categories ac ON ari.category_id = ac.id
     WHERE ari.request_id = $1
       AND ac.specialist_department_id = $2`,
    [requestId, performingDeptId]
  );
  return result.rows;
}

async function validateDeptFulfillments(
  client,
  request,
  fulfillments,
  performingDeptId,
  { replace = false } = {}
) {
  const ownedItems = await getOwnedItemsForDept(client, request.id, performingDeptId);
  if (!ownedItems.length) {
    throw new Error('Your department has no store items to assign on this request');
  }

  const fulfillmentMap = Object.fromEntries(
    (fulfillments || []).map((f) => [f.request_item_id, f.asset_ids || []])
  );

  for (const item of ownedItems) {
    const remaining = replace
      ? item.quantity
      : item.quantity - (item.fulfilled_quantity || 0);
    if (!replace && remaining <= 0) continue;

    const available = await getAvailableAssetsForItem(
      client,
      item.category_id,
      request.department_id,
      performingDeptId,
      replace ? { requestId: request.id, requestItemId: item.id } : {}
    );

    if (available.length === 0) {
      throw new Error(
        `No available "${item.category_name}" assets in your store. Add stock before assigning.`
      );
    }

    const selected = fulfillmentMap[item.id]?.length || 0;
    const required = Math.min(remaining, available.length);

    if (selected < required) {
      throw new Error(
        `Select ${required} "${item.category_name}" asset(s) from store for ${request.assignee_name || 'the employee'}`
      );
    }

    if (replace && selected > required) {
      throw new Error(
        `Select at most ${required} "${item.category_name}" asset(s) for this request line`
      );
    }
  }
}

async function releaseDeptStoreAssignments(client, requestId, performingDeptId, performedBy, notes) {
  const assignments = await client.query(
    `SELECT aa.id, aa.asset_id, aa.assigned_to, a.name AS asset_name
     FROM asset_assignments aa
     JOIN assets a ON aa.asset_id = a.id
     JOIN asset_request_items ari ON aa.request_item_id = ari.id
     JOIN asset_categories ac ON ari.category_id = ac.id
     WHERE aa.request_id = $1
       AND aa.status = 'active'
       AND a.store_department_id = $2
       AND ac.specialist_department_id = $2`,
    [requestId, performingDeptId]
  );

  const storeDept = await client.query('SELECT name FROM departments WHERE id = $1', [performingDeptId]);
  const storeName = storeDept.rows[0]?.name || INVENTORY_STORE;

  for (const row of assignments.rows) {
    await client.query(
      `UPDATE asset_assignments
       SET status = 'returned', updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || $2
       WHERE id = $1`,
      [row.id, notes ? ` | Returned before update: ${notes}` : ' | Returned before update']
    );

    await client.query(
      `UPDATE assets
       SET status = 'available', current_location = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [storeName, row.asset_id]
    );

    await client.query(
      `INSERT INTO assignment_history
        (assignment_id, asset_id, from_user, to_user, performed_by, action, notes)
       VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
      [row.id, row.asset_id, row.assigned_to, performedBy, 'Returned for request update', notes || null]
    );

    await client.query(
      `INSERT INTO inventory_transactions
        (asset_id, transaction_type, from_location, to_location, performed_by, notes)
       VALUES ($1, 'return', $2, $3, $4, $5)`,
      [row.asset_id, storeName, storeName, performedBy, notes || `Request #${requestId} assignment update`]
    );
  }

  return assignments.rows.length;
}

async function allRequestItemsFulfilled(client, requestId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS incomplete
     FROM asset_request_items
     WHERE request_id = $1 AND COALESCE(fulfilled_quantity, 0) < quantity`,
    [requestId]
  );
  return result.rows[0].incomplete === 0;
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
  notes,
  { replace = false } = {}
) {
  const request = await loadRequestLocked(client, requestId);

  const allowedStatuses = replace
    ? ['pending_inventory', 'pending_procurement']
    : ['pending_dept_assignment'];

  if (!allowedStatuses.includes(request.status)) {
    throw new Error(
      replace
        ? 'Request can only be updated while awaiting Inventory approval'
        : `Request status is ${request.status}`
    );
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

  if (replace) {
    await releaseDeptStoreAssignments(client, requestId, performingDeptId, performedBy, notes);
    await client.query(
      `UPDATE asset_request_items ari
       SET fulfilled_quantity = COALESCE((
         SELECT COUNT(*)::int FROM asset_assignments aa
         WHERE aa.request_item_id = ari.id AND aa.status = 'active'
       ), 0)
       WHERE ari.request_id = $1`,
      [requestId]
    );
  }

  await validateDeptFulfillments(client, request, fulfillments, performingDeptId, { replace });

  const result = await applyFulfillments(
    client,
    request,
    fulfillments,
    performedBy,
    performingDeptId,
    notes,
    { replace }
  );

  const allFulfilled = await allRequestItemsFulfilled(client, requestId);

  if (replace) {
    const assigneeLabel = request.assignee_name || 'employee';
    const nextStatus = allFulfilled ? 'pending_inventory' : 'pending_dept_assignment';
    await client.query(
      `UPDATE asset_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [nextStatus, requestId]
    );
    return {
      totalAssigned: result.totalAssigned,
      actionMsg: `Updated store assignment for ${assigneeLabel} — still awaiting Inventory`,
      forwardedToInventory: allFulfilled,
      updated: true,
    };
  }

  if (allFulfilled) {
    await client.query(
      `UPDATE asset_requests
       SET status = 'pending_inventory', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );
  }

  const assigneeLabel = request.assignee_name || 'employee';
  return {
    totalAssigned: result.totalAssigned,
    actionMsg: allFulfilled
      ? `Assigned store assets to ${assigneeLabel} — forwarded to Inventory`
      : `Assigned store assets to ${assigneeLabel} — awaiting other department categories`,
    forwardedToInventory: allFulfilled,
    updated: false,
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

  // Sync fulfilled counts from actual assignments before deciding status
  await client.query(
    `UPDATE asset_request_items ari
     SET fulfilled_quantity = COALESCE((
       SELECT COUNT(*)::int FROM asset_assignments aa
       WHERE aa.request_item_id = ari.id AND aa.status = 'active'
     ), 0)
     WHERE ari.request_id = $1`,
    [requestId]
  );

  const assignmentCount = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM asset_assignments WHERE request_id = $1 AND status = 'active'`,
    [requestId]
  );
  const totalAssigned = assignmentCount.rows[0].cnt;

  if (totalAssigned === 0) {
    throw new Error('Cannot approve — no assets have been assigned to the employee yet');
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
         fulfilled_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newStatus, requestId]
  );

  return {
    newStatus,
    actionMsg: complete
      ? 'Assets assigned to employee'
      : 'Partially assigned — some requested items were not fully fulfilled',
  };
}

async function applyFulfillments(
  client,
  request,
  fulfillments,
  performedBy,
  performingDeptId,
  notes,
  { replace = false } = {}
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
        'SELECT category_id, store_department_id, status FROM assets WHERE id = $1',
        [assetId]
      );

      if (!asset.rows.length) {
        throw new Error('Asset not found');
      }
      if (asset.rows[0].category_id !== item.category_id) {
        throw new Error('Asset category mismatch — select a device from the requested category');
      }
      if (asset.rows[0].store_department_id !== performingDeptId) {
        throw new Error('Asset is not in your department store');
      }
      if (asset.rows[0].status !== 'available') {
        throw new Error('Selected asset is no longer available');
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
  }

  await client.query(
    `UPDATE asset_request_items ari
     SET fulfilled_quantity = COALESCE((
       SELECT COUNT(*)::int FROM asset_assignments aa
       WHERE aa.request_item_id = ari.id AND aa.status = 'active'
     ), 0)
     WHERE ari.request_id = $1`,
    [request.id]
  );

  return { totalAssigned };
}

/** Legacy compatibility */
export async function fulfillRequest(client, requestId, fulfillments, performedBy, role, notes) {
  return deptAssignRequest(client, requestId, fulfillments, performedBy, role, notes);
}
