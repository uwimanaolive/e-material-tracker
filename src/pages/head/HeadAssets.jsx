import React from "react";
import { useStore } from "../../store";
import { assignmentsApi } from "../../api/assignments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { StatusBadge } from "../../components/StatusBadge";
import { Monitor, Package } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { safeFormatDate } from "@/utils/formatDate";

export const HeadAssets = () => {
  const { currentUser } = useStore();
  const [assignments, setAssignments] = React.useState([]);
  const [summary, setSummary] = React.useState([]);
  const [filterCategory, setFilterCategory] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [data, sum] = await Promise.all([
        assignmentsApi.getAll({ department: currentUser.department }),
        assignmentsApi.getDepartmentSummary(currentUser.department),
      ]);
      setAssignments(data);
      setSummary(sum);
    } catch (error) {
      console.error("Failed to load assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayAssignments = filterCategory
    ? assignments.filter((a) => a.category_name === filterCategory)
    : assignments;

  if (loading) return <div className="p-6">Loading...</div>;

  const totalAssets = summary.reduce((n, s) => n + parseInt(s.total_assigned || 0, 10), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Department Assets</h1>
        <p className="text-muted-foreground">Assets assigned to employees in {currentUser.department}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card className={`cursor-pointer transition-shadow hover:shadow-md ${!filterCategory ? "ring-2 ring-primary" : ""}`} onClick={() => setFilterCategory(null)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">All Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalAssets}</p>
            <p className="text-xs text-muted-foreground mt-1">Total assigned</p>
          </CardContent>
        </Card>
        {summary.map((s) => (
          <Card
            key={s.category_id}
            className={`cursor-pointer transition-shadow hover:shadow-md ${filterCategory === s.category_name ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterCategory(s.category_name === filterCategory ? null : s.category_name)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium leading-tight">{s.category_name}</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.total_assigned}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{s.active_count} active</Badge>
                {parseInt(s.needs_attention, 10) > 0 && (
                  <Badge variant="destructive" className="text-xs">{s.needs_attention} attention</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            {filterCategory ? `${filterCategory} — Assigned Assets` : "Department Asset Inventory"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayAssignments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No assets assigned to this department</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.asset_name}</TableCell>
                    <TableCell>{assignment.category_name || "—"}</TableCell>
                    <TableCell>{assignment.serial_number}</TableCell>
                    <TableCell>{assignment.assigned_to_name}</TableCell>
                    <TableCell>{safeFormatDate(assignment.assigned_date)}</TableCell>
                    <TableCell><StatusBadge status={assignment.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
