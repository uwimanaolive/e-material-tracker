import React from "react";
import { adminApi } from "../../api/admin";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const AdminHRUsers = () => {
  const [users, setUsers] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", username: "", password: "", email: "", department: "Human Resources", is_active: true });

  React.useEffect(() => { load(); }, []);

  const load = async () => {
    const [u, d] = await Promise.all([adminApi.getHrUsers(), departmentsApi.getAll()]);
    setUsers(u);
    setDepartments(d);
  };

  const save = async () => {
    try {
      if (editUser) {
        await adminApi.updateHrUser(editUser.id, { name: form.name, email: form.email, department: form.department, is_active: form.is_active, password: form.password || undefined });
      } else {
        if (!form.password) { toast.error("Password required"); return; }
        await adminApi.createHrUser(form);
      }
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, username: user.username, password: "", email: user.email || "", department: user.department, is_active: user.is_active });
    setOpen(true);
  };

  const openNew = () => {
    setEditUser(null);
    setForm({ name: "", username: "", password: "", email: "", department: "Human Resources", is_active: true });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">HR Users</h1>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add HR User</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.department}</TableCell>
                  <TableCell>{u.is_active ? "Yes" : "No"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(u)}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? "Edit HR User" : "New HR User"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            {!editUser && <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>}
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>{editUser ? "New Password (optional)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editUser && (
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
