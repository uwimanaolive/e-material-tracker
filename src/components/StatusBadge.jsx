import React from "react";
import { Badge } from "./ui/badge";

const STATUS_COLORS = {
  pending_head: "bg-amber-100 text-amber-800 border-amber-200",
  pending_hse: "bg-orange-100 text-orange-800 border-orange-200",
  pending_owner_dept: "bg-orange-100 text-orange-800 border-orange-200",
  pending_dept_assignment: "bg-purple-100 text-purple-800 border-purple-200",
  pending_inventory: "bg-blue-100 text-blue-800 border-blue-200",
  pending_procurement: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  fulfilled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  partially_fulfilled: "bg-teal-100 text-teal-800 border-teal-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-slate-100 text-slate-800 border-slate-200",
  pending_specialist: "bg-orange-100 text-orange-800 border-orange-200",
  specialist_approved: "bg-blue-100 text-blue-800 border-blue-200",
};

export function getStatusLabel(status, item) {
  const ctx = item ?? {};
  if (ctx.status_display) return ctx.status_display;

  const owner = ctx.owner_department_name;
  const reporter = ctx.reporter_department_name || ctx.department_name || ctx.employee_department;

  switch (status) {
    case 'pending_head':
      return reporter ? `Awaiting ${reporter} Head` : 'Awaiting Head';
    case 'pending_hse':
      return 'Awaiting HSE';
    case 'pending_owner_dept':
    case 'pending_specialist':
      return owner ? `Awaiting ${owner}` : 'Awaiting Owner Dept';
    case 'pending_dept_assignment':
      return owner ? `Awaiting ${owner} Store` : 'Awaiting Store';
    case 'pending_inventory':
    case 'pending_procurement':
    case 'specialist_approved':
      return 'Awaiting Inventory';
    case 'approved':
      return 'Inventory Approved';
    case 'fulfilled':
      return 'Assets Assigned';
    case 'partially_fulfilled':
      return 'Partially Assigned';
    case 'rejected':
      return 'Rejected';
    case 'resolved':
      return ctx.resolution_outcome
        ? `Resolved — ${String(ctx.resolution_outcome).replace(/_/g, ' ')}`
        : 'Resolved';
    case 'active':
      return ctx.no_return ? 'Active — Permanent Transfer' : 'Active — Gate Pass Issued';
    case 'closed':
      return ctx.no_return ? 'Closed — Permanent Move Complete' : 'Closed — Returned';
    default:
      return status?.replace(/_/g, ' ') || 'Unknown';
  }
}

export const getStatusHint = (status, item) => {
  const label = getStatusLabel(status, item);
  if (status === 'rejected') return `${label} — see timeline for who rejected and why`;
  if (status === 'active') return `${label} — show QR code at security gate`;
  if (status === 'resolved') return `${label} — full history in timeline below`;
  return label;
};

export const StatusBadge = ({ status, item }) => {
  const label = getStatusLabel(status, item);
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-800 border-slate-200";

  return (
    <Badge variant="outline" className={`${color} font-medium text-xs leading-snug whitespace-normal text-left max-w-[220px]`}>
      {label}
    </Badge>
  );
};
