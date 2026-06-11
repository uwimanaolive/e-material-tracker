import React from "react";
import { Badge } from "./ui/badge";

export const StatusBadge = ({ status }) => {
  const config = {
    pending_head: { label: "Awaiting Head", color: "bg-amber-100 text-amber-800 border-amber-200" },
    pending_hr: { label: "Awaiting HR", color: "bg-blue-100 text-blue-800 border-blue-200" },
    pending_ict: { label: "Awaiting ICT", color: "bg-purple-100 text-purple-800 border-purple-200" },
    approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    rejected: { label: "Rejected", color: "bg-rose-100 text-rose-800 border-rose-200" },
    forwarded_hr: { label: "Forwarded to HR", color: "bg-blue-100 text-blue-800 border-blue-200" },
    resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    pending: { label: "Pending", color: "bg-slate-100 text-slate-800 border-slate-200" }
  };

  const badgeConfig = config[status] || { label: status, color: "bg-slate-100 text-slate-800 border-slate-200" };

  return (
    <Badge variant="outline" className={`${badgeConfig.color} font-medium`}>
      {badgeConfig.label}
    </Badge>
  );
};
