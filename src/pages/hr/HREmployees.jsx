import React from "react";
import { usersApi } from "../../api/users";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Users, Plus, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";

const HR_ASSIGNABLE_ROLES = ["employee", "head"];

const emptyForm = () => ({
  name: "",
  username: "",
  password: "",
  email: "",
  role: "employee",
  department: "",
  is_active: true,
});

export const HREmployees = () => {
  const [users, setUsers] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm());
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, deptsData] = await Promise.all([usersApi.getAll(), departmentsApi.getAll()]);
      setUsers(usersData.filter((u) => HR_ASSIGNABLE_ROLES.includes(u.role) || u.role === "hr"));
      setDepartments(deptsData.filter((d) => d.name !== "Procurement"));
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username,
      password: "",
      email: user.email || "",
      role: user.role,
      department: user.department,
      is_active: user.is_active !== false,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.department || (!editingUser && (!form.username || !form.password))) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department,
          is_active: form.is_active,
        });
        toast.success("Employee updated");
      } else {
        await usersApi.create({
          name: form.name,
          username: form.username,
          password: form.password,
          email: form.email,
          role: form.role,
          department: form.department,
        });
        toast.success("Employee registered");
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to save employee");
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
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Register employees and assign them to departments</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Register Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Staff
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell className="capitalize">{user.role}</TableCell>
                  <TableCell>{user.is_active !== false ? "Active" : "Inactive"}</TableCell>
                  <TableCell>
                    {HR_ASSIGNABLE_ROLES.includes(user.role) && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit Employee" : "Register Employee"}</DialogTitle>
            <DialogDescription>Assign role and department for system access</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {!editingUser && (
              <>
                <div>
                  <Label>Username *</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HR_ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingUser && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving..." : editingUser ? "Update" : "Register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
