import React from "react";
import { useStore } from "../../store";
import { issueReportsApi } from "../../api/issueReports";
import { assignmentsApi } from "../../api/assignments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge, getStatusHint } from "../../components/StatusBadge";
import { AttachmentViewer } from "../../components/AttachmentViewer";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Timeline } from "../../components/Timeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";

export const EmployeeReports = () => {
  const { currentUser } = useStore();
  const [reports, setReports] = React.useState([]);
  const [assignments, setAssignments] = React.useState([]);
  const [selectedReport, setSelectedReport] = React.useState(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    asset_id: "",
    issue_type: "",
    description: "",
    attachment: null,
  });

  React.useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [reportsData, assignmentsData] = await Promise.all([
        issueReportsApi.getMy(),
        assignmentsApi.getMy(),
      ]);
      setReports(reportsData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Failed to load reports:", error);
      toast.error("Failed to load issue reports");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ asset_id: "", issue_type: "", description: "", attachment: null });
    setIsCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.asset_id || !form.issue_type || !form.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await issueReportsApi.create(
        {
          asset_id: form.asset_id,
          issue_type: form.issue_type,
          description: form.description,
        },
        form.attachment
      );
      toast.success("Issue report submitted successfully");
      setIsCreateOpen(false);
      loadReports();
    } catch (error) {
      toast.error(error.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (report) => {
    try {
      const detail = await issueReportsApi.getById(report.id);
      setSelectedReport(detail);
    } catch (error) {
      toast.error("Failed to load report details");
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Issue Reports</h1>
          <p className="text-muted-foreground">Report damaged or lost assets with proof</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Report Issue
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Issue Report History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No issue reports yet — full timeline appears here after you submit</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                Report your first issue
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.report_number}</TableCell>
                    <TableCell>{report.asset_name}</TableCell>
                    <TableCell className="capitalize">{report.issue_type}</TableCell>
                    <TableCell>{format(new Date(report.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>{report.attachment ? "Attached" : "—"}</TableCell>
                    <TableCell><StatusBadge status={report.status} item={report} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleView(report)}>
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
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>Submit a report for a damaged or lost assigned asset</DialogDescription>
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
              <Label>Issue Type *</Label>
              <Select value={form.issue_type} onValueChange={(v) => setForm({ ...form, issue_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="loss">Loss / Missing</SelectItem>
                  <SelectItem value="malfunction">Malfunction</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what happened..."
                rows={4}
              />
            </div>
            <div>
              <Label>Proof / Attachment</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] || null })}
              />
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, PDF, or DOC — max 5 MB</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue Report Details</DialogTitle>
            <DialogDescription>{getStatusHint(selectedReport?.status, selectedReport)}</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <StatusBadge status={selectedReport.status} item={selectedReport} />
              <div>
                <p className="text-sm font-medium">Asset</p>
                <p className="text-sm text-muted-foreground">{selectedReport.asset_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Issue Type</p>
                <p className="text-sm text-muted-foreground capitalize">{selectedReport.issue_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
              </div>
              <AttachmentViewer attachment={selectedReport.attachment} />
              {selectedReport.resolution_outcome && (
                <div>
                  <p className="text-sm font-medium">Resolution</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedReport.resolution_outcome}</p>
                </div>
              )}
              {selectedReport.timeline && (
                <div>
                  <p className="text-sm font-medium mb-2">Timeline</p>
                  <Timeline timeline={selectedReport.timeline} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
