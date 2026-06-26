import React from "react";
import { useStore } from "../../store";
import { assignmentsApi } from "../../api/assignments";
import { usersApi } from "../../api/users";
import { assetsApi } from "../../api/assets";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { Users, UserPlus, RotateCcw, ArrowRightLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";

export const HeadAssignments = () => {
  const { currentUser } = useStore();
  const [assignments, setAssignments] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [availableAssets, setAvailableAssets] = React.useState([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [actionAssignment, setActionAssignment] = React.useState(null);
  const [actionType, setActionType] = React.useState(null);
  const [selectedAsset, setSelectedAsset] = React.useState("");
  const [selectedEmployee, setSelectedEmployee] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, employeesData, assetsData] = await Promise.all([
        assignmentsApi.getAll({ department: currentUser.department }),
        usersApi.getAll(),
        assetsApi.getAvailable(),
      ]);
      setAssignments(assignmentsData.filter((a) => a.status === "active"));
      setEmployees(employeesData.filter((e) => e.department === currentUser.department && e.role === "employee"));
      setAvailableAssets(assetsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedAsset || !selectedEmployee) {
      toast.error("Please select an asset and employee");
      return;
    }
    setSubmitting(true);
    try {
      await assignmentsApi.create({
        asset_id: parseInt(selectedAsset),
        assigned_to: parseInt(selectedEmployee),
        department: currentUser.department,
        notes,
      });
      toast.success("Asset assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedAsset("");
      setSelectedEmployee("");
      setNotes("");
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to assign asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      await assignmentsApi.return(actionAssignment.id, { notes });
      toast.success("Asset returned to store");
      setActionAssignment(null);
      setNotes("");
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to return asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }
    setSubmitting(true);
    try {
      await assignmentsApi.reassign(actionAssignment.id, {
        assigned_to: parseInt(selectedEmployee),
        notes,
      });
      toast.success("Asset reassigned successfully");
      setActionAssignment(null);
      setActionType(null);
      setSelectedEmployee("");
      setNotes("");
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to reassign asset");
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
          <h1 className="text-2xl font-bold">Asset Assignments</h1>
          <p className="text-muted-foreground">Assign, reassign, and return department assets</p>
        </div>
        <Button onClick={() => setIsAssignDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Asset
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Current Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No active assignments</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.asset_name}</TableCell>
                    <TableCell>{assignment.assigned_to_name}</TableCell>
                    <TableCell>{assignment.assigned_by_name}</TableCell>
                    <TableCell>{new Date(assignment.assigned_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={assignment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setActionAssignment(assignment); setActionType("reassign"); setNotes(""); setSelectedEmployee(""); }}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                          Reassign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600"
                          onClick={() => { setActionAssignment(assignment); setActionType("return"); setNotes(""); }}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Return
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Asset</DialogTitle>
            <DialogDescription>Assign an available asset to an employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset</Label>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger><SelectValue placeholder="Select an asset" /></SelectTrigger>
                <SelectContent>
                  {availableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id.toString()}>
                      {asset.name} — {asset.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>{employee.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={submitting}>{submitting ? "Assigning..." : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionAssignment} onOpenChange={(open) => !open && (setActionAssignment(null), setActionType(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "return" ? "Return Asset" : "Reassign Asset"}</DialogTitle>
            <DialogDescription>{actionAssignment?.asset_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {actionType === "reassign" && (
              <div>
                <Label>New Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.id !== actionAssignment?.assigned_to).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>{employee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionAssignment(null); setActionType(null); }}>Cancel</Button>
            <Button
              variant={actionType === "return" ? "destructive" : "default"}
              onClick={actionType === "return" ? handleReturn : handleReassign}
              disabled={submitting}
            >
              {submitting ? "Processing..." : actionType === "return" ? "Return Asset" : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
