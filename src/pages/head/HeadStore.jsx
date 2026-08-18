import React from "react";
import { useStore } from "../../store";
import { assetsApi } from "../../api/assets";
import { categoriesApi } from "../../api/categories";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Package, Monitor, AlertTriangle, XCircle, CheckCircle2, Plus } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/StatusBadge";
import { safeFormatDate } from "@/utils/formatDate";
import { toast } from "sonner";
import { cn } from "../../components/ui/cn";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";

const VIEW_CONFIG = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    color: "border-green-200 bg-green-50 hover:bg-green-100",
    activeColor: "ring-2 ring-green-500 bg-green-100",
  },
  used: {
    label: "Assigned",
    icon: Monitor,
    color: "border-blue-200 bg-blue-50 hover:bg-blue-100",
    activeColor: "ring-2 ring-blue-500 bg-blue-100",
  },
  lost: {
    label: "Lost",
    icon: XCircle,
    color: "border-red-200 bg-red-50 hover:bg-red-100",
    activeColor: "ring-2 ring-red-500 bg-red-100",
  },
  damaged: {
    label: "Damaged",
    icon: AlertTriangle,
    color: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    activeColor: "ring-2 ring-amber-500 bg-amber-100",
  },
};

const emptyAssetForm = () => ({
  name: "",
  category: "",
  brand: "",
  model: "",
  serial_number: "",
  notes: "",
  quantity: 1,
  condition: "good",
  current_location: "",
});

export const HeadStore = () => {
  const { currentUser } = useStore();
  const [store, setStore] = React.useState(null);
  const [view, setView] = React.useState("available");
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [assetForm, setAssetForm] = React.useState(emptyAssetForm());

  React.useEffect(() => {
    loadStore(view, departmentFilter);
  }, [view, departmentFilter]);

  React.useEffect(() => {
    categoriesApi.getAll().then(setCategories).catch(() => {});
    departmentsApi.getAll()
      .then((data) => setDepartments((data || []).filter((d) => d.name !== "Inventory" && d.name !== "Human Resources")))
      .catch(() => {});
  }, []);

  const loadStore = async (selectedView, dept = departmentFilter) => {
    setLoading(true);
    try {
      const data = await assetsApi.getStoreForDepartment(dept === "all" ? "all" : dept, selectedView);
      setStore(data);
    } catch {
      toast.error("Failed to load inventory store");
    } finally {
      setLoading(false);
    }
  };

  const counts = store?.counts || { available: 0, used: 0, lost: 0, damaged: 0 };
  const managedCategories = categories.filter(
    (c) => c.specialist_department_name === currentUser?.department
  );

  const handleAddAsset = async () => {
    if (!assetForm.name.trim() || !assetForm.category) {
      toast.error("Asset name and category are required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await assetsApi.create({
        name: assetForm.name.trim(),
        category: assetForm.category,
        brand: assetForm.brand || null,
        model: assetForm.model || null,
        serial_number: assetForm.serial_number || null,
        notes: assetForm.notes || null,
        quantity: parseInt(assetForm.quantity, 10) || 1,
        condition: assetForm.condition || "good",
        current_location: assetForm.current_location || currentUser.department,
        store_department: currentUser.department,
      });
      const added = result?.created || 1;
      toast.success(added > 1 ? `${added} assets added to your store` : "Asset added to store");
      setIsAddOpen(false);
      setAssetForm(emptyAssetForm());
      loadStore(view, departmentFilter);
    } catch (error) {
      toast.error(error.message || "Failed to add asset");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTable = () => {
    const items = store?.items || [];
    if (!items.length) {
      return (
        <p className="text-muted-foreground text-center py-8">
          No {VIEW_CONFIG[view].label.toLowerCase()} items found
        </p>
      );
    }

    if (view === "available") {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Pool</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category_name}</TableCell>
                <TableCell>{item.serial_number}</TableCell>
                <TableCell>{[item.brand, item.model].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell className="capitalize">{item.condition}</TableCell>
                <TableCell>{item.department_name || item.store_department_name || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.store_department_name || "—"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (view === "used") {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Assigned Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Condition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category_name}</TableCell>
                <TableCell>{item.serial_number}</TableCell>
                <TableCell>{item.assigned_to_name || "—"}</TableCell>
                <TableCell>{item.department_name || "—"}</TableCell>
                <TableCell>{item.store_department_name || "—"}</TableCell>
                <TableCell className="capitalize">{item.condition}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report #</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Serial</TableHead>
            <TableHead>Assigned Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Reporter</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.report_number}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.category_name}</TableCell>
              <TableCell>{item.serial_number}</TableCell>
              <TableCell>{item.assigned_to_name || "—"}</TableCell>
              <TableCell>{item.department_name || "—"}</TableCell>
              <TableCell>{item.reporter_name || "—"}</TableCell>
              <TableCell><StatusBadge status={item.report_status || item.status} item={item} /></TableCell>
              <TableCell>{safeFormatDate(item.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory Store</h1>
          <p className="text-muted-foreground">
            Available, assigned, lost, and damaged assets in categories managed by {currentUser?.department}, across all assignment departments
          </p>
        </div>
        <Button onClick={() => { setAssetForm(emptyAssetForm()); setIsAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Asset
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(VIEW_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                cfg.color,
                active && cfg.activeColor
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{cfg.label}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mt-2">{counts[key] ?? 0}</div>
            </button>
          );
        })}
      </div>

      {store?.summary?.length > 0 && view === "used" && (
        <div className="grid gap-4 md:grid-cols-3">
          {store.summary.map((row) => (
            <Card key={row.category_id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{row.category_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{row.available_count}</div>
                <p className="text-xs text-muted-foreground mt-1">Assigned active</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {VIEW_CONFIG[view].label} ({store?.items?.length || 0})
          </CardTitle>
          <div className="w-[220px]">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            renderTable()
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
            <DialogDescription>
              Save a device to the {currentUser.department} store so it can be assigned on future requests
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Asset name *</Label>
              <Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="e.g. Dell Latitude 5440" />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={assetForm.category} onValueChange={(v) => setAssetForm({ ...assetForm, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60">
                  {managedCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input value={assetForm.brand} onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Serial number</Label>
              <Input value={assetForm.serial_number} onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })} placeholder="Optional — unique" />
            </div>
            <div>
              <Label>Specification / details</Label>
              <Textarea value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" min={1} value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Condition</Label>
                <Select value={assetForm.condition} onValueChange={(v) => setAssetForm({ ...assetForm, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={assetForm.current_location} onChange={(e) => setAssetForm({ ...assetForm, current_location: e.target.value })} placeholder={currentUser.department} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAsset} disabled={submitting}>{submitting ? "Saving..." : "Save to Store"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
