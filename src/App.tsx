import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/not-found";
import GatePassVerify from "./pages/GatePassVerify";
import { useStore } from "./store";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";

import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";
import { EmployeeAssets } from "./pages/employee/EmployeeAssets";
import { EmployeeGatePasses } from "./pages/employee/EmployeeGatePasses";
import { EmployeeReports } from "./pages/employee/EmployeeReports";

import { HeadDashboard } from "./pages/head/HeadDashboard";
import { HeadAssets } from "./pages/head/HeadAssets";
import { HeadRequests } from "./pages/head/HeadRequests";
import { HeadAssignments } from "./pages/head/HeadAssignments";
import { HeadGatePasses } from "./pages/head/HeadGatePasses";
import { HeadReports } from "./pages/head/HeadReports";
import { HeadIncoming } from "./pages/head/HeadIncoming";
import { HeadStore } from "./pages/head/HeadStore";

import { InventoryDashboard } from "./pages/inventory/InventoryDashboard";
import { InventoryAssets } from "./pages/inventory/InventoryAssets";
import { InventoryRequests } from "./pages/inventory/InventoryRequests";
import { InventoryAssignments } from "./pages/inventory/InventoryAssignments";
import { InventoryGatePasses } from "./pages/inventory/InventoryGatePasses";
import { InventoryReports } from "./pages/inventory/InventoryReports";

import { HRDashboard } from "./pages/hr/HRDashboard";
import { HRDepartments } from "./pages/hr/HRDepartments";
import { HREmployees } from "./pages/hr/HREmployees";

import { HSEDashboard } from "./pages/hse/HSEDashboard";
import { HSEReports } from "./pages/hse/HSEReports";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminHRUsers } from "./pages/admin/AdminHRUsers";
import { AdminDepartments } from "./pages/admin/AdminDepartments";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { getRoleBasePath, getRoleKey } from "./utils/roleRoutes";

const queryClient = new QueryClient();

const ProtectedRoute = ({ component: Component, allowedRoles }) => {
  const { currentUser } = useStore();
  if (!currentUser) return <Redirect to="/login" />;
  const role = getRoleKey(currentUser.role);
  if (allowedRoles && !allowedRoles.includes(role) && !allowedRoles.includes(currentUser.role)) {
    return <Redirect to={getRoleBasePath(currentUser.role)} />;
  }
  return (
    <Layout>
      <Component />
    </Layout>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/"><Redirect to="/login" /></Route>
      <Route path="/login" component={Login} />
      <Route path="/verify/gate-pass/:token" component={GatePassVerify} />

      <Route path="/employee"><ProtectedRoute component={EmployeeDashboard} allowedRoles={["employee"]} /></Route>
      <Route path="/employee/assets"><ProtectedRoute component={EmployeeAssets} allowedRoles={["employee"]} /></Route>
      <Route path="/employee/gate-passes"><ProtectedRoute component={EmployeeGatePasses} allowedRoles={["employee"]} /></Route>
      <Route path="/employee/reports"><ProtectedRoute component={EmployeeReports} allowedRoles={["employee"]} /></Route>

      <Route path="/head"><ProtectedRoute component={HeadDashboard} allowedRoles={["head"]} /></Route>
      <Route path="/head/assets"><ProtectedRoute component={HeadAssets} allowedRoles={["head"]} /></Route>
      <Route path="/head/requests"><ProtectedRoute component={HeadRequests} allowedRoles={["head"]} /></Route>
      <Route path="/head/assignments"><ProtectedRoute component={HeadAssignments} allowedRoles={["head"]} /></Route>
      <Route path="/head/gate-passes"><ProtectedRoute component={HeadGatePasses} allowedRoles={["head"]} /></Route>
      <Route path="/head/store"><ProtectedRoute component={HeadStore} allowedRoles={["head"]} /></Route>
      <Route path="/head/reports"><ProtectedRoute component={HeadReports} allowedRoles={["head"]} /></Route>
      <Route path="/head/incoming"><ProtectedRoute component={HeadIncoming} allowedRoles={["head"]} /></Route>

      <Route path="/specialist/:rest*"><Redirect to="/head/incoming" /></Route>
      <Route path="/specialist"><Redirect to="/head" /></Route>

      <Route path="/inventory"><ProtectedRoute component={InventoryDashboard} allowedRoles={["inventory"]} /></Route>
      <Route path="/inventory/assets"><ProtectedRoute component={InventoryAssets} allowedRoles={["inventory"]} /></Route>
      <Route path="/inventory/requests"><ProtectedRoute component={InventoryRequests} allowedRoles={["inventory"]} /></Route>
      <Route path="/inventory/assignments"><ProtectedRoute component={InventoryAssignments} allowedRoles={["inventory"]} /></Route>
      <Route path="/inventory/gate-passes"><ProtectedRoute component={InventoryGatePasses} allowedRoles={["inventory"]} /></Route>
      <Route path="/inventory/reports"><ProtectedRoute component={InventoryReports} allowedRoles={["inventory"]} /></Route>

      <Route path="/procurement/inventory"><Redirect to="/inventory/assets" /></Route>
      <Route path="/procurement/requests"><Redirect to="/inventory/requests" /></Route>
      <Route path="/procurement/assignments"><Redirect to="/inventory/assignments" /></Route>
      <Route path="/procurement/gate-passes"><Redirect to="/inventory/gate-passes" /></Route>
      <Route path="/procurement/reports"><Redirect to="/inventory/reports" /></Route>
      <Route path="/procurement/:rest*"><Redirect to="/inventory" /></Route>
      <Route path="/procurement"><Redirect to="/inventory" /></Route>

      <Route path="/Inventory"><Redirect to="/inventory" /></Route>
      <Route path="/Inventory/assets"><Redirect to="/inventory/assets" /></Route>
      <Route path="/Inventory/requests"><Redirect to="/inventory/requests" /></Route>
      <Route path="/Inventory/assignments"><Redirect to="/inventory/assignments" /></Route>
      <Route path="/Inventory/gate-passes"><Redirect to="/inventory/gate-passes" /></Route>
      <Route path="/Inventory/reports"><Redirect to="/inventory/reports" /></Route>
      <Route path="/Inventory/:rest*"><Redirect to="/inventory" /></Route>

      <Route path="/hr"><ProtectedRoute component={HRDashboard} allowedRoles={["hr"]} /></Route>
      <Route path="/hr/departments"><ProtectedRoute component={HRDepartments} allowedRoles={["hr"]} /></Route>
      <Route path="/hr/employees"><ProtectedRoute component={HREmployees} allowedRoles={["hr"]} /></Route>

      <Route path="/hse"><ProtectedRoute component={HSEDashboard} allowedRoles={["hse"]} /></Route>
      <Route path="/hse/reports"><ProtectedRoute component={HSEReports} allowedRoles={["hse"]} /></Route>

      <Route path="/super_admin"><Redirect to="/admin" /></Route>
      <Route path="/super_admin/:rest*"><Redirect to="/admin" /></Route>

      <Route path="/admin"><ProtectedRoute component={AdminDashboard} allowedRoles={["super_admin"]} /></Route>
      <Route path="/admin/hr-users"><ProtectedRoute component={AdminHRUsers} allowedRoles={["super_admin"]} /></Route>
      <Route path="/admin/departments"><ProtectedRoute component={AdminDepartments} allowedRoles={["super_admin"]} /></Route>
      <Route path="/admin/categories"><ProtectedRoute component={AdminCategories} allowedRoles={["super_admin"]} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
