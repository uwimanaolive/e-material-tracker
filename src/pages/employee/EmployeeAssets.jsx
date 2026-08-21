import React from "react";
import { useStore } from "../../store";
import { assignmentsApi } from "../../api/assignments";
import { requestsApi } from "../../api/requests";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { Monitor, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Timeline } from "../../components/Timeline";
import { format } from "date-fns";
import { toast } from "sonner";

export const EmployeeAssets = () => {
  const { currentUser } = useStore();
  const [assignments, setAssignments] = React.useState([]);
  const [pendingApprovals, setPendingApprovals] = React.useState([]);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [approvalNotes, setApprovalNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentData, requestData] = await Promise.all([
        assignmentsApi.getMy(),
        requestsApi.getAll({ status: 'pending_employee_approval' })
      ]);
      setAssignments(assignmentData);
      setPendingApprovals(Array.isArray(requestData) ? requestData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openApprovalDialog = async (request) => {
    try {
      const detail = await requestsApi.getById(request.id);
      setSelectedRequest(detail);
      setApprovalNotes("");
    } catch (error) {
      toast.error(error.message || "Failed to load request details");
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const result = await requestsApi.employeeApprove(selectedRequest.id, {
        notes: approvalNotes || "Asset assignment approved by employee"
      });
      toast.success(result.message || "Assignment approved");
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Assets & Requests</h1>
        <p className="text-muted-foreground">Manage your assigned assets and pending approvals</p>
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <CheckCircle2 className="w-5 h-5" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.request_number}</TableCell>
                    <TableCell>{request.department_name}</TableCell>
                    <TableCell>{request.item_count}</TableCell>
                    <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><StatusBadge status={request.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openApprovalDialog(request)}>
                        Review & Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Assigned Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No assets assigned to you</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.asset_name}</TableCell>
                    <TableCell>{assignment.serial_number}</TableCell>
                    <TableCell>{assignment.asset_condition}</TableCell>
                    <TableCell>{new Date(assignment.assigned_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Request — {selectedRequest?.request_number}</DialogTitle>
            <DialogDescription>Review the assigned assets and approve to complete the assignment</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/50 rounded-lg">
                <div><span className="font-medium">Department:</span> {selectedRequest.department_name}</div>
                <div><span className="font-medium">Assigned to:</span> {selectedRequest.assignee_name}</div>
                <div className="col-span-2"><span className="font-medium">Justification:</span> {selectedRequest.justification}</div>
              </div>

              {selectedRequest.items?.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{item.quantity}x {item.category_name}</p>
                    <Badge variant="outline">{item.fulfilled_quantity || 0}/{item.quantity} assigned</Badge>
                  </div>
                  {item.assigned_assets?.length > 0 && (
                    <ul className="text-xs text-emerald-700 space-y-1">
                      {item.assigned_assets.map((a) => (
                        <li key={a.id}>
                          {a.name}
                          {a.serial_number && ` (SN: ${a.serial_number})`}
                          {" — "}
                          Condition: {a.condition}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.specifications && <p className="text-xs text-muted-foreground">{item.specifications}</p>}
                </div>
              ))}

              {selectedRequest.timeline && <Timeline timeline={selectedRequest.timeline} />}

              <div>
                <Label>Additional Notes (Optional)</Label>
                <Textarea 
                  value={approvalNotes} 
                  onChange={(e) => setApprovalNotes(e.target.value)} 
                  placeholder="Add any notes or comments about the approval"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleApprove} disabled={submitting}>
              {submitting ? "Approving..." : "Approve Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
