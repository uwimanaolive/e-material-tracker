import React, { useState, useEffect } from "react";
import { dashboardApi } from "../../api/dashboard";
import { departmentsApi } from "../../api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Building, Users, UserCheck, UserX } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../../components/ui/button";
import { motion } from "framer-motion";

export const HRDashboard = () => {
  const [stats, setStats] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, deptsData] = await Promise.all([
        dashboardApi.getHrStats(),
        departmentsApi.getAll(),
      ]);
      setStats(statsData);
      setDepartments(deptsData);
    } catch (error) {
      console.error("Failed to load HR dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Dashboard</h1>
          <p className="text-muted-foreground">Manage departments and employee registration</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/departments"><Button variant="outline">Departments</Button></Link>
          <Link href="/hr/employees"><Button>All Users</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Departments", value: stats?.total_departments || 0, icon: Building },
          { label: "Total Staff", value: stats?.total_staff || 0, icon: Users },
          { label: "Active Users", value: stats?.active_users || 0, icon: UserCheck },
          { label: "Inactive Users", value: stats?.inactive_users || 0, icon: UserX },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Departments Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Staff Count</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dept.description || "—"}</TableCell>
                  <TableCell>{dept.staff_count || 0}</TableCell>
                  <TableCell>
                    <Link href="/hr/departments">
                      <Button variant="ghost" size="sm">Manage</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
