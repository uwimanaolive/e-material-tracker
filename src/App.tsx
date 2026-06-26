import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/not-found";
import GatePassVerify from "./pages/GatePassVerify";
import { useStore } from "./store";

// Components
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";

// Employee
import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";
import { EmployeeAssets } from "./pages/employee/EmployeeAssets";
import { EmployeeGatePasses } from "./pages/employee/EmployeeGatePasses";
import { EmployeeReports } from "./pages/employee/EmployeeReports";

// Head
import { HeadDashboard } from "./pages/head/HeadDashboard";
import { HeadAssets } from "./pages/head/HeadAssets";
import { HeadRequests } from "./pages/head/HeadRequests";
import { HeadAssignments } from "./pages/head/HeadAssignments";
import { HeadGatePasses } from "./pages/head/HeadGatePasses";
import { HeadReports } from "./pages/head/HeadReports";

// Specialist routes removed — former specialist users are now department heads
import { ProcurementDashboard } from "./pages/procurement/ProcurementDashboard";
import { ProcurementInventory } from "./pages/procurement/ProcurementInventory";
import { ProcurementRequests } from "./pages/procurement/ProcurementRequests";
import { ProcurementAssignments } from "./pages/procurement/ProcurementAssignments";
import { ProcurementGatePasses } from "./pages/procurement/ProcurementGatePasses";
import { ProcurementReports } from "./pages/procurement/ProcurementReports";

// HR
import { HRDashboard } from "./pages/hr/HRDashboard";
import { HRDepartments } from "./pages/hr/HRDepartments";
import { HREmployees } from "./pages/hr/HREmployees";

// Head Store
import { HeadIncoming } from "./pages/head/HeadIncoming";
import { HeadStore } from "./pages/head/HeadStore";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, allowedRoles }) => {
  const { currentUser } = useStore();

  if (!currentUser) return <Redirect to="/login" />;
  if (allowedRoles && !allowedRoles.includes(currentUser.role) && currentUser.role !== "specialist") {
    const redirectRole = currentUser.role === "specialist" ? "head" : currentUser.role;
    return <Redirect to={`/${redirectRole}`} />;
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
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/verify/gate-pass/:token" component={GatePassVerify} />

      {/* Employee Routes */}
      <Route path="/employee">
        <ProtectedRoute component={EmployeeDashboard} allowedRoles={["employee"]} />
      </Route>
      <Route path="/employee/assets">
        <ProtectedRoute component={EmployeeAssets} allowedRoles={["employee"]} />
      </Route>
      <Route path="/employee/gate-passes">
        <ProtectedRoute component={EmployeeGatePasses} allowedRoles={["employee"]} />
      </Route>
      <Route path="/employee/reports">
        <ProtectedRoute component={EmployeeReports} allowedRoles={["employee"]} />
      </Route>

      {/* Head Routes */}
      <Route path="/head">
        <ProtectedRoute component={HeadDashboard} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/assets">
        <ProtectedRoute component={HeadAssets} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/requests">
        <ProtectedRoute component={HeadRequests} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/assignments">
        <ProtectedRoute component={HeadAssignments} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/gate-passes">
        <ProtectedRoute component={HeadGatePasses} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/store">
        <ProtectedRoute component={HeadStore} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/reports">
        <ProtectedRoute component={HeadReports} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/incoming">
        <ProtectedRoute component={HeadIncoming} allowedRoles={["head"]} />
      </Route>

      {/* Legacy specialist URLs → head dashboard */}
      <Route path="/specialist/:rest*">
        <Redirect to="/head/incoming" />
      </Route>
      <Route path="/specialist">
        <Redirect to="/head" />
      </Route>

      {/* Procurement Routes */}
      <Route path="/procurement">
        <ProtectedRoute component={ProcurementDashboard} allowedRoles={["procurement"]} />
      </Route>
      <Route path="/procurement/inventory">
        <ProtectedRoute component={ProcurementInventory} allowedRoles={["procurement"]} />
      </Route>
      <Route path="/procurement/requests">
        <ProtectedRoute component={ProcurementRequests} allowedRoles={["procurement"]} />
      </Route>
      <Route path="/procurement/assignments">
        <ProtectedRoute component={ProcurementAssignments} allowedRoles={["procurement"]} />
      </Route>
      <Route path="/procurement/gate-passes">
        <ProtectedRoute component={ProcurementGatePasses} allowedRoles={["procurement"]} />
      </Route>
      <Route path="/procurement/reports">
        <ProtectedRoute component={ProcurementReports} allowedRoles={["procurement"]} />
      </Route>

      {/* HR Routes */}
      <Route path="/hr">
        <ProtectedRoute component={HRDashboard} allowedRoles={["hr"]} />
      </Route>
      <Route path="/hr/departments">
        <ProtectedRoute component={HRDepartments} allowedRoles={["hr"]} />
      </Route>
      <Route path="/hr/employees">
        <ProtectedRoute component={HREmployees} allowedRoles={["hr"]} />
      </Route>

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
