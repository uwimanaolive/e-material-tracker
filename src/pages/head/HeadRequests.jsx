import React from "react";
import { useStore } from "../../store";
import { requestsApi } from "../../api/requests";
import { categoriesApi } from "../../api/categories";
import { assetsApi } from "../../api/assets";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { CheckSquare, Plus, Trash2, Package, User } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "wouter";
import { Badge } from "../../components/ui/badge";

const emptyItem = () => ({ category: "", quantity: 1, specifications: "", asset_ids: [] });

export const HeadRequests = () => {
  const { currentUser } = useStore();
  const [requests, setRequests] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [storeSummary, setStoreSummary] = React.useState([]);
  const [storeItems, setStoreItems] = React.useState([]);
  const [selectedRequest, setSelectedRequest] = React.useState(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
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
      setRequests(data);
    } catch (error) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ assigned_to: "", justification: "", urgency: "Normal", items: [emptyItem()] });
    setIsCreateOpen(true);
  };

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    if (field === "category") {
      items[index] = { ...items[index], category: value, asset_ids: [] };
    } else if (field === "quantity") {
      items[index] = { ...items[index], quantity: value, asset_ids: [] };
    } else {
      items[index] = { ...items[index], [field]: value };
    }
    setForm({ ...form, items });
  };

  const toggleItemAsset = (index, assetId) => {
    const items = [...form.items];
    const item = items[index];
    const qty = parseInt(item.quantity) || 1;
    const ids = item.asset_ids || [];
    if (ids.includes(assetId)) {
      item.asset_ids = ids.filter((id) => id !== assetId);
    } else {
      if (ids.length >= qty) {
        toast.error(`Select at most ${qty} asset(s) for this line`);
        return;
      }
      item.asset_ids = [...ids, assetId];
    }
    setForm({ ...form, items });
  };

  const assetsForCategory = (categoryName) =>
    storeItems.filter((a) => a.category_name === categoryName);

  const addItem = () => setForm({ ...form, items: [...form.items, emptyItem()] });
  const removeItem = (index) => {
    if (form.items.length === 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  const handleSubmit = async () => {
    if (!form.assigned_to) {
      toast.error("Please select an employee to assign equipment to");
      return;
    }
    if (!form.justification.trim() || form.items.some((i) => !i.category)) {
      toast.error("Please fill in justification and all item categories");
      return;
    }

    for (const item of form.items) {
      const available = assetsForCategory(item.category);
      if (available.length > 0) {
        const qty = parseInt(item.quantity) || 1;
        if ((item.asset_ids?.length || 0) !== qty) {
          toast.error(`Select exactly ${qty} asset(s) from the store for ${item.category}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await requestsApi.create({
        department: currentUser.department,
        assigned_to: parseInt(form.assigned_to),
        justification: form.justification,
        urgency: form.urgency,
        items: form.items.map((i) => ({
          category: i.category,
          quantity: parseInt(i.quantity) || 1,
          specifications: i.specifications,
          asset_ids: i.asset_ids || [],
        })),
      });
      toast.success("Asset request submitted");
      setIsCreateOpen(false);
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
            <CardTitle className="text-sm font-medium">Procurement Store — Available for {currentUser.department}</CardTitle>
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
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.request_number}</TableCell>
                    <TableCell>{request.assignee_name || "—"}</TableCell>
                    <TableCell>{request.item_count}</TableCell>
                    <TableCell className="capitalize">{request.urgency}</TableCell>
                    <TableCell>{format(new Date(request.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><StatusBadge status={request.status} item={request} /></TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => handleView(request)}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Asset Request</DialogTitle>
            <DialogDescription>Request equipment from procurement and assign it to a department employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {item.category && assetsForCategory(item.category).length > 0 && (
                    <div>
                      <Label className="text-xs">Select from available store ({item.asset_ids?.length || 0}/{item.quantity})</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {assetsForCategory(item.category).map((a) => {
                          const sel = (item.asset_ids || []).includes(a.id);
                          return (
                            <Button key={a.id} type="button" size="sm" variant={sel ? "default" : "outline"}
                              onClick={() => toggleItemAsset(index, a.id)}>
                              {a.name}{a.serial_number ? ` (${a.serial_number})` : ""}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {item.category && assetsForCategory(item.category).length === 0 && (
                    <p className="text-xs text-amber-600">No store items available — procurement will assign when stock arrives</p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} placeholder="Qty" />
                    <Input className="col-span-3" value={item.specifications} onChange={(e) => updateItem(index, "specifications", e.target.value)} placeholder="Specifications (optional)" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit Request"}</Button>
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
                      <li key={i}>• {item.fulfilled_quantity || 0}/{item.quantity}x {item.category_name}
                        {item.owner_department_name && item.owner_department_name !== currentUser.department && (
                          <span className="text-xs"> (owned by {item.owner_department_name})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedRequest.timeline && <Timeline timeline={selectedRequest.timeline} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
