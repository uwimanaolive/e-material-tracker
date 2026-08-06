import React from "react";
import { dashboardApi } from "../../api/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Users, Building, Settings, Package } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../../components/ui/button";

export const AdminDashboard = () => {
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    dashboardApi.getAdminStats().then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Users", value: stats?.total_users, icon: Users, href: "/admin/hr-users" },
    { label: "Departments", value: stats?.total_departments, icon: Building, href: "/admin/departments" },
    { label: "Categories", value: stats?.total_categories, icon: Settings, href: "/admin/categories" },
    { label: "Assets", value: stats?.total_assets, icon: Package, href: null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="text-muted-foreground">Manage HR users, departments, categories, and system settings</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.value ?? "—"}</p>
                {c.href && <Link href={c.href}><Button variant="link" className="px-0 mt-2">Manage</Button></Link>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
