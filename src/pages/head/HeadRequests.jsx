import React from "react";
import { useStore } from "../../store";
import { requestsApi } from "../../api/requests";
import { categoriesApi } from "../../api/categories";
import { assetsApi } from "../../api/assets";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { CheckSquare, Plus, Trash2, Package, User, Pencil, Undo2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { Badge } from "../../components/ui/badge";
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

const emptyItem = () => ({ category: "", quantity: 1, specifications: "" });
const EDITABLE_STATUSES = ["pending_owner_dept", "pending_dept_assignment", "returned"];
const RECALLABLE_STATUSES = ["pending_owner_dept", "pending_dept_assignment", "pending_inventory", "pending_procurement"];

export const HeadRequests = () => {
  const { currentUser } = useStore();
  const [, setLocation] = useLocation();
  const editOpenedRef = React.useRef(null);
  const [requests, setRequests] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [storeSummary, setStoreSummary] = React.useState([]);
  const [storeItems, setStoreItems] = React.useState([]);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState(null);
  const [cancelTarget, setCancelTarget] = React.useState(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [formStep, setFormStep] = React.useState("edit");
  const [form, setForm] = React.useState({
    assigned_to: "",
    justification: "",
    urgency: "Normal",
    items: [emptyItem()],
  });

  React.useEffect(() => {
    loadRequests();
    loadEmployees();
    categoriesApi.getAll().then(setCategories).catch(() => toast.error("Failed to load categories"));
    assetsApi.getStoreForDepartment(currentUser.department)
      .then((data) => {
        setStoreSummary(data.summary || []);
        setStoreItems(data.items || []);
      })
      .catch(() => {});
  }, []);

  const loadEmployees = async () => {
    try {
      const depts = await departmentsApi.getAll();
      const dept = depts.find((d) => d.name === currentUser.department);
      if (dept) {
        const staff = await departmentsApi.getStaff(dept.id);
        setEmployees(staff.filter((u) => u.role === "employee"));
      }
    } catch {
      toast.error("Failed to load department employees");
    }
  };

  const loadRequests = async () => {
    try {
      const data = await requestsApi.getAll({ department: currentUser.department });
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => {
        if (a.status === "returned" && b.status !== "returned") return -1;
        if (b.status === "returned" && a.status !== "returned") return 1;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });
      setRequests(list);
    } catch (error) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId || !requests.length || editOpenedRef.current === editId) return;
    const match = requests.find((r) => String(r.id) === String(editId));
    if (match) {
      editOpenedRef.current = editId;
      openEdit(match);
      setLocation("/head/requests", { replace: true });
    }
  }, [requests]);

  const openCreate = () => {
    setEditingRequest(null);
    setForm({ assigned_to: "", justification: "", urgency: "Normal", items: [emptyItem()] });
    setFormStep("edit");
    setIsCreateOpen(true);
  };

  const canEditRequest = (request) =>
    EDITABLE_STATUSES.includes(request?.status)
    && (!request.department_name || request.department_name === currentUser.department);

  const canRecallRequest = (request) =>
    RECALLABLE_STATUSES.includes(request?.status)
    && (!request.department_name || request.department_name === currentUser.department);

  const handleRecall = async (request) => {
    try {
      const result = await requestsApi.recall(request.id);
      toast.success(result?.message || "Request recalled");
      setSelectedRequest(null);
      await loadRequests();
      openEdit({ ...request, status: "returned" });
    } catch (error) {
      toast.error(error.message || "Failed to recall request");
    }
  };

  const openEdit = async (request) => {
    try {
      const detail = await requestsApi.getById(request.id);
      if (detail.status === "pending_dept_assignment") {
        const assigned = (detail.items || []).some((item) => (item.assigned_assets || []).length > 0);
        if (assigned) {
          toast.error("Assets are already assigned. Recall the request first, then edit and resubmit.");
          return;
        }
      }
      setEditingRequest(detail);
      setForm({
        assigned_to: detail.assigned_to ? String(detail.assigned_to) : "",
        justification: detail.justification || "",
        urgency: detail.urgency || "Normal",
        items: (detail.items || []).map((item) => ({
          category: item.category_name || "",
          quantity: item.quantity || 1,
          specifications: item.specifications || "",
        })),
      });
      setFormStep("edit");
      setIsCreateOpen(true);
    } catch (error) {
      toast.error(error.message || "Failed to load request for editing");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await requestsApi.cancel(cancelTarget.id, { notes: "Cancelled — will not be resubmitted" });
      toast.success("Request cancelled");
      setCancelTarget(null);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      toast.error(error.message || "Failed to cancel request");
    } finally {
      setCancelling(false);
    }
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });
  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setEditingRequest(null);
    setFormStep("edit");
  };

  const validateForm = () => {
    if (!form.assigned_to) {
      toast.error("Please select an employee to assign equipment to");
      return false;
    }
    if (!form.justification.trim() || form.items.some((i) => !i.category)) {
      toast.error("Please fill in justification and all item categories");
      return false;
    }
    return true;
  };

  const goToReview = () => {
    if (!validateForm()) return;
    setFormStep("review");
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        department: currentUser.department,
        assigned_to: parseInt(form.assigned_to, 10),
        justification: form.justification,
        urgency: form.urgency,
        items: form.items.map((i) => ({
          category: i.category,
          quantity: parseInt(i.quantity, 10) || 1,
          specifications: i.specifications,
        })),
      };
      if (editingRequest) {
        const result = await requestsApi.edit(editingRequest.id, payload);
        toast.success(result?.message || (editingRequest.status === "returned" ? "Request resubmitted" : "Request updated"));
      } else {
        await requestsApi.create(payload);
        toast.success("Asset request submitted");
      }
      closeCreate();
      loadRequests();
    } catch (error) {
      toast.error(error.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (request) => {
    try {
      const detail = await requestsApi.getById(request.id);
      setSelectedRequest(detail);
    } catch {
      toast.error("Failed to load request details");
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Asset Requests</h1>
          <p className="text-muted-foreground">Request equipment and assign it to a department employee</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Request</Button>
          <Link href="/head/store"><Button variant="outline"><Package className="w-4 h-4 mr-2" />View Store</Button></Link>
        </div>
      </div>

      {storeSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inventory Store — Available for {currentUser.department}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {storeSummary.filter((s) => s.available_count > 0).map((s) => (
                <Badge key={s.category_id} variant="secondary">{s.category_name}: {s.available_count} available</Badge>
              ))}
              {storeSummary.every((s) => s.available_count === 0) && (
                <span className="text-sm text-muted-foreground">No items currently available in store</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" />Department Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No requests yet</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>Create your first request</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className={request.status === "returned" ? "bg-amber-50" : ""}>
                    <TableCell className="font-medium">{request.request_number}</TableCell>
                    <TableCell>{request.assignee_name || "—"}</TableCell>
                    <TableCell>{request.item_count}</TableCell>
                    <TableCell className="capitalize">{request.urgency}</TableCell>
                    <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><StatusBadge status={request.status} item={request} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleView(request)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) closeCreate(); else setIsCreateOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formStep === "review"
                ? "Review Request"
                : editingRequest
                  ? (editingRequest.status === "returned" ? "Edit & Resubmit Request" : "Edit Asset Request")
                  : "New Asset Request"}
            </DialogTitle>
            <DialogDescription>
              {formStep === "review"
                ? "Check the details, then submit. Use Edit to change anything before sending."
                : editingRequest?.status === "returned"
                  ? "Update the request using the feedback, then resubmit it into the approval workflow"
                  : "Request equipment by category — owning department will assign from store"}
            </DialogDescription>
          </DialogHeader>
          {formStep === "review" ? (
            <div className="space-y-4">
              {editingRequest?.return_notes && (
                <div className="text-sm p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                  <p className="font-medium">{editingRequest.return_action || "Returned with comment"}</p>
                  <p className="mt-1">{editingRequest.return_notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-medium">Assign to</p>
                  <p className="text-muted-foreground">{employees.find((e) => String(e.id) === String(form.assigned_to))?.name || "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Urgency</p>
                  <p className="text-muted-foreground capitalize">{form.urgency}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Justification</p>
                <p className="text-sm text-muted-foreground">{form.justification}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Requested items</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {form.items.map((item, i) => (
                    <li key={i}>
                      • {item.quantity}x {item.category}
                      {item.specifications ? ` — ${item.specifications}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            {editingRequest?.return_notes && (
              <div className="text-sm p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                <p className="font-medium">{editingRequest.return_action || "Returned with comment"}</p>
                <p className="mt-1">{editingRequest.return_notes}</p>
              </div>
            )}
            <div>
              <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assign to Employee *</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No employees in your department. Add staff via HR.</p>
              )}
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justification *</Label>
              <Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="Why is this equipment needed?" rows={3} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Requested Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>Add Item</Button>
              </div>
              {form.items.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-2 relative">
                  {form.items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeItem(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Select value={item.category} onValueChange={(v) => updateItem(index, "category", v)}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" className="max-h-60">
                      {categories.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-4 gap-2">
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} placeholder="Qty" />
                    <Input className="col-span-3" value={item.specifications} onChange={(e) => updateItem(index, "specifications", e.target.value)} placeholder="Specifications (optional)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            {formStep === "review" ? (
              <>
                <Button variant="outline" onClick={() => setFormStep("edit")}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting
                    ? "Submitting..."
                    : editingRequest
                      ? (editingRequest.status === "returned" ? "Resubmit" : "Save Changes")
                      : "Submit Request"}
                </Button>
              </>
            ) : (
              <Button onClick={goToReview}>Review</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>{getStatusHint(selectedRequest?.status)}</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <StatusBadge status={selectedRequest.status} item={selectedRequest} />
              {selectedRequest.status === "returned" && selectedRequest.return_notes && (
                <div className="text-sm p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                  <p className="font-medium">Feedback</p>
                  <p className="mt-1">{selectedRequest.return_notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="font-medium">Requester</p><p className="text-muted-foreground">{selectedRequest.requester_name}</p></div>
                <div><p className="font-medium">Assignee</p><p className="text-muted-foreground">{selectedRequest.assignee_name || "—"}</p></div>
              </div>
              <div><p className="text-sm font-medium">Justification</p><p className="text-sm text-muted-foreground">{selectedRequest.justification}</p></div>
              {selectedRequest.items?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Items</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedRequest.items.map((item, i) => (
                      <li key={i} className="space-y-1">
                        • {item.fulfilled_quantity || 0}/{item.quantity}x {item.category_name}
                        {item.owner_department_name && item.owner_department_name !== currentUser.department && (
                          <span className="text-xs"> (owned by {item.owner_department_name})</span>
                        )}
                        {item.assigned_assets?.length > 0 && (
                          <ul className="ml-4 text-xs text-emerald-700 space-y-0.5">
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
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedRequest.timeline && <Timeline timeline={selectedRequest.timeline} />}
            </div>
          )}
          {selectedRequest && (canEditRequest(selectedRequest) || canRecallRequest(selectedRequest) || selectedRequest.status === "returned") && (
            <DialogFooter className="gap-2 flex-wrap">
              {selectedRequest.status === "returned" && (
                <Button variant="outline" onClick={() => setCancelTarget(selectedRequest)}>Cancel</Button>
              )}
              {canRecallRequest(selectedRequest) && (
                <Button variant="outline" onClick={() => handleRecall(selectedRequest)}>
                  <Undo2 className="w-4 h-4 mr-1" /> Recall
                </Button>
              )}
              {canEditRequest(selectedRequest) && (
                <Button onClick={() => { setSelectedRequest(null); openEdit(selectedRequest); }}>
                  <Pencil className="w-4 h-4 mr-1" />
                  {selectedRequest.status === "returned" ? "Resubmit" : "Edit"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.request_number} will be closed and will not continue in the approval workflow.
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
