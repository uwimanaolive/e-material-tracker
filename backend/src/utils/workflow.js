/** Get owner department id for an asset category (formerly specialist_department_id) */
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

/** After employee dept head action — next status for gate pass / issue report */
export async function nextStatusAfterHeadApproval(client, assetId, employeeDeptId) {
  const ownerDeptId = await getAssetOwnerDeptId(client, assetId);
  if (ownerDeptId && ownerDeptId !== employeeDeptId) {
    return 'pending_owner_dept';
  }
  return 'pending_procurement';
}
