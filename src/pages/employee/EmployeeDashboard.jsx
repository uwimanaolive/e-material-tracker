import React, { useState } from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Link } from "wouter";
import { StatusBadge } from "../../components/StatusBadge";
import { Timeline } from "../../components/Timeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PackagePlus, AlertTriangle, FileText, CheckCircle2, Clock, ArrowUpRight } from "lucide-react";

/* ─── Design tokens ────────────────────────────────────────────────
   Palette
     --ink:       #0A0A0A   primary text & CTAs
     --surface:   #FFFFFF   page background
     --panel:     #F5F5F5   card fills
     --border:    #E5E5E5   dividers
     --muted:     #737373   secondary text
     --amber:     #D97706   pending accent
     --emerald:   #059669   approved accent
     --rose:      #DC2626   reports / danger accent

   Typography
     Display: system "Inter" (weight 700–800, tight tracking)
     Body:    system sans (weight 400–500)
     Mono:    system mono (for counts)
──────────────────────────────────────────────────────────────────── */

const styles = `
  .ed-root {
    --ink:     #0A0A0A;
    --surface: #FFFFFF;
    --panel:   #F5F5F5;
    --border:  #E5E5E5;
    --muted:   #737373;
    --amber:   #D97706;
    --emerald: #059669;
    --rose:    #DC2626;

    font-family: "Inter", system-ui, -apple-system, sans-serif;
    background: var(--surface);
    color: var(--ink);
    min-height: 100vh;
    padding: 2rem 1.5rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .ed-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .ed-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.1;
    margin: 0 0 0.25rem;
    color: var(--ink);
  }
  .ed-header p {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }
  .ed-header-actions {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  /* ── Buttons ── */
  .ed-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    text-decoration: none;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }
  .ed-btn:active { transform: scale(0.97); }
  .ed-btn-primary {
    background: var(--ink);
    color: #fff;
    border: 1.5px solid var(--ink);
  }
  .ed-btn-primary:hover { opacity: 0.85; }
  .ed-btn-ghost {
    background: transparent;
    color: var(--ink);
    border: 1.5px solid var(--border);
  }
  .ed-btn-ghost:hover { background: var(--panel); }

  /* ── Stat cards ── */
  .ed-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.75rem;
  }
  @media (max-width: 768px) {
    .ed-stats { grid-template-columns: repeat(2, 1fr); }
  }
  .ed-stat-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
    overflow: hidden;
  }
  .ed-stat-card::after {
    content: "";
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: var(--accent-color, var(--ink));
    border-radius: 0 0 12px 12px;
    opacity: 0.18;
  }
  .ed-stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ed-stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ed-stat-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--icon-bg, #e5e5e5);
  }
  .ed-stat-icon svg { width: 14px; height: 14px; }
  .ed-stat-number {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  /* ── Table card ── */
  .ed-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .ed-card-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ed-card-title {
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--ink);
    margin: 0;
  }
  .ed-card-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  /* ── Table ── */
  .ed-table { width: 100%; border-collapse: collapse; }
  .ed-table th {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 0.75rem 1.5rem;
    text-align: left;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .ed-table td {
    font-size: 0.8125rem;
    color: var(--ink);
    padding: 0.875rem 1.5rem;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  .ed-table tr:last-child td { border-bottom: none; }
  .ed-table tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }
  .ed-table tbody tr:hover { background: var(--panel); }
  .ed-table .items-cell {
    color: var(--muted);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Urgency pills ── */
  .urgency-pill {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
  }
  .urgency-high    { background: #FEE2E2; color: #991B1B; }
  .urgency-medium  { background: #FEF3C7; color: #92400E; }
  .urgency-low     { background: #F3F4F6; color: #374151; }

  /* ── Row arrow indicator ── */
  .ed-row-arrow {
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    transition: color 0.15s, transform 0.15s;
  }
  .ed-table tbody tr:hover .ed-row-arrow {
    color: var(--ink);
    transform: translate(2px, -2px);
  }

  /* ── Empty state ── */
  .ed-empty {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .ed-empty strong {
    display: block;
    color: var(--ink);
    font-weight: 600;
    font-size: 0.9375rem;
    margin-bottom: 0.25rem;
  }

  /* ── Dialog overrides ── */
  .ed-dialog-section { margin-bottom: 1.25rem; }
  .ed-dialog-section:last-child { margin-bottom: 0; }
  .ed-dialog-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.5rem;
    display: block;
  }
  .ed-dialog-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .ed-dialog-item {
    font-size: 0.875rem;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ed-dialog-item::before {
    content: "";
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--ink);
    opacity: 0.3;
    flex-shrink: 0;
  }
  .ed-justification {
    font-size: 0.875rem;
    color: var(--ink);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    line-height: 1.6;
    margin: 0;
  }
`;

const StatCard = ({ label, value, icon: Icon, iconBg, accentColor, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3, ease: "easeOut" }}
  >
    <div className="ed-stat-card" style={{ "--accent-color": accentColor, "--icon-bg": iconBg }}>
      <div className="ed-stat-top">
        <span className="ed-stat-label">{label}</span>
        <div className="ed-stat-icon">
          <Icon color={accentColor} />
        </div>
      </div>
      <div className="ed-stat-number">{value}</div>
    </div>
  </motion.div>
);

export const EmployeeDashboard = () => {
  const { currentUser, requests, reports } = useStore();
  const [selectedRequest, setSelectedRequest] = useState(null);

  const myRequests = requests.filter(r => r.employeeId === currentUser.id);
  const myReports  = reports.filter(r => r.employeeId === currentUser.id);

  const pendingRequests  = myRequests.filter(r => r.status.startsWith("pending"));
  const approvedRequests = myRequests.filter(r => r.status === "approved");

  const sortedRequests = [...myRequests]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <>
      <style>{styles}</style>
      <div className="ed-root">

        {/* ── Header ── */}
        <motion.div
          className="ed-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div>
            <h1>Dashboard</h1>
            <p>Good to see you, {currentUser.name}</p>
          </div>
          <div className="ed-header-actions">
            <Link href="/employee/request" className="ed-btn ed-btn-primary">
              <PackagePlus size={14} />
              Request Equipment
            </Link>
            <Link href="/employee/report" className="ed-btn ed-btn-ghost">
              <AlertTriangle size={14} />
              Report Issue
            </Link>
          </div>
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="ed-stats">
          <StatCard
            label="Total Requests"
            value={myRequests.length}
            icon={FileText}
            iconBg="#E5E5E5"
            accentColor="#0A0A0A"
            delay={0.05}
          />
          <StatCard
            label="Pending"
            value={pendingRequests.length}
            icon={Clock}
            iconBg="#FEF3C7"
            accentColor="#D97706"
            delay={0.1}
          />
          <StatCard
            label="Approved"
            value={approvedRequests.length}
            icon={CheckCircle2}
            iconBg="#D1FAE5"
            accentColor="#059669"
            delay={0.15}
          />
          <StatCard
            label="My Reports"
            value={myReports.length}
            icon={AlertTriangle}
            iconBg="#FEE2E2"
            accentColor="#DC2626"
            delay={0.2}
          />
        </div>

        {/* ── Recent requests table ── */}
        <motion.div
          className="ed-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35, ease: "easeOut" }}
        >
          <div className="ed-card-header">
            <h2 className="ed-card-title">Recent Requests</h2>
            <span className="ed-card-count">{myRequests.length} total</span>
          </div>

          {myRequests.length === 0 ? (
            <div className="ed-empty">
              <strong>No requests yet</strong>
              Submit your first equipment request to get started.
            </div>
          ) : (
            <table className="ed-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map((request, i) => (
                  <motion.tr
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                  >
                    <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="items-cell">
                      {request.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                    </td>
                    <td>
                      <span className={`urgency-pill urgency-${request.urgency?.toLowerCase()}`}>
                        {request.urgency}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>
                      <span className="ed-row-arrow">
                        <ArrowUpRight size={14} />
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* ── Request detail dialog ── */}
        <Dialog
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                Request Details
              </DialogTitle>
              <DialogDescription style={{ fontSize: "0.8125rem" }}>
                {selectedRequest &&
                  format(new Date(selectedRequest.createdAt), "MMMM d, yyyy · h:mm a")}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div>
                <div className="ed-dialog-section">
                  <span className="ed-dialog-label">Items Requested</span>
                  <ul className="ed-dialog-items">
                    {selectedRequest.items.map((item, idx) => (
                      <li key={idx} className="ed-dialog-item">
                        {item.qty}× {item.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="ed-dialog-section">
                  <span className="ed-dialog-label">Justification</span>
                  <p className="ed-justification">{selectedRequest.justification}</p>
                </div>

                <div className="ed-dialog-section">
                  <span className="ed-dialog-label">Approval Timeline</span>
                  <Timeline timeline={selectedRequest.timeline} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </>
  );
};