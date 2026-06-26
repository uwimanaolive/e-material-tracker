import React, { useState, useEffect } from "react";
import { useStore } from "../../store";
import { dashboardApi } from "../../api/dashboard";
import { gatePassesApi } from "../../api/gatePasses";
import { issueReportsApi } from "../../api/issueReports";
import { requestsApi } from "../../api/requests";
import { assignmentsApi } from "../../api/assignments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Link, useLocation } from "wouter";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { AlertTriangle, FileText, CheckCircle2, Monitor, Plus, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { GatePassCard } from "../../components/GatePassCard";
import { toast } from "sonner";

export const EmployeeDashboard = () => {
  const { currentUser } = useStore();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeGatePasses, setActiveGatePasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [statsData, gatePasses, reports, requests, assignments] = await Promise.all([
        dashboardApi.getEmployeeStats(),
        gatePassesApi.getMy(),
        issueReportsApi.getMy(),
        requestsApi.getAssignedToMe(),
        assignmentsApi.getMy(),
      ]);
      const passes = Array.isArray(gatePasses) ? gatePasses : [];
      setStats(statsData);
      setActiveGatePasses(
        (await Promise.all(
          passes.filter((gp) => gp.status === "active").map((gp) => gatePassesApi.getById(gp.id))
        )).filter((gp) => gp?.pass_token)
      );
      setActivity([
        ...(Array.isArray(assignments) ? assignments : []).map((a) => ({ type: "Assignment", ref: a.asset_name, detail: a.serial_number || "Asset assigned", date: a.created_at, itemType: "assignment", status: "assigned", raw: a })),
        ...(Array.isArray(requests) ? requests : []).map((r) => ({ type: "Asset Request", ref: r.request_number, detail: `${r.item_count} item(s)`, date: r.created_at, itemType: "request", status: r.status, raw: r })),
        ...passes.map((gp) => ({ type: "Gate Pass", ref: gp.gate_pass_number, detail: gp.asset_name, date: gp.created_at, itemType: "gatepass", status: gp.status, raw: gp })),
        ...(Array.isArray(reports) ? reports : []).map((r) => ({ type: "Issue Report", ref: r.report_number, detail: r.asset_name, date: r.created_at, itemType: "report", status: r.status, raw: r })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12));
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const viewItem = async (item) => {
    try {
      if (item.itemType === "gatepass") {
        setSelected({ ...(await gatePassesApi.getById(item.raw.id)), itemType: "gatepass" });
      } else if (item.itemType === "report") {
        setSelected({ ...(await issueReportsApi.getById(item.raw.id)), itemType: "report" });
      } else if (item.itemType === "request") {
        setSelected({ ...(await requestsApi.getById(item.raw.id)), itemType: "request" });
      } else {
        setSelected({ ...item.raw, itemType: "assignment" });
      }
    } catch {
      toast.error("Failed to load details");
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Good to see you, {currentUser.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/employee/reports"><Button variant="outline"><AlertTriangle className="w-4 h-4 mr-2" />Report Issue</Button></Link>
          <Link href="/employee/gate-passes"><Button><Plus className="w-4 h-4 mr-2" />Request Gate Pass</Button></Link>
        </div>
      </div>

      {activeGatePasses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> Gate Pass Cards — Scan at Security</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGatePasses.map((gp) => (
              <GatePassCard key={gp.id} gatePass={gp} compact />
            ))}
          </div>
          <Link href="/employee/gate-passes"><Button variant="link" className="px-0">View full gate pass cards →</Button></Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "My Assets", value: stats?.assigned_assets || 0, icon: Monitor, href: "/employee/assets" },
          { label: "Pending Requests", value: stats?.pending_requests || 0, icon: Package },
          { label: "Open Gate Passes", value: stats?.active_gate_passes || 0, icon: CheckCircle2, href: "/employee/gate-passes" },
          { label: "Open Reports", value: stats?.issue_reports || 0, icon: AlertTriangle, href: "/employee/reports" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={s.href ? "cursor-pointer hover:border-primary/50 transition" : ""} onClick={() => s.href && setLocation(s.href)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No activity yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.map((item, idx) => (
                  <TableRow key={`${item.itemType}-${item.ref}-${idx}`}>
                    <TableCell>{format(new Date(item.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell className="font-medium">{item.ref}</TableCell>
                    <TableCell>{item.detail}</TableCell>
                    <TableCell><StatusBadge status={item.status} item={item.raw} /></TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => viewItem(item)}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.gate_pass_number || selected?.report_number || selected?.request_number || selected?.asset_name}</DialogTitle>
            <DialogDescription>{getStatusHint(selected?.status, selected)}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <StatusBadge status={selected.status || "assigned"} item={selected} />
              {selected.itemType === "gatepass" && selected.status === "active" && selected.pass_token && (
                <GatePassCard gatePass={selected} />
              )}
              {selected.itemType === "request" && selected.items && (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selected.items.map((item, i) => (
                    <li key={i}>• {item.fulfilled_quantity || 0}/{item.quantity}x {item.category_name}</li>
                  ))}
                </ul>
              )}
              {selected.timeline && <Timeline timeline={selected.timeline} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
