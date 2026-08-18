import React, { useState, useEffect } from "react";
import { useStore } from "../../store";
import { dashboardApi } from "../../api/dashboard";
import { gatePassesApi } from "../../api/gatePasses";
import { issueReportsApi } from "../../api/issueReports";
import { requestsApi } from "../../api/requests";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { FileText, Monitor, Inbox, Package, Users, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "../../components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

export const HeadDashboard = () => {
  const { currentUser } = useStore();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState(null);
  const [gatePasses, setGatePasses] = useState([]);
  const [reports, setReports] = useState([]);
  const [returnedRequests, setReturnedRequests] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [statsData, gatePassesData, reportsData, returnedData] = await Promise.all([
        dashboardApi.getHeadStats(),
        gatePassesApi.getHeadPending(),
        issueReportsApi.getHeadPending(),
        requestsApi.getReturned(),
      ]);
      setStats(statsData);
      setGatePasses(gatePassesData);
      setReports(reportsData);
      setReturnedRequests(Array.isArray(returnedData) ? returnedData : []);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await requestsApi.cancel(cancelTarget.id, { notes: "Cancelled from dashboard — will not be resubmitted" });
      toast.success("Request cancelled");
      setCancelTarget(null);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to cancel request");
    } finally {
      setCancelling(false);
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

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {[
          { label: "Assigned Assets", value: stats?.department_assets || 0, icon: Monitor },
          { label: "Staff", value: stats?.department_employees || 0, icon: Users },
          { label: "Pending Requests", value: stats?.pending_dept_requests || 0, icon: Package },
          { label: "Fulfilled Requests", value: stats?.fulfilled_requests || 0, icon: Package },
          { label: "Pending Gate Passes", value: stats?.pending_gate_passes || 0, icon: FileText },
          { label: "Returned Requests", value: stats?.returned_requests || returnedRequests.length, icon: RotateCcw },
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

      {returnedRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <RotateCcw className="w-5 h-5" />
              Returned Requests ({returnedRequests.length})
            </CardTitle>
            <p className="text-sm text-amber-800">
              These requests were sent back with a comment. Edit and resubmit, or cancel if you no longer need them.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {returnedRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-amber-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">{request.request_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Assignee: {request.assignee_name || "—"} · {request.item_count} item(s)
                      {request.updated_at && ` · ${format(new Date(request.updated_at), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <StatusBadge status={request.status} item={request} />
                </div>
                <div className="text-sm rounded-md bg-amber-50 border border-amber-100 p-3">
                  <p className="font-medium text-amber-900">{request.return_action || "Reviewer comment"}</p>
                  <p className="mt-1 text-amber-800">{request.return_notes || "No comment provided"}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setLocation(`/head/requests?edit=${request.id}`)}>
                    <Pencil className="w-4 h-4 mr-1" /> Edit & Resubmit
                  </Button>
                  <Button variant="outline" onClick={() => setCancelTarget(request)}>Cancel</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.request_number} will be closed and will not go back into the approval workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
