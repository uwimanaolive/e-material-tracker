import React from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "../store";
import { Shield, Home, PackagePlus, AlertTriangle, CheckSquare, Users, Building, Monitor, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import logo from "../assets/logo.webp";

const navConfig = {
  employee: [
    { label: "Dashboard", href: "/employee", icon: Home },
    { label: "Request Equipment", href: "/employee/request", icon: PackagePlus },
    { label: "Report Issue", href: "/employee/report", icon: AlertTriangle }
  ],
  head: [
    { label: "Dashboard", href: "/head", icon: Home },
    { label: "Review Requests", href: "/head/requests", icon: CheckSquare }
  ],
  hr: [
    { label: "Dashboard", href: "/hr", icon: Home },
    { label: "Review Requests", href: "/hr/requests", icon: CheckSquare },
    { label: "Employees", href: "/hr/employees", icon: Users },
    { label: "Departments", href: "/hr/departments", icon: Building }
  ],
  ict: [
    { label: "Dashboard", href: "/ict", icon: Home },
    { label: "Review Requests", href: "/ict/requests", icon: CheckSquare },
    { label: "Inventory", href: "/ict/inventory", icon: Monitor }
  ]
};

export const Layout = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { currentUser, setCurrentUser } = useStore();

  if (!currentUser) {
    setLocation("/login");
    return null;
  }

  const links = navConfig[currentUser.role] || [];
  const initials = currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase();

  const handleLogout = () => {
    setCurrentUser(null);
    setLocation("/login");
  };

  const getRoleColor = (role) => {
    switch(role) {
      case "employee": return "bg-primary text-primary-foreground";
      case "head": return "bg-accent text-accent-foreground";
      case "hr": return "bg-emerald-500 text-white";
      case "ict": return "bg-purple-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-background font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-primary flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-primary-foreground/10 text-primary-foreground">
          
          <img src={logo} alt="Logo" className="w-44" />

         
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary-foreground/10 text-accent border-l-4 border-accent -ml-[4px] pl-[15px] font-medium' : 'text-primary-foreground/70 hover:bg-primary-foreground/5 hover:text-primary-foreground'}`}>
                  <Icon className="w-4 h-4" />
                  {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="md:hidden flex items-center">
             <Shield className="w-6 h-6 mr-3 text-primary" />
             <span className="font-bold text-primary tracking-tight">E-Material Tracker</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right hidden sm:block">
                <p className="font-semibold text-foreground leading-none">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{currentUser.role} • {currentUser.department}</p>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className={`${getRoleColor(currentUser.role)} font-semibold text-xs`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="w-px h-8 bg-border mx-2 hidden sm:block"></div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};
