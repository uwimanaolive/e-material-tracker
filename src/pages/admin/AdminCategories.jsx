import React from "react";
import { adminApi } from "../../api/admin";
import { categoriesApi } from "../../api/categories";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const AdminCategories = () => {
  const [categories, setCategories] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", description: "", specialist_department: "ICT" });

  React.useEffect(() => {
    Promise.all([categoriesApi.getAll(), departmentsApi.getAll()]).then(([c, d]) => {
      setCategories(c);
      setDepartments(d);
    });
  }, []);

  const reload = () => categoriesApi.getAll().then(setCategories);

  const save = async () => {
    try {
      if (edit) await adminApi.updateCategory(edit.id, form);
      else await adminApi.createCategory(form);
      toast.success("Saved");
      setOpen(false);
      reload();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Asset Categories</h1>
        <Button onClick={() => { setEdit(null); setForm({ name: "", description: "", specialist_department: "ICT" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Owning Dept</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.specialist_department_name || "—"}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEdit(c); setForm({ name: c.name, description: c.description || "", specialist_department: c.specialist_department_name || "ICT" }); setOpen(true); }}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Owning Department</Label>
              <Select value={form.specialist_department} onValueChange={(v) => setForm({ ...form, specialist_department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
