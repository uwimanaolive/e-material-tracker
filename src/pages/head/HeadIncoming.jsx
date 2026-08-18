import React from "react";
import { useStore } from "../../store";
import { requestsApi } from "../../api/requests";
import { gatePassesApi } from "../../api/gatePasses";
import { issueReportsApi } from "../../api/issueReports";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Timeline } from "../../components/Timeline";
import { AttachmentViewer } from "../../components/AttachmentViewer";
import { StatusBadge } from "../../components/StatusBadge";
import { Inbox, Check, X, Clock, User, Package, RotateCcw } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export const HeadIncoming = () => {
  const { currentUser } = useStore();
  const [requests, setRequests] = React.useState([]);
  const [deptAssignRequests, setDeptAssignRequests] = React.useState([]);
  const [gatePasses, setGatePasses] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [trackRequests, setTrackRequests] = React.useState([]);
  const [trackGatePasses, setTrackGatePasses] = React.useState([]);
  const [trackReports, setTrackReports] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [type, setType] = React.useState(null);
  const [notes, setNotes] = React.useState("");
  const [recommendation, setRecommendation] = React.useState("");
  const [availableAssets, setAvailableAssets] = React.useState({});
  const [selectedAssets, setSelectedAssets] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [decisionAction, setDecisionAction] = React.useState(null);
  const [decisionNotes, setDecisionNotes] = React.useState("");
  const [decisionSubmitting, setDecisionSubmitting] = React.useState(false);

  React.useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [r, da, g, ir, tr, tg, tir] = await Promise.all([
        requestsApi.getOwnerPending(),
        requestsApi.getDeptAssignmentPending(),
        gatePassesApi.getOwnerPending(),
        issueReportsApi.getOwnerPending(),
        requestsApi.getOwnerTracking(),
        gatePassesApi.getOwnerTracking(),
        issueReportsApi.getOwnerTracking(),
      ]);
      setRequests(r);
      setDeptAssignRequests(da);
      setGatePasses(g);
      setReports(ir);
      setTrackRequests(tr);
      setTrackGatePasses(tg);
      setTrackReports(tir);
    } catch {
      toast.error("Failed to load incoming items");
    } finally {
      setLoading(false);
    }
  };

  const isDeptUpdate = (status) => ['pending_inventory', 'pending_procurement'].includes(status);

  const openItem = async (itemType, item) => {
    try {
      let detail = item;
      if (itemType === "request") detail = await requestsApi.getById(item.id);
      if (itemType === "deptassign") {
        detail = await requestsApi.getById(item.id);
        try {
          const assets = await requestsApi.getAvailableAssets(item.id);
          setAvailableAssets(assets);
        } catch (assetError) {
          setAvailableAssets({});
          toast.error(assetError.message || "Could not load available assets for assignment");
        }
        const initial = {};
        detail.items?.forEach((i) => {
          if (i.owner_department_name === currentUser.department) {
            initial[i.id] = (i.assigned_assets || []).map((a) => a.id);
          }
        });
        setSelectedAssets(initial);
      }
      if (itemType === "gatepass") detail = await gatePassesApi.getById(item.id);
      if (itemType === "report") detail = await issueReportsApi.getById(item.id);
      setSelected(detail);
      setType(itemType);
      setNotes("");
      setRecommendation("");
    } catch (error) {
      toast.error(error.message || "Failed to load details");
    }
  };

  const ownedItems = (items) =>
    (items || []).filter(
      (item) => item.owner_department_name === currentUser.department
    );

  const handleDeptAssign = async () => {
    if (!notes.trim()) { toast.error("Comment is required"); return; }
    const updating = isDeptUpdate(selected?.status);
    const myItems = ownedItems(selected?.items);
    for (const item of myItems) {
      const remaining = updating
        ? item.quantity
        : item.quantity - (item.fulfilled_quantity || 0);
      if (!updating && remaining <= 0) continue;
      const picked = (selectedAssets[item.id] || []).length;
      const available = (availableAssets[item.id] || []).length;
      const required = Math.min(remaining, available);
      if (available === 0) {
        toast.error(`No "${item.category_name}" assets in store`);
        return;
      }
      if (picked < required) {
        toast.error(`Select ${required} "${item.category_name}" asset(s) for ${selected.assignee_name}`);
        return;
      }
      if (updating && picked > required) {
        toast.error(`Select at most ${required} "${item.category_name}" asset(s)`);
        return;
      }
    }
    try {
      const fulfillments = updating
        ? myItems.map((item) => ({
            request_item_id: item.id,
            asset_ids: selectedAssets[item.id] || [],
          }))
        : Object.entries(selectedAssets)
            .filter(([, ids]) => ids.length > 0)
            .map(([request_item_id, asset_ids]) => ({
              request_item_id: parseInt(request_item_id, 10),
              asset_ids,
            }));
      const apiCall = updating ? requestsApi.deptAssignUpdate : requestsApi.deptAssign;
      const result = await apiCall(selected.id, { fulfillments, notes });
      toast.success(result?.message || (updating ? "Assignment updated" : "Store assignment submitted"));
      setSelected(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Assignment failed");
    }
  };

  const handleReturnToRequester = async (action, comment) => {
    const reason = (comment ?? notes).trim();
    if (!reason) { toast.error("Comment is required"); return; }
    try {
      const result = await requestsApi.returnToRequester(selected.id, { action, notes: reason });
      toast.success(result?.message || (action === "reject" ? "Request rejected" : "Request returned to requester"));
      setDecisionAction(null);
      setDecisionNotes("");
      setSelected(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Action failed");
    }
  };

  const openDecision = (action) => {
    setDecisionAction(action);
    setDecisionNotes("");
  };

  const confirmDecision = async () => {
    if (!decisionNotes.trim()) { toast.error("Comment is required"); return; }
    setDecisionSubmitting(true);
    try {
      await handleReturnToRequester(decisionAction, decisionNotes);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const toggleAsset = (itemId, assetId) => {
    setSelectedAssets((prev) => {
      const current = prev[itemId] || [];
      const item = selected?.items?.find((i) => i.id === itemId);
      const updating = isDeptUpdate(selected?.status);
      const maxQty = item
        ? (updating ? item.quantity : item.quantity - (item.fulfilled_quantity || 0))
        : 1;
      if (current.includes(assetId)) return { ...prev, [itemId]: current.filter((id) => id !== assetId) };
      if (current.length >= maxQty) { toast.error(`Maximum ${maxQty} asset(s)`); return prev; }
      return { ...prev, [itemId]: [...current, assetId] };
    });
  };

  const handleApprove = async () => {
    if (!notes.trim()) { toast.error("Comment is required"); return; }
    if (type === "report" && !recommendation) { toast.error("Please select a recommendation"); return; }
    try {
      if (type === "request") await requestsApi.ownerAction(selected.id, { action: "approve", notes });
      if (type === "gatepass") await gatePassesApi.ownerAction(selected.id, { action: "approve", notes });
      if (type === "report") await issueReportsApi.ownerAction(selected.id, { assessment_notes: notes, recommendation });
      if (type !== "deptassign") toast.success("Approved — forwarded to Inventory");
      setSelected(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Action failed");
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) { toast.error("Please provide a reason"); return; }
    try {
      if (type === "request") await requestsApi.ownerAction(selected.id, { action: "reject", notes });
      if (type === "gatepass") await gatePassesApi.ownerAction(selected.id, { action: "reject", notes });
      toast.success("Rejected");
      setSelected(null);
      loadAll();
    } catch (error) {
      toast.error(error.message || "Action failed");
    }
  };

  const ItemTable = ({ data, t, cols, showReview = true }) => (
    data.length === 0 ? (
      <p className="text-center py-8 text-muted-foreground">No items</p>
    ) : (
      <Table>
        <TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}<TableHead>Status</TableHead>{showReview && <TableHead></TableHead>}</TableRow></TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.request_number || item.gate_pass_number || item.report_number}</TableCell>
              <TableCell>{item.department_name || item.employee_name || item.reporter_name}</TableCell>
              {t === "deptassign" && <TableCell>{item.assignee_name || "—"}</TableCell>}
              {t !== "request" && t !== "deptassign" && <TableCell>{item.asset_name}</TableCell>}
              <TableCell>{format(new Date(item.created_at || item.updated_at), "MMM d, yyyy")}</TableCell>
              <TableCell><StatusBadge status={item.status} item={item} /></TableCell>
              {showReview && (
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openItem(t, item)}>
                    {t === "deptassign" && isDeptUpdate(item.status) ? "Edit" : t === "deptassign" ? "Assign" : "View"}
                  </Button>
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
        <h1 className="text-2xl font-bold">Incoming Approvals</h1>
        <p className="text-muted-foreground">Review cross-department requests, assign store assets, and track items with Inventory</p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="deptassign">Store Assignment ({deptAssignRequests.length})</TabsTrigger>
          <TabsTrigger value="requests">Approvals ({requests.length})</TabsTrigger>
          <TabsTrigger value="gatepasses">Gate Passes ({gatePasses.length})</TabsTrigger>
          <TabsTrigger value="reports">Issue Reports ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="deptassign">
          <Card>
            <CardHeader>
              <CardTitle>Assign Store Assets Before Inventory</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pick devices from your store (matching requested category). Approve by assigning assets, or return/reject with a comment. Recall is only available to the department that submitted the request.
              </p>
            </CardHeader>
            <CardContent>
              <ItemTable data={deptAssignRequests} t="deptassign" cols={["Request #", "From Dept", "Assignee", "Date"]} />
            </CardContent>
          </Card>
        </TabsContent>

        {[
          { key: "requests", pending: requests, tracking: trackRequests, type: "request", cols: ["Request #", "From Dept", "Date"] },
          { key: "gatepasses", pending: gatePasses, tracking: trackGatePasses, type: "gatepass", cols: ["Gate Pass #", "Employee", "Asset", "Date"] },
          { key: "reports", pending: reports, tracking: trackReports, type: "report", cols: ["Report #", "Reporter", "Asset", "Date"] },
        ].map(({ key, pending, tracking, type: t, cols }) => (
          <TabsContent key={key} value={key} className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="w-5 h-5" /> Pending Your Approval</CardTitle></CardHeader>
              <CardContent><ItemTable data={pending} t={t} cols={cols} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Tracking — After Your Approval</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Items you approved that are now with Inventory or completed</p>
                <ItemTable data={tracking} t={t} cols={cols} showReview={true} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {type === "deptassign"
                ? (isDeptUpdate(selected?.status) ? "Update Store Assignment" : "Assign Store Assets")
                : "Item Details"}
            </DialogTitle>
            <DialogDescription>{selected?.request_number || selected?.gate_pass_number || selected?.report_number}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <StatusBadge status={selected.status} item={selected} />
              {type === "deptassign" && selected.assignee_name && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <User className="w-4 h-4 text-blue-600" />
                  <span><span className="font-medium">Assign devices to:</span> {selected.assignee_name}</span>
                  <Badge variant="secondary">{selected.department_name}</Badge>
                </div>
              )}
              {selected.assignee_name && type !== "deptassign" && (
                <p className="text-sm"><span className="font-medium">Assignee:</span> {selected.assignee_name}</p>
              )}
              {selected.justification && <p className="text-sm">{selected.justification}</p>}
              {type === "request" && selected.items?.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selected.items.map((item, i) => (
                    <li key={i}>• {item.quantity}x {item.category_name}</li>
                  ))}
                </ul>
              )}
              {type === "deptassign" && isDeptUpdate(selected.status) && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Inventory has not approved yet — you may change the comment and devices assigned from your store.
                </p>
              )}
              {type === "deptassign" && ownedItems(selected.items).filter((item) => {
                if (isDeptUpdate(selected.status)) return true;
                return item.quantity - (item.fulfilled_quantity || 0) > 0;
              }).map((item) => {
                const assets = availableAssets[item.id] || [];
                const updating = isDeptUpdate(selected.status);
                const remaining = updating
                  ? item.quantity
                  : item.quantity - (item.fulfilled_quantity || 0);
                const picked = selectedAssets[item.id] || [];
                return (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {item.category_name} — select {Math.min(remaining, assets.length)} of {remaining} required
                      </p>
                      <Badge variant={picked.length >= Math.min(remaining, assets.length) ? "default" : "outline"}>
                        {picked.length} selected
                      </Badge>
                    </div>
                    {item.assigned_assets?.length > 0 && !updating && (
                      <p className="text-xs text-emerald-700">
                        Already assigned: {item.assigned_assets.map((a) => `${a.name} (${a.serial_number})`).join(", ")}
                      </p>
                    )}
                    {updating && item.assigned_assets?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Current: {item.assigned_assets.map((a) => `${a.name}${a.serial_number ? ` (${a.serial_number})` : ""}`).join(", ")}
                      </p>
                    )}
                    {assets.length === 0 ? (
                      <p className="text-xs text-amber-700">No available "{item.category_name}" assets in your store</p>
                    ) : (
                      <div className="space-y-1">
                        {assets.map((a) => (
                          <Button
                            key={a.id}
                            size="sm"
                            variant={picked.includes(a.id) ? "default" : "outline"}
                            className="w-full justify-start h-auto py-2"
                            onClick={() => toggleAsset(item.id, a.id)}
                          >
                            <span className="text-left">
                              <span className="font-medium">{a.name}</span>
                              {a.serial_number && <span className="text-xs opacity-80 ml-2">SN: {a.serial_number}</span>}
                              {a.condition && <span className="text-xs opacity-70 ml-1">· {a.condition}</span>}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {type === "deptassign" && !isDeptUpdate(selected?.status) && ownedItems(selected.items).filter((item) => item.quantity - (item.fulfilled_quantity || 0) <= 0).length > 0 && (
                <div className="text-sm text-emerald-700 border border-emerald-200 rounded-lg p-3">
                  Completed:{" "}
                  {ownedItems(selected.items)
                    .filter((item) => item.quantity - (item.fulfilled_quantity || 0) <= 0)
                    .flatMap((item) => item.assigned_assets || [])
                    .map((a) => `${a.name}${a.serial_number ? ` (${a.serial_number})` : ""} → ${a.assigned_to_name || selected.assignee_name}`)
                    .join("; ")}
                </div>
              )}
              {type === "deptassign" && ownedItems(selected.items).length === 0 && (
                <p className="text-sm text-muted-foreground">No categories owned by your department on this request.</p>
              )}
              {selected.description && <p className="text-sm">{selected.description}</p>}
              {selected.reason && <p className="text-sm">{selected.reason}</p>}
              <AttachmentViewer attachment={selected.attachment} />
              {type === "report" && selected.status === "pending_owner_dept" && (
                <div>
                  <Label>Recommendation</Label>
                  <Select value={recommendation} onValueChange={setRecommendation}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="replace">Replace</SelectItem>
                      <SelectItem value="dispose">Dispose</SelectItem>
                      <SelectItem value="write-off">Write-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selected.status === "pending_owner_dept" && (
                <div>
                  <Label>Comment *</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Required — explain your decision" />
                </div>
              )}
              {type === "deptassign" && (selected?.status === "pending_dept_assignment" || isDeptUpdate(selected?.status)) && (
                <div>
                  <Label>Comment *</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isDeptUpdate(selected?.status)
                      ? "Required — explain what you changed"
                      : "Required — note on store assignment"}
                  />
                </div>
              )}
              {selected.timeline && <Timeline timeline={selected.timeline} />}
            </div>
          )}
          {selected?.status === "pending_owner_dept" && type !== "deptassign" && (
            <DialogFooter className="gap-2 flex-wrap">
              {type === "request" && (
                <Button variant="outline" onClick={() => openDecision("return")}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Return
                </Button>
              )}
              {type !== "report" && (
                <Button variant="destructive" onClick={() => (type === "request" ? openDecision("reject") : handleReject())}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              )}
              <Button onClick={handleApprove}><Check className="w-4 h-4 mr-1" /> Approve & Forward</Button>
            </DialogFooter>
          )}
          {type === "deptassign" && selected?.status === "pending_dept_assignment" && ownedItems(selected?.items).length > 0 && !ownedItems(selected?.items).some((item) => item.quantity - (item.fulfilled_quantity || 0) > 0) && (
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => openDecision("return")}><RotateCcw className="w-4 h-4 mr-1" /> Return</Button>
              <Button variant="destructive" onClick={() => openDecision("reject")}><X className="w-4 h-4 mr-1" /> Reject</Button>
            </DialogFooter>
          )}
          {type === "deptassign" && selected?.status === "pending_dept_assignment" && ownedItems(selected?.items).some((item) => item.quantity - (item.fulfilled_quantity || 0) > 0) && (
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => openDecision("return")}><RotateCcw className="w-4 h-4 mr-1" /> Return</Button>
              <Button variant="destructive" onClick={() => openDecision("reject")}><X className="w-4 h-4 mr-1" /> Reject</Button>
              <Button onClick={handleDeptAssign}><Check className="w-4 h-4 mr-1" /> Assign & Forward</Button>
            </DialogFooter>
          )}
          {type === "deptassign" && isDeptUpdate(selected?.status) && ownedItems(selected?.items).length > 0 && (
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => openDecision("return")}><RotateCcw className="w-4 h-4 mr-1" /> Return</Button>
              <Button variant="destructive" onClick={() => openDecision("reject")}><X className="w-4 h-4 mr-1" /> Reject</Button>
              <Button onClick={handleDeptAssign}><Check className="w-4 h-4 mr-1" /> Save Changes</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!decisionAction} onOpenChange={(open) => { if (!open) { setDecisionAction(null); setDecisionNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{decisionAction === "reject" ? "Reject request" : "Return request"}</DialogTitle>
            <DialogDescription>
              {decisionAction === "reject"
                ? "Enter a reason for rejecting this request. The requester will see it in the timeline."
                : "Enter a reason for returning this request. The requester can edit and resubmit using your comment."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Comment *</Label>
            <Textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={decisionAction === "reject" ? "Required — why this request is rejected" : "Required — why this request is returned"}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDecisionAction(null); setDecisionNotes(""); }}>Cancel</Button>
            <Button
              variant={decisionAction === "reject" ? "destructive" : "default"}
              onClick={confirmDecision}
              disabled={decisionSubmitting}
            >
              {decisionSubmitting
                ? "Saving..."
                : decisionAction === "reject" ? "Confirm Reject" : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
