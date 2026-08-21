/** Get owner department id for an asset category */
export async function getCategoryOwnerDeptId(client, categoryName) {
  const result = await client.query(
    'SELECT specialist_department_id FROM asset_categories WHERE name = $1',
    [categoryName]
  );
  return result.rows[0]?.specialist_department_id || null;
}

/** Get owner department id for an asset by asset_id */
export async function getAssetOwnerDeptId(client, assetId) {
  const result = await client.query(
    `SELECT ac.specialist_department_id
     FROM assets a
     JOIN asset_categories ac ON a.category_id = ac.id
     WHERE a.id = $1`,
    [assetId]
  );
  return result.rows[0]?.specialist_department_id || null;
}

/**
 * Determine if request items need owner department approval.
 * Returns { needsOwnerApproval, ownerDeptIds }
 */
export async function analyzeRequestItems(client, requesterDeptId, items) {
  const ownerDeptIds = new Set();
  for (const item of items) {
    const ownerId = await getCategoryOwnerDeptId(client, item.category);
    if (ownerId && ownerId !== requesterDeptId) {
      ownerDeptIds.add(ownerId);
    }
  }
  return {
    needsOwnerApproval: ownerDeptIds.size > 0,
    ownerDeptIds: [...ownerDeptIds],
  };
}

/** Initial status after HOD creates a request */
export function initialRequestStatus(needsOwnerApproval) {
  return needsOwnerApproval ? 'pending_owner_dept' : 'pending_dept_assignment';
}

/** After all owner dept approvals on a request */
export const STATUS_AFTER_OWNER_APPROVAL = 'pending_dept_assignment';

/** After dept store assignment */
export const STATUS_AFTER_DEPT_ASSIGNMENT = 'pending_inventory';

/**
 * Inventory is the final workflow stage.
 * After inventory approval the request is fulfilled or partially_fulfilled
 * (see inventoryConfirmRequest). This constant is kept only for import stability.
 */
export const STATUS_AFTER_INVENTORY_APPROVAL = 'fulfilled';

/** After employee dept head action on gate pass / issue report */
export async function nextStatusAfterHeadApproval(client, assetId, employeeDeptId) {
  const ownerDeptId = await getAssetOwnerDeptId(client, assetId);
  if (ownerDeptId && ownerDeptId !== employeeDeptId) {
    return 'pending_owner_dept';
  }
  return 'pending_hse';
}

/** After HSE approval on issue report */
export async function nextStatusAfterHseApproval(client, assetId, employeeDeptId) {
  const ownerDeptId = await getAssetOwnerDeptId(client, assetId);
  if (ownerDeptId && ownerDeptId !== employeeDeptId) {
    return 'pending_owner_dept';
  }
  return 'pending_inventory';
}

/** After owner dept approval on gate pass */
export const GATE_PASS_STATUS_AFTER_OWNER = 'pending_inventory';
