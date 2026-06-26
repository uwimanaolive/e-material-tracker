/** Build human-readable status label with explicit department names */
export function getStatusDisplay(status, ctx = {}) {
  const owner = ctx.owner_department_name || ctx.ownerDepartment;
  const reporter = ctx.reporter_department_name || ctx.reporterDepartment || ctx.department_name || ctx.employee_department;

  switch (status) {
    case 'pending_head':
      return reporter ? `Awaiting ${reporter} Head` : 'Awaiting Department Head';
    case 'pending_owner_dept':
    case 'pending_specialist':
      return owner ? `Awaiting ${owner} Department` : 'Awaiting Owning Department';
    case 'pending_procurement':
    case 'specialist_approved':
      return 'Awaiting Procurement Department';
    case 'approved':
      return 'Approved by Procurement';
    case 'fulfilled':
      return 'Fulfilled — Assets Assigned';
    case 'partially_fulfilled':
      return 'Partially Fulfilled';
    case 'rejected':
      return 'Rejected';
    case 'resolved':
      return ctx.resolution_outcome
        ? `Resolved — ${String(ctx.resolution_outcome).replace(/_/g, ' ')}`
        : 'Resolved';
    case 'active':
      return 'Active — Gate Pass Issued';
    case 'closed':
      return 'Closed — Returned';
    default:
      return status?.replace(/_/g, ' ') || 'Unknown';
  }
}

export function enrichWithStatusDisplay(row) {
  if (!row) return row;
  return { ...row, status_display: getStatusDisplay(row.status, row) };
}

export function enrichRows(rows) {
  return rows.map(enrichWithStatusDisplay);
}

/** SQL fragment: owner department from asset category */
export const ISSUE_REPORT_STATUS_JOINS = `
  LEFT JOIN asset_categories ac ON a.category_id = ac.id
  LEFT JOIN departments od ON ac.specialist_department_id = od.id
`;

export const ISSUE_REPORT_STATUS_FIELDS = `, od.name as owner_department_name`;
