import React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

export const ProcurementReports = () => {
  const [pending, setPending] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [selectedReport, setSelectedReport] = React.useState(null);
  const [viewReport, setViewReport] = React.useState(null);
  const [resolutionNotes, setResolutionNotes] = React.useState("");
  const [resolutionOutcome, setResolutionOutcome] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const [p, h] = await Promise.all([
        issueReportsApi.getProcurementPending(),
        issueReportsApi.getProcurementHistory(),
      ]);
      setPending(p);
      setHistory(h);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const openResolve = async (report) => {
    try {
      setSelectedReport(await issueReportsApi.getById(report.id));
      setResolutionNotes("");
      setResolutionOutcome("");
    } catch {
      toast.error("Failed to load report");
    }
  };

  const openView = async (report) => {
    try {
      setViewReport(await issueReportsApi.getById(report.id));
    } catch {
      toast.error("Failed to load report");
    }
  };

  const handleResolve = async () => {
    if (!resolutionOutcome) { toast.error("Select resolution outcome"); return; }
    try {
      await issueReportsApi.procurementAction(selectedReport.id, {
        resolution_notes: resolutionNotes,
        resolution_outcome: resolutionOutcome,
      });
      toast.success("Report resolved");
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      toast.error(error.message || "Failed to resolve");
    }
  };

  const ReportTable = ({ data, resolveMode = false }) => (
    data.length === 0 ? (
      <p className="text-muted-foreground py-8 text-center">No reports</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report #</TableHead>
            <TableHead>Reporter</TableHead>
            <TableHead>Dept</TableHead>
            <TableHead>Asset</TableHead>
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
              <TableCell>{report.reporter_department}</TableCell>
              <TableCell>{report.asset_name}</TableCell>
              <TableCell>{format(new Date(report.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell><StatusBadge status={report.status} item={report} /></TableCell>
              <TableCell>
                {resolveMode ? (
                  <Button variant="ghost" size="sm" onClick={() => openResolve(report)}>Resolve</Button>
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
        <h1 className="text-2xl font-bold">Issue Reports</h1>
        <p className="text-muted-foreground">Resolve pending reports and browse full issue history</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">All History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Awaiting Procurement Department</CardTitle></CardHeader>
            <CardContent><ReportTable data={pending} resolveMode /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Complete Issue History</CardTitle></CardHeader>
            <CardContent><ReportTable data={history} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve — {selectedReport?.report_number}</DialogTitle>
            <DialogDescription>{getStatusHint(selectedReport?.status, selectedReport)}</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <p className="text-sm">{selectedReport.description}</p>
              {selectedReport.assessment_recommendation && (
                <p className="text-sm bg-muted p-2 rounded">Owner dept recommendation: <strong>{selectedReport.assessment_recommendation}</strong></p>
              )}
              <AttachmentViewer attachment={selectedReport.attachment} />
              {selectedReport.timeline && <Timeline timeline={selectedReport.timeline} />}
              <div>
                <Label>Resolution Outcome</Label>
                <Select value={resolutionOutcome} onValueChange={setResolutionOutcome}>
                  <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repaired">Repair</SelectItem>
                    <SelectItem value="replaced">Replace</SelectItem>
                    <SelectItem value="disposed">Dispose</SelectItem>
                    <SelectItem value="write-off">Write-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Resolution notes" />
              <Button onClick={handleResolve} className="w-full"><Check className="w-4 h-4 mr-2" />Submit Resolution</Button>
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
              <p className="text-sm">{viewReport.description}</p>
              {viewReport.resolution_notes && <p className="text-sm"><strong>Resolution:</strong> {viewReport.resolution_notes}</p>}
              <AttachmentViewer attachment={viewReport.attachment} />
              {viewReport.timeline && <Timeline timeline={viewReport.timeline} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
