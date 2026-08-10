import React from "react";
import { useStore } from "../../store";
import { gatePassesApi } from "../../api/gatePasses";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { FileText, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

export const HeadGatePasses = () => {
  const { currentUser } = useStore();
  const [pending, setPending] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [selectedGatePass, setSelectedGatePass] = React.useState(null);
  const [viewGatePass, setViewGatePass] = React.useState(null);
  const [actionNotes, setActionNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadGatePasses();
  }, []);

  const loadGatePasses = async () => {
    try {
      const [pendingData, historyData] = await Promise.all([
        gatePassesApi.getHeadPending(),
        gatePassesApi.getHeadDepartment(),
      ]);
      setPending(pendingData);
      setHistory(historyData);
    } catch (error) {
      toast.error("Failed to load gate passes");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (!actionNotes.trim()) { toast.error("Comment is required"); return; }
    try {
      await gatePassesApi.headAction(selectedGatePass.id, { action, notes: actionNotes });
      toast.success(action === "approve" ? "Gate pass approved" : "Gate pass rejected");
      setSelectedGatePass(null);
      setActionNotes("");
      loadGatePasses();
    } catch (error) {
      toast.error(error.message || "Failed to process gate pass");
    }
  };

  const handleView = async (gp) => {
    try {
      const detail = await gatePassesApi.getById(gp.id);
      setViewGatePass(detail);
    } catch (error) {
      toast.error("Failed to load gate pass details");
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const HistoryTable = ({ data, showActions = false }) => (
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
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No gate passes</TableCell>
          </TableRow>
        ) : (
          data.map((gp) => (
            <TableRow key={gp.id}>
              <TableCell className="font-medium">{gp.gate_pass_number}</TableCell>
              <TableCell>{gp.employee_name}</TableCell>
              <TableCell>{gp.asset_name}</TableCell>
              <TableCell>{gp.from_location} → {gp.to_location}</TableCell>
              <TableCell>{format(new Date(gp.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell><StatusBadge status={gp.status} item={gp} /></TableCell>
              <TableCell>
                {showActions ? (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGatePass(gp)}>Review</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleView(gp)}>View</Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gate Pass Approvals</h1>
        <p className="text-muted-foreground">Review requests and track full department history</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">Full History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTable data={pending} showActions />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Department Gate Pass History</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTable data={history} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedGatePass} onOpenChange={(open) => !open && setSelectedGatePass(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Gate Pass</DialogTitle>
            <DialogDescription>{selectedGatePass?.gate_pass_number}</DialogDescription>
          </DialogHeader>
          {selectedGatePass && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Employee</p>
                <p className="text-sm text-muted-foreground">{selectedGatePass.employee_name}</p>
              </div>
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
              <div>
                <p className="text-sm font-medium">Comment *</p>
                <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Required — explain your decision" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAction("approve")} className="flex-1">
                  <Check className="w-4 h-4 mr-2" /> Approve
                </Button>
                <Button onClick={() => handleAction("reject")} variant="destructive" className="flex-1">
                  <X className="w-4 h-4 mr-2" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewGatePass} onOpenChange={(open) => !open && setViewGatePass(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gate Pass Details</DialogTitle>
            <DialogDescription>{viewGatePass?.gate_pass_number}</DialogDescription>
          </DialogHeader>
          {viewGatePass && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={viewGatePass.status} item={viewGatePass} />
                <span className="text-sm text-muted-foreground">{viewGatePass.employee_name}</span>
              </div>
              <div>
                <p className="text-sm font-medium">Asset</p>
                <p className="text-sm text-muted-foreground">{viewGatePass.asset_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Route</p>
                <p className="text-sm text-muted-foreground">{viewGatePass.from_location} → {viewGatePass.to_location}</p>
              </div>
              {viewGatePass.timeline?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Timeline</p>
                  <Timeline timeline={viewGatePass.timeline} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
