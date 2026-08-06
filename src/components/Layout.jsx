import React from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "../store";
import { Menu, Home, AlertTriangle, CheckSquare, Users, Monitor, LogOut, FileText, Building, Inbox, Shield, Settings, Package } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import logo from "../assets/logo.webp";
import { getRoleKey } from "../utils/roleRoutes";

const navConfig = {
  employee: [
    { label: "Dashboard", href: "/employee", icon: Home },
    { label: "My Assets", href: "/employee/assets", icon: Monitor },
    { label: "Gate Passes", href: "/employee/gate-passes", icon: FileText },
    { label: "Issue Reports", href: "/employee/reports", icon: AlertTriangle },
  ],
  head: [
    { label: "Dashboard", href: "/head", icon: Home },
    { label: "Department Assets", href: "/head/assets", icon: Monitor },
    { label: "Asset Requests", href: "/head/requests", icon: CheckSquare },
    { label: "Assignments", href: "/head/assignments", icon: Users },
    { label: "Incoming Approvals", href: "/head/incoming", icon: Inbox },
    { label: "Gate Pass Approvals", href: "/head/gate-passes", icon: FileText },
    { label: "Inventory Store", href: "/head/store", icon: Package },
    { label: "Issue Reports", href: "/head/reports", icon: AlertTriangle },
  ],
  inventory: [
    { label: "Dashboard", href: "/inventory", icon: Home },
    { label: "Assets & Categories", href: "/inventory/assets", icon: Monitor },
    { label: "Asset Requests", href: "/inventory/requests", icon: CheckSquare },
    { label: "Assignments", href: "/inventory/assignments", icon: Users },
    { label: "Gate Passes", href: "/inventory/gate-passes", icon: FileText },
    { label: "Issue Reports", href: "/inventory/reports", icon: AlertTriangle },
  ],
  hse: [
    { label: "Dashboard", href: "/hse", icon: Home },
    { label: "Issue Reviews", href: "/hse/reports", icon: Shield },
  ],
  hr: [
    { label: "Dashboard", href: "/hr", icon: Home },
    { label: "Departments", href: "/hr/departments", icon: Building },
    { label: "Employees", href: "/hr/employees", icon: Users },
  ],
  super_admin: [
    { label: "Dashboard", href: "/admin", icon: Home },
    { label: "HR Users", href: "/admin/hr-users", icon: Users },
    { label: "Departments", href: "/admin/departments", icon: Building },
    { label: "Categories", href: "/admin/categories", icon: Settings },
  ],
};

const NavLinks = ({ links, location, onNavigate }) =>
  links.map((link) => {
    const isActive = location === link.href;
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
          isActive
            ? "bg-primary-foreground/10 text-accent border-l-4 border-accent -ml-[4px] pl-[15px] font-medium"
            : "text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
        {link.label}
      </Link>
    );
  });

export const Layout = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!currentUser) setLocation("/login");
  }, [currentUser, setLocation]);

  if (!currentUser) return null;

  const roleKey = getRoleKey(currentUser.role);
  const links = navConfig[roleKey] || navConfig.employee;
  const initials = (currentUser.name || currentUser.username || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "employee": return "bg-primary text-primary-foreground";
      case "head": return "bg-accent text-accent-foreground";
      case "inventory":
      case "procurement": return "bg-emerald-500 text-white";
      case "hse": return "bg-orange-500 text-white";
      case "hr": return "bg-blue-600 text-white";
      case "super_admin": return "bg-violet-600 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-background font-sans">
      <aside className="w-64 bg-primary flex-shrink-0 flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-primary-foreground/10">
          <img src={logo} alt="ASSETS TRACKER" className="w-44" />
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          <NavLinks links={links} location={location} />
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-primary border-none">
                <SheetHeader className="h-16 flex items-center px-6 border-b border-primary-foreground/10">
                  <SheetTitle className="text-primary-foreground text-left">ASSETS TRACKER</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-3 py-4">
                  <NavLinks links={links} location={location} onNavigate={() => setMobileOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
            <span className="font-bold text-primary tracking-tight md:hidden">ASSETS TRACKER</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right hidden sm:block">
                <p className="font-semibold text-foreground leading-none">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{roleKey.replace("_", " ")} • {currentUser.department}</p>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className={`${getRoleColor(currentUser.role)} font-semibold text-xs`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="w-px h-8 bg-border mx-2 hidden sm:block" />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};
