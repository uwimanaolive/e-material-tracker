import React from "react";
import { adminApi } from "../../api/admin";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const AdminDepartments = () => {
  const [departments, setDepartments] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", description: "" });

  React.useEffect(() => { load(); }, []);
  const load = () => departmentsApi.getAll().then(setDepartments);

  const save = async () => {
    try {
      if (edit) await adminApi.updateDepartment(edit.id, form);
      else await adminApi.createDepartment(form);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Departments</h1>
        <Button onClick={() => { setEdit(null); setForm({ name: "", description: "" }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Staff</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {departments.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.name}</TableCell>
                <TableCell>{d.description}</TableCell>
                <TableCell>{d.staff_count}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEdit(d); setForm({ name: d.name, description: d.description || "" }); setOpen(true); }}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "New"} Department</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
