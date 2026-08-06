import React from "react";
import { useStore } from "../../store";
import { assetsApi } from "../../api/assets";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Package, Monitor, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { StatusBadge } from "../../components/StatusBadge";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "../../components/ui/cn";

const VIEW_CONFIG = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    color: "border-green-200 bg-green-50 hover:bg-green-100",
    activeColor: "ring-2 ring-green-500 bg-green-100",
  },
  used: {
    label: "Used / Assigned",
    icon: Monitor,
    color: "border-blue-200 bg-blue-50 hover:bg-blue-100",
    activeColor: "ring-2 ring-blue-500 bg-blue-100",
  },
  lost: {
    label: "Lost",
    icon: XCircle,
    color: "border-red-200 bg-red-50 hover:bg-red-100",
    activeColor: "ring-2 ring-red-500 bg-red-100",
  },
  damaged: {
    label: "Damaged",
    icon: AlertTriangle,
    color: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    activeColor: "ring-2 ring-amber-500 bg-amber-100",
  },
};

export const HeadStore = () => {
  const { currentUser } = useStore();
  const [store, setStore] = React.useState(null);
  const [view, setView] = React.useState("available");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadStore(view);
  }, [view]);

  const loadStore = async (selectedView) => {
    setLoading(true);
    try {
      const data = await assetsApi.getStoreForDepartment(currentUser.department, selectedView);
      setStore(data);
    } catch {
      toast.error("Failed to load inventory store");
    } finally {
      setLoading(false);
    }
  };

  const counts = store?.counts || { available: 0, used: 0, lost: 0, damaged: 0 };

  const renderTable = () => {
    const items = store?.items || [];
    if (!items.length) {
      return (
        <p className="text-muted-foreground text-center py-8">
          No {VIEW_CONFIG[view].label.toLowerCase()} items found for your department store
        </p>
      );
    }

    if (view === "available") {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Pool</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category_name}</TableCell>
                <TableCell>{item.serial_number}</TableCell>
                <TableCell>{[item.brand, item.model].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell className="capitalize">{item.condition}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.store_department_name || currentUser.department}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    if (view === "used") {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Condition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category_name}</TableCell>
                <TableCell>{item.serial_number}</TableCell>
                <TableCell>{item.assigned_to_name || "—"}</TableCell>
                <TableCell>{item.department_name || "—"}</TableCell>
                <TableCell>{item.store_department_name || "—"}</TableCell>
                <TableCell className="capitalize">{item.condition}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report #</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Serial</TableHead>
            <TableHead>Reporter</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.report_number}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.category_name}</TableCell>
              <TableCell>{item.serial_number}</TableCell>
              <TableCell>{item.reporter_name || "—"}</TableCell>
              <TableCell>{item.department_name || "—"}</TableCell>
              <TableCell><StatusBadge status={item.report_status} /></TableCell>
              <TableCell>{format(new Date(item.created_at), "MMM d, yyyy")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Store</h1>
        <p className="text-muted-foreground">
          Full store overview for {currentUser.department} — available, assigned, lost, and damaged materials
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(VIEW_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                cfg.color,
                active && cfg.activeColor
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{cfg.label}</span>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mt-2">{counts[key] ?? 0}</div>
            </button>
          );
        })}
      </div>

      {store?.summary?.length > 0 && view === "available" && (
        <div className="grid gap-4 md:grid-cols-3">
          {store.summary.map((row) => (
            <Card key={row.category_id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{row.category_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{row.available_count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {row.reserved_for_department > 0
                    ? `${row.reserved_for_department} reserved for your department`
                    : "Department pool"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {VIEW_CONFIG[view].label} ({store?.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            renderTable()
          )}
        </CardContent>
      </Card>
    </div>
  );
};
