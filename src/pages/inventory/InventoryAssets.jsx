import React from "react";
import { assetsApi } from "../../api/assets";
import { categoriesApi } from "../../api/categories";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { Monitor, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
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
import { toast } from "sonner";

const emptyForm = () => ({
  name: "",
  category: "",
  serial_number: "",
  brand: "",
  model: "",
  purchase_date: "",
  purchase_cost: "",
  condition: "good",
  status: "available",
  notes: "",
  store_department: "",
});

export const InventoryAssets = () => {
  const [assets, setAssets] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState(null);
  const [retireAsset, setRetireAsset] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm());

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assetsData, categoriesData, deptsData] = await Promise.all([
        assetsApi.getAll(),
        categoriesApi.getAll(),
        departmentsApi.getAll(),
      ]);
      setAssets(assetsData);
      setCategories(categoriesData);
      setDepartments(deptsData.filter((d) => d.name !== "Inventory" && d.name !== "Human Resources"));
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingAsset(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name || "",
      category: asset.category_name || "",
      serial_number: asset.serial_number || "",
      brand: asset.brand || "",
      model: asset.model || "",
      purchase_date: asset.purchase_date ? asset.purchase_date.split("T")[0] : "",
      purchase_cost: asset.purchase_cost || "",
      condition: asset.condition || "good",
      status: asset.status || "available",
      notes: asset.notes || "",
      store_department: asset.store_department_name || "",
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category || !form.serial_number || !form.store_department) {
      toast.error("Name, category, serial number, and belonging department are required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        purchase_date: form.purchase_date || null,
        store_department: form.store_department,
      };

      if (editingAsset) {
        await assetsApi.update(editingAsset.id, payload);
        toast.success("Asset updated");
      } else {
        await assetsApi.create(payload);
        toast.success("Asset added to inventory");
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to save asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetire = async () => {
    setSubmitting(true);
    try {
      await assetsApi.retire(retireAsset.id);
      toast.success("Asset retired from inventory");
      setRetireAsset(null);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to retire asset");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage central asset inventory</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            All Assets ({assets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No assets in inventory</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>Add your first asset</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Store Pool</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>{asset.category_name}</TableCell>
                      <TableCell>{asset.serial_number}</TableCell>
                      <TableCell>{[asset.brand, asset.model].filter(Boolean).join(" / ") || "—"}</TableCell>
                      <TableCell className="capitalize">{asset.condition}</TableCell>
                      <TableCell><StatusBadge status={asset.status} /></TableCell>
                      <TableCell>{asset.store_department_name || "—"}</TableCell>
                      <TableCell>{asset.current_location || asset.current_department || "Inventory Store"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(asset)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {asset.status !== "disposed" && asset.status !== "written_off" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600"
                              onClick={() => setRetireAsset(asset)}
                              disabled={asset.status === "assigned"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>{editingAsset ? "Update asset details" : "Register a new asset in inventory"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serial Number *</Label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div>
                <Label>Purchase Cost</Label>
                <Input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingAsset && (
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="written_off">Written Off</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Belonging Department *</Label>
              <Select value={form.store_department} onValueChange={(v) => setForm({ ...form, store_department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.filter((d) => d.name !== "Inventory").map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Every asset must belong to a department store pool</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving..." : editingAsset ? "Update Asset" : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!retireAsset} onOpenChange={(open) => !open && setRetireAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retire <strong>{retireAsset?.name}</strong>? This will mark it as disposed and remove it from active inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetire} disabled={submitting}>
              {submitting ? "Retiring..." : "Retire Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

