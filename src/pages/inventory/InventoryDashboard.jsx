import React from "react";
import { useStore } from "../../store";
import { dashboardApi } from "../../api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { CheckSquare, AlertTriangle, Monitor, Package, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export const InventoryDashboard = () => {
  const { currentUser } = useStore();
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      setStats(await dashboardApi.getInventoryStats());
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const pendingWork = (stats?.pending_requests || 0) + (stats?.pending_gate_passes || 0) + (stats?.pending_reports || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {currentUser.name}</p>
      </div>

      {pendingWork > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <p className="font-medium">{pendingWork} item(s) awaiting your action</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {(stats?.pending_requests || 0) > 0 && <Link href="/inventory/requests"><Button size="sm">{stats.pending_requests} Requests</Button></Link>}
              {(stats?.pending_gate_passes || 0) > 0 && <Link href="/inventory/gate-passes"><Button size="sm" variant="outline">{stats.pending_gate_passes} Gate Passes</Button></Link>}
              {(stats?.pending_reports || 0) > 0 && <Link href="/inventory/reports"><Button size="sm" variant="outline">{stats.pending_reports} Reports</Button></Link>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Assets", value: stats?.total_assets, icon: Package },
          { label: "Available", value: stats?.available_assets, icon: Monitor },
          { label: "Assigned", value: stats?.assigned_assets, icon: CheckSquare },
          { label: "Pending Requests", value: stats?.pending_requests, icon: AlertTriangle, href: "/inventory/requests" },
          { label: "Pending Gate Passes", value: stats?.pending_gate_passes, icon: FileText, href: "/inventory/gate-passes" },
          { label: "Pending Reports", value: stats?.pending_reports, icon: AlertTriangle, href: "/inventory/reports" },
          { label: "Low Stock Alerts", value: stats?.low_stock_alerts, icon: Monitor, href: "/inventory/assets" },
          { label: "Fulfilled (30d)", value: stats?.fulfilled_requests, icon: CheckSquare, href: "/inventory/requests" },
        ].map((s) => (
          <Card key={s.label} className={s.href ? "hover:border-primary/40 transition cursor-pointer" : ""}>
            {s.href ? (
              <Link href={s.href}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{s.value || 0}</div></CardContent>
              </Link>
            ) : (
              <>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{s.value || 0}</div></CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

