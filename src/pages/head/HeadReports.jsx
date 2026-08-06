import React from "react";
import { useStore } from "../../store";
import { issueReportsApi } from "../../api/issueReports";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { AttachmentViewer } from "../../components/AttachmentViewer";
import { AlertTriangle, Check, History } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Textarea } from "../../components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";

export const HeadReports = () => {
  const { currentUser } = useStore();
  const [pending, setPending] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [selectedReport, setSelectedReport] = React.useState(null);
  const [viewReport, setViewReport] = React.useState(null);
  const [ackNotes, setAckNotes] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const [p, h] = await Promise.all([
        issueReportsApi.getHeadPending(),
        issueReportsApi.getHeadDepartment(),
      ]);
      setPending(p);
      setHistory(h.filter((r) => r.status !== "pending_head"));
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const openReview = (report) => {
    setSelectedReport(report);
    setAckNotes("");
  };

  const openView = async (report) => {
    try {
      setViewReport(await issueReportsApi.getById(report.id));
    } catch {
      toast.error("Failed to load report");
    }
  };

  const handleAcknowledge = async (action) => {
    if (!ackNotes.trim()) { toast.error("Comment is required"); return; }
    try {
      await issueReportsApi.headAction(selectedReport.id, { action, notes: ackNotes });
      toast.success(action === "approve" ? "Approved — forwarded to HSE" : "Rejected");
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      toast.error(error.message || "Failed");
    }
  };

  const ReportTable = ({ data, showAck = false }) => (
    data.length === 0 ? (
      <p className="text-muted-foreground py-8 text-center">No reports</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report #</TableHead>
            <TableHead>Reporter</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((report) => (
            <TableRow key={report.id}>
              <TableCell className="font-medium">{report.report_number}</TableCell>
              <TableCell>{report.reporter_name}</TableCell>
              <TableCell>{report.asset_name}</TableCell>
              <TableCell className="capitalize">{report.issue_type}</TableCell>
              <TableCell>{format(new Date(report.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell><StatusBadge status={report.status} item={report} /></TableCell>
              <TableCell>
                {showAck ? (
                  <Button variant="ghost" size="sm" onClick={() => openReview(report)}>Review</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => openView(report)}>View History</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Issue Reports — {currentUser.department}</h1>
        <p className="text-muted-foreground">Acknowledge reports and track full issue history</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">Full History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Pending Acknowledgement</CardTitle></CardHeader>
            <CardContent><ReportTable data={pending} showAck /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />All Department Issue Reports</CardTitle></CardHeader>
            <CardContent><ReportTable data={history} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Issue Report</DialogTitle>
            <DialogDescription>{selectedReport?.report_number}</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <StatusBadge status={selectedReport.status} item={selectedReport} />
              <p className="text-sm">{selectedReport.description}</p>
              <AttachmentViewer attachment={selectedReport.attachment} />
              <Textarea value={ackNotes} onChange={(e) => setAckNotes(e.target.value)} placeholder="Required comment" />
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={() => handleAcknowledge("reject")}>Reject</Button>
                <Button className="flex-1" onClick={() => handleAcknowledge("approve")}><Check className="w-4 h-4 mr-2" />Approve & Forward to HSE</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewReport} onOpenChange={(o) => !o && setViewReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReport?.report_number}</DialogTitle>
            <DialogDescription>{getStatusHint(viewReport?.status, viewReport)}</DialogDescription>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4">
              <StatusBadge status={viewReport.status} item={viewReport} />
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Asset:</span> {viewReport.asset_name}</p>
                <p><span className="font-medium">Type:</span> {viewReport.issue_type}</p>
                <p><span className="font-medium">What happened:</span> {viewReport.description}</p>
                {viewReport.resolution_outcome && <p><span className="font-medium">Resolution:</span> {viewReport.resolution_outcome}</p>}
                {viewReport.resolution_notes && <p><span className="font-medium">Resolution notes:</span> {viewReport.resolution_notes}</p>}
              </div>
              <AttachmentViewer attachment={viewReport.attachment} />
              {viewReport.timeline && <Timeline timeline={viewReport.timeline} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
