import React, { useState, useEffect } from "react";
import { useStore } from "../../store";
import { dashboardApi } from "../../api/dashboard";
import { gatePassesApi } from "../../api/gatePasses";
import { issueReportsApi } from "../../api/issueReports";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { FileText, AlertTriangle, Monitor, Inbox, Package, Users } from "lucide-react";
import { toast } from "sonner";

export const HeadDashboard = () => {
  const { currentUser } = useStore();
  const [stats, setStats] = useState(null);
  const [gatePasses, setGatePasses] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [statsData, gatePassesData, reportsData] = await Promise.all([
        dashboardApi.getHeadStats(),
        gatePassesApi.getHeadPending(),
        issueReportsApi.getHeadPending(),
      ]);
      setStats(statsData);
      setGatePasses(gatePassesData);
      setReports(reportsData);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const incomingTotal = (stats?.pending_owner_requests || 0) + (stats?.pending_owner_gate_passes || 0) + (stats?.pending_owner_reports || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{currentUser.department} Dashboard</h1>
        <p className="text-muted-foreground">Department assets, requests, and approval queues</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Assigned Assets", value: stats?.department_assets || 0, icon: Monitor },
          { label: "Staff", value: stats?.department_employees || 0, icon: Users },
          { label: "Pending Requests", value: stats?.pending_dept_requests || 0, icon: Package },
          { label: "Fulfilled Requests", value: stats?.fulfilled_requests || 0, icon: Package },
          { label: "Pending Gate Passes", value: stats?.pending_gate_passes || 0, icon: FileText },
          { label: "Incoming Approvals", value: incomingTotal, icon: Inbox },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {incomingTotal > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">{incomingTotal} incoming approval(s) from other departments</p>
              <p className="text-sm text-muted-foreground">Equipment your department owns is being requested</p>
            </div>
            <Link href="/head/incoming"><Button>Review Incoming</Button></Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Gate Passes</CardTitle>
            <Link href="/head/gate-passes"><Button variant="outline" size="sm">View All</Button></Link>
          </CardHeader>
          <CardContent>
            {gatePasses.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">No pending gate passes</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Asset</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {gatePasses.slice(0, 5).map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell>{gp.employee_name}</TableCell>
                      <TableCell>{gp.asset_name}</TableCell>
                      <TableCell><Link href="/head/gate-passes"><Button size="sm">Review</Button></Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Issue Reports</CardTitle>
            <Link href="/head/reports"><Button variant="outline" size="sm">View All</Button></Link>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">No pending reports</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Reporter</TableHead><TableHead>Asset</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {reports.slice(0, 5).map((rep) => (
                    <TableRow key={rep.id}>
                      <TableCell>{rep.reporter_name}</TableCell>
                      <TableCell>{rep.asset_name}</TableCell>
                      <TableCell><Link href="/head/reports"><Button size="sm">Review</Button></Link></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 flex gap-3 flex-wrap">
          <Link href="/head/requests"><Button variant="outline"><Package className="w-4 h-4 mr-2" />Asset Requests</Button></Link>
          <Link href="/head/assignments"><Button variant="outline"><Monitor className="w-4 h-4 mr-2" />Assignments</Button></Link>
          <Link href="/head/incoming"><Button variant="outline"><Inbox className="w-4 h-4 mr-2" />Incoming Approvals</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
};
