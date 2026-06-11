import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useStore } from "./store";

// Components
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";

// Employee
import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";
import { RequestForm } from "./pages/employee/RequestForm";
import { ReportForm } from "./pages/employee/ReportForm";

// Head
import { HeadDashboard } from "./pages/head/HeadDashboard";
import { ReviewRequests as HeadReviewRequests } from "./pages/head/ReviewRequests";

// HR
import { HRDashboard } from "./pages/hr/HRDashboard";
import { HRReviewRequests } from "./pages/hr/ReviewRequests";
import { ManageEmployees } from "./pages/hr/ManageEmployees";
import { ManageDepartments } from "./pages/hr/ManageDepartments";

// ICT
import { ICTDashboard } from "./pages/ict/ICTDashboard";
import { ICTReviewRequests } from "./pages/ict/ReviewRequests";
import { Inventory } from "./pages/ict/Inventory";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, allowedRoles }) => {
  const { currentUser } = useStore();
  
  if (!currentUser) return <Redirect to="/login" />;
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Basic redirect if they try to access another role's area
    return <Redirect to={`/${currentUser.role}`} />;
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

      {/* Employee Routes */}
      <Route path="/employee">
        <ProtectedRoute component={EmployeeDashboard} allowedRoles={["employee"]} />
      </Route>
      <Route path="/employee/request">
        <ProtectedRoute component={RequestForm} allowedRoles={["employee"]} />
      </Route>
      <Route path="/employee/report">
        <ProtectedRoute component={ReportForm} allowedRoles={["employee"]} />
      </Route>

      {/* Head Routes */}
      <Route path="/head">
        <ProtectedRoute component={HeadDashboard} allowedRoles={["head"]} />
      </Route>
      <Route path="/head/requests">
        <ProtectedRoute component={HeadReviewRequests} allowedRoles={["head"]} />
      </Route>

      {/* HR Routes */}
      <Route path="/hr">
        <ProtectedRoute component={HRDashboard} allowedRoles={["hr"]} />
      </Route>
      <Route path="/hr/requests">
        <ProtectedRoute component={HRReviewRequests} allowedRoles={["hr"]} />
      </Route>
      <Route path="/hr/employees">
        <ProtectedRoute component={ManageEmployees} allowedRoles={["hr"]} />
      </Route>
      <Route path="/hr/departments">
        <ProtectedRoute component={ManageDepartments} allowedRoles={["hr"]} />
      </Route>

      {/* ICT Routes */}
      <Route path="/ict">
        <ProtectedRoute component={ICTDashboard} allowedRoles={["ict"]} />
      </Route>
      <Route path="/ict/requests">
        <ProtectedRoute component={ICTReviewRequests} allowedRoles={["ict"]} />
      </Route>
      <Route path="/ict/inventory">
        <ProtectedRoute component={Inventory} allowedRoles={["ict"]} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
