import React from "react";
import { requestsApi } from "../../api/requests";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { CheckSquare, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export const InventoryRequests = () => {
  const [pending, setPending] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [actionNotes, setActionNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [p, h] = await Promise.all([
        requestsApi.getInventoryPending(),
        requestsApi.getInventoryHistory(),
      ]);
      setPending(p);
      setHistory(h);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (request) => {
    try {
      const detail = await requestsApi.getById(request.id);
      setSelectedRequest(detail);
      setActionNotes("");
    } catch (error) {
      toast.error(error.message || "Failed to load request");
    }
  };

  const handleConfirm = async () => {
    if (!actionNotes.trim()) { toast.error("Comment is required"); return; }
    setSubmitting(true);
    try {
      const result = await (selectedRequest.status === "pending_procurement"
        ? requestsApi.procurementAction(selectedRequest.id, {
            action: "approve",
            notes: actionNotes,
          })
        : requestsApi.inventoryAction(selectedRequest.id, {
            action: "approve",
            notes: actionNotes,
          }));
      toast.success(result.message || "Request approved");
      setSelectedRequest(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  };

  const RequestTable = ({ data, showReview = true }) => (
    data.length === 0 ? (
      <p className="text-muted-foreground py-8 text-center">No requests</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request #</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            {showReview && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">{request.request_number}</TableCell>
              <TableCell>{request.department_name}</TableCell>
              <TableCell>{request.assignee_name || "—"}</TableCell>
              <TableCell>{request.item_count}</TableCell>
              <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell><StatusBadge status={request.status} item={request} /></TableCell>
              {showReview && (
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openReview(request)}>Review</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Asset Requests</h1>
        <p className="text-muted-foreground">Approve requests after department store assignment</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" />Awaiting Inventory Approval</CardTitle></CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No requests awaiting approval. Requests appear here after department heads complete store assignment.
                </p>
              ) : (
                <RequestTable data={pending} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Fulfilled & Rejected</CardTitle></CardHeader>
            <CardContent><RequestTable data={history} showReview={false} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Request — {selectedRequest?.request_number}</DialogTitle>
            <DialogDescription>
              {selectedRequest?.status === "pending_procurement"
                ? "Approve to return this request to store assignment"
                : "Approve to complete this request — Inventory is the final stage"}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/50 rounded-lg">
                <div><span className="font-medium">Department:</span> {selectedRequest.department_name}</div>
                <div><span className="font-medium">Assignee:</span> {selectedRequest.assignee_name}</div>
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
                          {" → "}
                          {a.assigned_to_name || selectedRequest.assignee_name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.specifications && <p className="text-xs text-muted-foreground">{item.specifications}</p>}
                </div>
              ))}

              {selectedRequest.timeline && <Timeline timeline={selectedRequest.timeline} />}

              <div>
                <Label>Comment *</Label>
                <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Required comment" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button onClick={handleConfirm} disabled={submitting}>
              <Check className="w-4 h-4 mr-1" />{submitting ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
