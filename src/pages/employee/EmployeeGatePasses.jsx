import React from "react";
import { useStore } from "../../store";
import { gatePassesApi } from "../../api/gatePasses";
import { assignmentsApi } from "../../api/assignments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { FileText, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { format } from "date-fns";
import { GatePassCard } from "../../components/GatePassCard";
import { toast } from "sonner";

export const EmployeeGatePasses = () => {
  const { currentUser } = useStore();
  const [gatePasses, setGatePasses] = React.useState([]);
  const [activePassDetails, setActivePassDetails] = React.useState([]);
  const [assignments, setAssignments] = React.useState([]);
  const [selectedGatePass, setSelectedGatePass] = React.useState(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    asset_id: "",
    from_location: "",
    to_location: "",
    reason: "",
    departure_date: "",
    expected_return_date: "",
    no_return: false,
    notes: "",
  });

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [passesData, assignmentsData] = await Promise.all([
        gatePassesApi.getMy(),
        assignmentsApi.getMy(),
      ]);
      setGatePasses(passesData);
      setAssignments(assignmentsData);

      const active = passesData.filter((gp) => gp.status === "active");
      if (active.length) {
        const details = await Promise.all(active.map((gp) => gatePassesApi.getById(gp.id)));
        setActivePassDetails(details.filter((d) => d.pass_token));
      } else {
        setActivePassDetails([]);
      }
    } catch (error) {
      console.error("Failed to load gate passes:", error);
      toast.error("Failed to load gate passes");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({
      asset_id: "",
      from_location: currentUser.department || "",
      to_location: "",
      reason: "",
      departure_date: "",
      expected_return_date: "",
      no_return: false,
      notes: "",
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.asset_id || !form.to_location || !form.reason || !form.departure_date) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.no_return && !form.expected_return_date) {
      toast.error("Expected return date is required unless permanent move is selected");
      return;
    }

    setSubmitting(true);
    try {
      await gatePassesApi.create({
        asset_id: parseInt(form.asset_id),
        from_location: form.from_location,
        to_location: form.to_location,
        reason: form.reason,
        departure_date: form.departure_date,
        expected_return_date: form.no_return ? null : form.expected_return_date,
        no_return: form.no_return,
        notes: form.notes,
      });
      toast.success("Gate pass request submitted");
      setIsCreateOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to submit gate pass");
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (gp) => {
    try {
      const detail = await gatePassesApi.getById(gp.id);
      setSelectedGatePass(detail);
    } catch (error) {
      toast.error("Failed to load gate pass details");
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const activePasses = activePassDetails.length
    ? activePassDetails
    : gatePasses.filter((gp) => gp.status === "active" && gp.pass_token);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Gate Passes</h1>
          <p className="text-muted-foreground">Request and track asset movement</p>
        </div>
        <Button onClick={openCreate} disabled={assignments.length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          Request Gate Pass
        </Button>
      </div>

      {activePasses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active Gate Passes — Show at Security</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePasses.map((gp) => (
              <GatePassCard key={gp.id} gatePass={gp} />
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gate Pass History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gatePasses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No gate passes yet</p>
              {assignments.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={openCreate}>
                  Request your first gate pass
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gate Pass #</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Departure Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gatePasses.map((gp) => (
                  <TableRow key={gp.id}>
                    <TableCell className="font-medium">{gp.gate_pass_number}</TableCell>
                    <TableCell>{gp.asset_name}</TableCell>
                    <TableCell>{gp.from_location}</TableCell>
                    <TableCell>{gp.to_location}</TableCell>
                    <TableCell>{format(new Date(gp.departure_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={gp.status} item={gp} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleView(gp)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Gate Pass</DialogTitle>
            <DialogDescription>Request permission to move an assigned asset</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset *</Label>
              <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assigned asset" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.asset_id.toString()}>
                      {a.asset_name} — {a.serial_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Location *</Label>
              <Input value={form.from_location} onChange={(e) => setForm({ ...form, from_location: e.target.value })} />
            </div>
            <div>
              <Label>To Location *</Label>
              <Input value={form.to_location} onChange={(e) => setForm({ ...form, to_location: e.target.value })} placeholder="Destination" />
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Purpose of movement" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Departure Date *</Label>
                <Input type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} />
              </div>
              <div>
                <Label>Expected Return</Label>
                <Input type="date" value={form.expected_return_date} disabled={form.no_return}
                  onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="no_return" checked={form.no_return}
                onCheckedChange={(v) => setForm({ ...form, no_return: !!v, expected_return_date: v ? "" : form.expected_return_date })} />
              <Label htmlFor="no_return" className="font-normal cursor-pointer">
                Permanent move — no return (asset will not come back)
              </Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedGatePass} onOpenChange={(open) => !open && setSelectedGatePass(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gate Pass Details</DialogTitle>
            <DialogDescription>{getStatusHint(selectedGatePass?.status, selectedGatePass)}</DialogDescription>
          </DialogHeader>
          {selectedGatePass && (
            <div className="space-y-4">
              {selectedGatePass.status === "active" && selectedGatePass.pass_token ? (
                <GatePassCard gatePass={selectedGatePass} />
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium">Asset</p>
                    <p className="text-sm text-muted-foreground">{selectedGatePass.asset_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Route</p>
                    <p className="text-sm text-muted-foreground">{selectedGatePass.from_location} → {selectedGatePass.to_location}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reason</p>
                    <p className="text-sm text-muted-foreground">{selectedGatePass.reason}</p>
                  </div>
                </>
              )}
              <StatusBadge status={selectedGatePass.status} item={selectedGatePass} />
              {selectedGatePass.timeline && (
                <div>
                  <p className="text-sm font-medium mb-2">Timeline</p>
                  <Timeline timeline={selectedGatePass.timeline} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
