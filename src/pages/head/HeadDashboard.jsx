import React, { useState } from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { StatusBadge } from "../../components/StatusBadge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Check, X, FileText, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";

export const HeadDashboard = () => {
  const { currentUser, requests, setRequests, reports, setReports } = useStore();
  
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const deptRequests = requests.filter(r => r.department === currentUser.department);
  const deptReports = reports.filter(r => r.department === currentUser.department);

  const pendingRequests = deptRequests.filter(r => r.status === "pending_head");
  const pendingReports = deptReports.filter(r => r.status === "pending");

  const handleApprove = (id) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: "pending_hr",
          timeline: [...r.timeline, {
            stage: "Head Approval", actor: currentUser.name, action: "Approved", timestamp: new Date().toISOString(), note: ""
          }]
        };
      }
      return r;
    }));
    alert("Request Approved: Forwarded to HR.");
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    setRequests(prev => prev.map(r => {
      if (r.id === rejectId) {
        return {
          ...r,
          status: "rejected",
          timeline: [...r.timeline, {
            stage: "Head Approval", actor: currentUser.name, action: "Rejected", timestamp: new Date().toISOString(), note: rejectReason
          }]
        };
      }
      return r;
    }));
    setRejectId(null);
    setRejectReason("");
    alert("Request Rejected");
  };

  const handleForwardReport = (id) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: "forwarded_hr" } : r));
    alert("Report Forwarded: Report forwarded to HR.");
  };

  const handleCloseReport = (id) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: "resolved" } : r));
    alert("Report Closed");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{currentUser.department} Dashboard</h1>
        <p className="text-muted-foreground">Action items requiring your attention.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <FileText className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequests.length}</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReports.length}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Equipment Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending requests at this time.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{format(new Date(req.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                    <TableCell>{req.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${req.urgency === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>
                        {req.urgency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setRejectId(req.id)}>
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprove(req.id)}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Damage/Loss Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending reports.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReports.map(rep => (
                  <TableRow key={rep.id}>
                    <TableCell>{format(new Date(rep.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium">{rep.employeeName}</TableCell>
                    <TableCell>{rep.equipmentName}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${rep.issueType === 'Lost' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                        {rep.issueType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCloseReport(rep.id)}>Close</Button>
                        <Button size="sm" onClick={() => handleForwardReport(rep.id)}>Forward to HR</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for rejection</label>
            <Input 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g., Budget constraints, not required for role..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
