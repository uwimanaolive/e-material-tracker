import React from "react";
import { issueReportsApi } from "../../api/issueReports";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { AttachmentViewer } from "../../components/AttachmentViewer";
import { Shield, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

export const HSEReports = () => {
  const [pending, setPending] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setPending(await issueReportsApi.getHsePending());
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const openReport = async (report) => {
    try {
      setSelected(await issueReportsApi.getById(report.id));
      setNotes("");
    } catch {
      toast.error("Failed to load report");
    }
  };

  const handleAction = async (action) => {
    if (!notes.trim()) { toast.error("Comment is required"); return; }
    try {
      await issueReportsApi.hseAction(selected.id, { action, notes });
      toast.success(action === "approve" ? "Approved — forwarded" : "Rejected");
      setSelected(null);
      load();
    } catch (error) {
      toast.error(error.message || "Action failed");
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" />HSE Issue Reviews</h1>
        <p className="text-muted-foreground">Review employee damage/loss reports after department head approval</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Pending HSE Review ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No pending reviews</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.report_number}</TableCell>
                    <TableCell>{r.reporter_name}</TableCell>
                    <TableCell>{r.asset_name}</TableCell>
                    <TableCell className="capitalize">{r.issue_type}</TableCell>
                    <TableCell>{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => openReport(r)}>Review</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.report_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <StatusBadge status={selected.status} item={selected} />
              <p className="text-sm">{selected.description}</p>
              <AttachmentViewer attachment={selected.attachment} />
              {selected.timeline && <Timeline timeline={selected.timeline} />}
              <div>
                <Label>Comment *</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Required for approve or reject" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleAction("reject")}><X className="w-4 h-4 mr-1" />Reject</Button>
            <Button onClick={() => handleAction("approve")}><Check className="w-4 h-4 mr-1" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
