import React from "react";
import { dashboardApi } from "../../api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../../components/ui/button";

export const HSEDashboard = () => {
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    dashboardApi.getHseStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HSE Dashboard</h1>
        <p className="text-muted-foreground">Health, Safety & Environment — issue report reviews</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pending_reviews ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Reviewed</CardTitle>
            <Shield className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.reviewed_total ?? "—"}</p>
          </CardContent>
        </Card>
      </div>
      <Link href="/hse/reports"><Button>Review Pending Reports</Button></Link>
    </div>
  );
};
