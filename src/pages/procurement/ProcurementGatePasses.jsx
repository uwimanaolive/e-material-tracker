import React from "react";
import { gatePassesApi } from "../../api/gatePasses";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { FileText, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

export const ProcurementGatePasses = () => {
  const [pending, setPending] = React.useState([]);
  const [active, setActive] = React.useState([]);
  const [all, setAll] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pendingData, activeData, allData] = await Promise.all([
        gatePassesApi.getProcurementPending(),
        gatePassesApi.getAll({ status: "active" }),
        gatePassesApi.getAll(),
      ]);
      setPending(pendingData);
      setActive(activeData);
      setAll(allData);
    } catch (error) {
      toast.error("Failed to load gate passes");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (gp) => {
    try {
      const detail = await gatePassesApi.getById(gp.id);
      setSelected(detail);
      setNotes("");
    } catch (error) {
      toast.error("Failed to load details");
    }
  };

  const handleProcurementAction = async (action) => {
    try {
      await gatePassesApi.procurementAction(selected.id, { action, notes });
      toast.success(action === "approve" ? "Gate pass activated" : "Gate pass rejected");
      setSelected(null);
      loadData();
    } catch (error) {
      toast.error(error.message || "Action failed");
    }
  };

  const handleComplete = async () => {
    try {
      await gatePassesApi.complete(selected.id, { notes });
      toast.success("Gate pass closed — asset returned");
      setSelected(null);
      loadData();
    } catch (error) {
      toast.error(error.message || "Failed to complete");
    }
  };

  const PassTable = ({ data, actionLabel, onAction }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gate Pass #</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>Route</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items</TableCell></TableRow>
        ) : data.map((gp) => (
          <TableRow key={gp.id}>
            <TableCell className="font-medium">{gp.gate_pass_number}</TableCell>
            <TableCell>{gp.employee_name}</TableCell>
            <TableCell>{gp.asset_name}</TableCell>
            <TableCell>{gp.from_location} → {gp.to_location}</TableCell>
            <TableCell>{format(new Date(gp.created_at), "MMM d, yyyy")}</TableCell>
            <TableCell><StatusBadge status={gp.status} item={gp} /></TableCell>
            <TableCell><Button size="sm" variant="ghost" onClick={() => onAction ? onAction(gp) : openDetail(gp)}>{actionLabel || "View"}</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gate Passes</h1>
        <p className="text-muted-foreground">Confirm gate passes and track active movements</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Awaiting Confirmation ({pending.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="all">All History ({all.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Pending Confirmation</CardTitle></CardHeader>
          <CardContent><PassTable data={pending} actionLabel="Review" onAction={openDetail} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="active">
          <Card><CardHeader><CardTitle>Active Gate Passes</CardTitle></CardHeader>
          <CardContent><PassTable data={active} actionLabel="Complete" onAction={openDetail} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="all">
          <Card><CardHeader><CardTitle>Full History</CardTitle></CardHeader>
          <CardContent><PassTable data={all} actionLabel="View" onAction={openDetail} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gate Pass — {selected?.gate_pass_number}</DialogTitle>
            <DialogDescription>{selected?.employee_name} · {selected?.asset_name}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <StatusBadge status={selected.status} item={selected} />
              <p className="text-sm">{selected.from_location} → {selected.to_location}</p>
              <p className="text-sm text-muted-foreground">{selected.reason}</p>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              {selected.timeline && <Timeline timeline={selected.timeline} />}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            {selected?.status === "pending_procurement" && (
              <>
                <Button variant="destructive" onClick={() => handleProcurementAction("reject")}><X className="w-4 h-4 mr-1" /> Reject</Button>
                <Button onClick={() => handleProcurementAction("approve")}><Check className="w-4 h-4 mr-1" /> Confirm & Activate</Button>
              </>
            )}
            {selected?.status === "active" && (
              <Button onClick={handleComplete}>Complete & Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
