import React from "react";
import { useStore } from "../../store";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Monitor, Package, AlertCircle, CheckCircle2, Check, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export const ICTDashboard = () => {
  const { currentUser, equipment, requests, setRequests } = useStore();
  const totalEq = equipment.reduce((acc, curr) => acc + curr.totalQty, 0);
  const availEq = equipment.reduce((acc, curr) => acc + curr.availableQty, 0);
  const inUseEq = equipment.reduce((acc, curr) => acc + curr.inUseQty, 0);
  const lowStock = equipment.filter(e => e.status !== "available").length;

  const pendingRequests = requests.filter(r => r.status === "pending_ict");

  // Chart data
  const categories = [...new Set(equipment.map(e => e.category))];
  const chartData = categories.map(cat => {
    const catItems = equipment.filter(e => e.category === cat);
    return {
      name: cat,
      Total: catItems.reduce((acc, c) => acc + c.totalQty, 0),
      Available: catItems.reduce((acc, c) => acc + c.availableQty, 0),
    };
  });

  const handleApprove = (id) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: "approved",
          timeline: [...r.timeline, {
            stage: "ICT Approval", actor: currentUser.name, action: "Approved", timestamp: new Date().toISOString(), note: "Equipment provisioned."
          }]
        };
      }
      return r;
    }));
    alert("Approved & Provisioned");
  };

  const handleReject = (id) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: "rejected",
          timeline: [...r.timeline, {
            stage: "ICT Approval", actor: currentUser.name, action: "Rejected", timestamp: new Date().toISOString(), note: "Insufficient stock."
          }]
        };
      }
      return r;
    }));
    alert("Rejected");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ICT Dashboard</h1>
        <p className="text-muted-foreground">Inventory overview and provisioning tasks.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEq}</div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availEq}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Use</CardTitle>
              <Monitor className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inUseEq}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStock}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" />
                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Available" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Provisioning Queue</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {pendingRequests.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground text-sm">No items to provision.</div>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                {pendingRequests.map(req => (
                  <div key={req.id} className="p-4 flex flex-col gap-3">
                    <div>
                      <p className="font-medium text-sm">{req.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{req.items.map(i => `${i.qty}x ${i.name}`).join(", ")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="w-full text-xs h-8 text-rose-600" onClick={() => handleReject(req.id)}>Reject</Button>
                      <Button size="sm" className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(req.id)}>Provision</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
