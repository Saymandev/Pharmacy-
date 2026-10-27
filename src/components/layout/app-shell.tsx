"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  Command,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Pill,
  Settings2,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Overview } from "@/components/dashboard/overview";
import { PosWorkspace } from "@/features/pos/pos-workspace";
import { CatalogInventoryWorkspace } from "@/features/catalog/catalog-inventory-workspace";
import { PurchaseWorkspace } from "@/features/purchases/purchase-workspace";

const plannedModules = [
  { label: "Point of sale", icon: ShoppingCart, href: "/pos" },
  { label: "Medicine catalog", icon: Pill, href: "/catalog" },
  { label: "Inventory", icon: PackageSearch, href: "/inventory" },
  { label: "Purchases", icon: Boxes, href: "/purchases" },
  { label: "Customers", icon: UsersRound },
  { label: "Reports", icon: Activity },
];

export function AppShell() {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (status !== "authenticated") {
    return <main className="auth-loading"><span className="loading-mark"><Pill size={19} /></span><span>Opening your workspace…</span></main>;
  }

  const initials = (user?.fullName ?? "Pharmacy User")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="/dashboard" aria-label="Pharmacy home">
          <span className="brand-mark"><Pill size={21} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Pharmacy</strong><small>CARE · CONTROL · CLARITY</small></span>
        </a>

        <div className="branch-switcher">
          <span className="branch-avatar">P</span>
          <span className="branch-name"><strong>Pharmacy</strong><small>Default workspace</small></span>
          <ChevronDown size={15} />
        </div>

        <nav className="side-navigation" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          <a className={`nav-link ${pathname === "/dashboard" ? "nav-link-active" : ""}`} href="/dashboard"><LayoutDashboard size={17} /><span>Overview</span></a>
          <p className="nav-caption nav-caption-spaced">PHARMACY</p>
          {plannedModules.map(({ label, icon: Icon, href }) => href ? (
            <a className={`nav-link nav-link-planned ${pathname === href ? "nav-link-active" : ""}`} key={label} href={href}>
              <Icon size={17} /><span>{label}</span><span className="nav-soon">Open</span>
            </a>
          ) : <button className="nav-link nav-link-planned" key={label} type="button" disabled title={`${label} is planned for an upcoming implementation phase`}><Icon size={17} /><span>{label}</span><span className="nav-soon">Soon</span></button>)}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-link" type="button" disabled><Settings2 size={17} /><span>Settings</span><span className="nav-soon">Soon</span></button>
          <button className="nav-link" type="button" disabled><CircleHelp size={17} /><span>Help &amp; support</span></button>
          <div className="sidebar-footer"><span className="online-dot" />All systems operational</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-actions">
            <span className="shortcut-hint"><Command size={12} /> K</span>
            <button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="topbar-divider" />
            <div className="user-menu">
              <span className="user-avatar">{initials}</span>
              <span className="user-menu-copy"><strong>{user?.fullName}</strong><small>{user?.role?.name ?? "Team member"}</small></span>
              <button className="logout-button" type="button" onClick={handleLogout} aria-label="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <main className={`workspace-content ${["/pos", "/catalog", "/inventory", "/purchases"].includes(pathname) ? "workspace-content-pos" : ""}`}>
          {pathname === "/pos" ? <PosWorkspace /> : pathname === "/catalog" || pathname === "/inventory" ? <CatalogInventoryWorkspace mode={pathname === "/catalog" ? "catalog" : "inventory"} /> : pathname === "/purchases" ? <PurchaseWorkspace /> : <Overview />}
        </main>
        <footer className="workspace-footer"><span>Pharmacy POS</span><span>Secure workspace · Asia/Dhaka</span></footer>
      </div>
    </div>
  );
}
