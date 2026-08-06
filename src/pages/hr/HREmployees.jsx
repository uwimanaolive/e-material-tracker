import React from "react";
import { usersApi } from "../../api/users";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Users, Plus, Pencil } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

const HR_MANAGEABLE_ROLES = ["employee", "head", "hr", "inventory", "hse"];
const ROLE_LABELS = {
  employee: "Employee",
  head: "Department Head",
  hr: "HR",
  inventory: "Inventory",
  hse: "HSE",
  super_admin: "Super Admin",
  specialist: "Specialist",
  procurement: "Inventory",
};

const normalizeRole = (role) => (role === "procurement" ? "inventory" : role);

const emptyForm = () => ({
  name: "",
  username: "",
  password: "",
  email: "",
  role: "employee",
  department: "",
  is_active: true,
});

function departmentsForRole(role, allDepartments) {
  const r = normalizeRole(role);
  if (r === "inventory") return allDepartments.filter((d) => d.name === "Inventory");
  if (r === "hse") return allDepartments.filter((d) => d.name === "HSE");
  if (r === "hr") return allDepartments.filter((d) => d.name === "Human Resources");
  return allDepartments.filter((d) => !["Inventory", "Human Resources", "HSE"].includes(d.name));
}

function roleBadgeVariant(role) {
  switch (normalizeRole(role)) {
    case "head": return "default";
    case "inventory": return "secondary";
    case "hr": return "outline";
    case "hse": return "destructive";
    case "super_admin": return "default";
    default: return "secondary";
  }
}

export const HREmployees = () => {
  const [users, setUsers] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [roleFilter, setRoleFilter] = React.useState("all");
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
      setUsers(usersData.map((u) => ({ ...u, role: normalizeRole(u.role) })));
      setDepartments(deptsData);
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === "all") return true;
    return normalizeRole(u.role) === roleFilter;
  });

  const formDepartments = departmentsForRole(form.role, departments);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const openEdit = (user) => {
    const role = normalizeRole(user.role);
    if (role === "super_admin") {
      toast.error("Super admin users are managed from the Admin panel");
      return;
    }
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username,
      password: "",
      email: user.email || "",
      role,
      department: user.department,
      is_active: user.is_active !== false,
    });
    setIsFormOpen(true);
  };

  const handleRoleChange = (role) => {
    const depts = departmentsForRole(role, departments);
    setForm({
      ...form,
      role,
      department: depts.some((d) => d.name === form.department) ? form.department : (depts[0]?.name || ""),
    });
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
        toast.success("User updated");
      } else {
        await usersApi.create({
          name: form.name,
          username: form.username,
          password: form.password,
          email: form.email,
          role: form.role,
          department: form.department,
        });
        toast.success("User registered");
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to save user");
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
          <h1 className="text-2xl font-bold">All Users</h1>
          <p className="text-muted-foreground">Manage employees, department heads, HR, inventory, and HSE staff</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Register User
        </Button>
      </div>

      <Tabs value={roleFilter} onValueChange={setRoleFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({users.length})</TabsTrigger>
          <TabsTrigger value="employee">Employees ({users.filter((u) => u.role === "employee").length})</TabsTrigger>
          <TabsTrigger value="head">Heads ({users.filter((u) => u.role === "head").length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory ({users.filter((u) => u.role === "inventory").length})</TabsTrigger>
          <TabsTrigger value="hr">HR ({users.filter((u) => u.role === "hr").length})</TabsTrigger>
          <TabsTrigger value="hse">HSE ({users.filter((u) => u.role === "hse").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Staff Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No users in this category</p>
          ) : (
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
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.is_active !== false ? "Active" : "Inactive"}</TableCell>
                    <TableCell>
                      {HR_MANAGEABLE_ROLES.includes(normalizeRole(user.role)) && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Register User"}</DialogTitle>
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
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={handleRoleChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" className="max-h-60">
                  {HR_MANAGEABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent position="popper" side="bottom" className="max-h-60">
                  {formDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
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
