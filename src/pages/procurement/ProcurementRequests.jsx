import React from "react";
import { requestsApi } from "../../api/requests";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/StatusBadge";
import { CheckSquare, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export const ProcurementRequests = () => {
  const [pending, setPending] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [availableAssets, setAvailableAssets] = React.useState({});
  const [selectedAssets, setSelectedAssets] = React.useState({});
  const [actionNotes, setActionNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [p, h] = await Promise.all([
        requestsApi.getProcurementPending(),
        requestsApi.getProcurementHistory(),
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
      const [detail, assets] = await Promise.all([
        requestsApi.getById(request.id),
        requestsApi.getAvailableAssets(request.id),
      ]);
      setSelectedRequest(detail);
      setAvailableAssets(assets);
      const initial = {};
      detail.items?.forEach((item) => {
        const pre = item.selected_asset_ids?.length
          ? item.selected_asset_ids
          : (item.selected_assets?.map((a) => a.id) || []);
        initial[item.id] = pre;
      });
      setSelectedAssets(initial);
      setActionNotes("");
    } catch (error) {
      toast.error(error.message || "Failed to load request");
    }
  };

  const toggleAsset = (itemId, assetId) => {
    setSelectedAssets((prev) => {
      const current = prev[itemId] || [];
      const item = selectedRequest?.items?.find((i) => i.id === itemId);
      const maxQty = item ? item.quantity - (item.fulfilled_quantity || 0) : 1;
      if (current.includes(assetId)) {
        return { ...prev, [itemId]: current.filter((id) => id !== assetId) };
      }
      if (current.length >= maxQty) {
        toast.error(`Maximum ${maxQty} asset(s) for this line item`);
        return prev;
      }
      return { ...prev, [itemId]: [...current, assetId] };
    });
  };

  const handleFulfill = async () => {
    const fulfillments = Object.entries(selectedAssets)
      .filter(([, ids]) => ids.length > 0)
      .map(([request_item_id, asset_ids]) => ({ request_item_id: parseInt(request_item_id), asset_ids }));

    if (fulfillments.length === 0) {
      toast.error("Select at least one asset from the store to assign");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestsApi.procurementAction(selectedRequest.id, {
        action: "approve",
        notes: actionNotes,
        fulfillments,
      });
      toast.success(result.message || "Request fulfilled");
      setSelectedRequest(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Failed to fulfill request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await requestsApi.procurementAction(selectedRequest.id, { action: "reject", notes: actionNotes });
      toast.success("Request rejected");
      setSelectedRequest(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Failed to reject");
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
                  <Button variant="ghost" size="sm" onClick={() => openReview(request)}>Review & Assign</Button>
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
        <p className="text-muted-foreground">Review approved requests, assign store assets to employees</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" />Awaiting Fulfillment</CardTitle></CardHeader>
            <CardContent><RequestTable data={pending} /></CardContent>
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
            <DialogTitle>Fulfill Request — {selectedRequest?.request_number}</DialogTitle>
            <DialogDescription>Select store assets to assign to the employee</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/50 rounded-lg">
                <div><span className="font-medium">Department:</span> {selectedRequest.department_name}</div>
                <div><span className="font-medium">Assignee:</span> {selectedRequest.assignee_name}</div>
                <div className="col-span-2"><span className="font-medium">Justification:</span> {selectedRequest.justification}</div>
              </div>

              {selectedRequest.items?.map((item) => {
                const remaining = item.quantity - (item.fulfilled_quantity || 0);
                const assets = availableAssets[item.id] || [];
                const preSelected = item.selected_assets?.length > 0;
                return (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{item.quantity}x {item.category_name}</p>
                      <Badge variant="outline">{remaining} to assign</Badge>
                    </div>
                    {preSelected && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        Pre-selected by department: {item.selected_assets.map((a) => a.name).join(", ")}
                      </p>
                    )}
                    {item.specifications && <p className="text-xs text-muted-foreground">{item.specifications}</p>}
                    {assets.length === 0 ? (
                      <p className="text-sm text-destructive">No available assets in store for this category</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {assets.map((a) => {
                          const selected = (selectedAssets[item.id] || []).includes(a.id);
                          return (
                            <Button
                              key={a.id}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              onClick={() => toggleAsset(item.id, a.id)}
                            >
                              {a.name} {a.serial_number ? `(${a.serial_number})` : ""}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {selectedRequest.timeline && <Timeline timeline={selectedRequest.timeline} />}

              <div>
                <Label>Notes</Label>
                <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Fulfillment notes" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleReject} disabled={submitting}><X className="w-4 h-4 mr-1" />Reject</Button>
            <Button onClick={handleFulfill} disabled={submitting}>
              <Check className="w-4 h-4 mr-1" />{submitting ? "Assigning..." : "Assign Assets & Fulfill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
