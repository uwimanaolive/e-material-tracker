import React from "react";
import { departmentsApi } from "../../api/departments";
import { categoriesApi } from "../../api/categories";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Building, Plus, Pencil, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { toast } from "sonner";

export const HRDepartments = () => {
  const [departments, setDepartments] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isStaffOpen, setIsStaffOpen] = React.useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = React.useState(false);
  const [editingDept, setEditingDept] = React.useState(null);
  const [selectedDept, setSelectedDept] = React.useState(null);
  const [staff, setStaff] = React.useState([]);
  const [selectedCategories, setSelectedCategories] = React.useState([]);
  const [form, setForm] = React.useState({ name: "", description: "" });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depts, cats] = await Promise.all([departmentsApi.getAll(), categoriesApi.getAll()]);
      setDepartments(depts);
      setCategories(cats);
    } catch (error) {
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: "", description: "" });
    setIsFormOpen(true);
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setForm({ name: dept.name, description: dept.description || "" });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (editingDept) {
        await departmentsApi.update(editingDept.id, form);
        toast.success("Department updated");
      } else {
        await departmentsApi.create(form);
        toast.success("Department created");
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  };

  const viewStaff = async (dept) => {
    try {
      const data = await departmentsApi.getStaff(dept.id);
      setSelectedDept(dept);
      setStaff(data);
      setIsStaffOpen(true);
    } catch (error) {
      toast.error("Failed to load staff");
    }
  };

  const manageCategories = async (dept) => {
    try {
      const linked = await departmentsApi.getCategories(dept.id);
      setSelectedDept(dept);
      setSelectedCategories(linked.map((c) => c.id));
      setIsCategoriesOpen(true);
    } catch (error) {
      toast.error("Failed to load categories");
    }
  };

  const saveCategories = async () => {
    setSubmitting(true);
    try {
      await departmentsApi.setCategories(selectedDept.id, selectedCategories);
      toast.success("Store categories updated for department");
      setIsCategoriesOpen(false);
    } catch (error) {
      toast.error(error.message || "Failed to update categories");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Register departments and link store categories</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            All Departments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dept.description || "—"}</TableCell>
                  <TableCell>{dept.staff_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => viewStaff(dept)}>
                        <Users className="w-3.5 h-3.5 mr-1" /> Staff
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => manageCategories(dept)}>Store Categories</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(dept)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "New Department"}</DialogTitle>
            <DialogDescription>Department details for the organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStaffOpen} onOpenChange={setIsStaffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDept?.name} — Staff</DialogTitle>
            <DialogDescription>{staff.length} members in this department</DialogDescription>
          </DialogHeader>
          {staff.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No staff assigned yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>{u.is_active ? "Active" : "Inactive"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Store Categories — {selectedDept?.name}</DialogTitle>
            <DialogDescription>Select which asset categories this department can see in the procurement store</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={selectedCategories.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <span className="text-sm">{cat.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoriesOpen(false)}>Cancel</Button>
            <Button onClick={saveCategories} disabled={submitting}>Save Categories</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
