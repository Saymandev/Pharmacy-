"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  Command,
  LayoutDashboard,
  KeyRound,
  LogOut,
  PackageSearch,
  Pill,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Truck,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Overview } from "@/components/dashboard/overview";
import { PosWorkspace } from "@/features/pos/pos-workspace";
import { CatalogInventoryWorkspace } from "@/features/catalog/catalog-inventory-workspace";
import { PurchaseWorkspace } from "@/features/purchases/purchase-workspace";
import { SalesWorkspace } from "@/features/sales/sales-workspace";
import { CustomerWorkspace } from "@/features/customers/customer-workspace";
import { FinanceWorkspace } from "@/features/finance/finance-workspace";
import { ReportsWorkspace } from "@/features/reports/reports-workspace";
import { HrWorkspace } from "@/features/hr/hr-workspace";
import { DutyRostersWorkspace } from "@/features/hr/duty-rosters-workspace";
import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { HrSetupWorkspace } from "@/features/hr/hr-setup-workspace";
import { AccessWorkspace } from "@/features/access/access-workspace";
import { CatalogSetupWorkspace } from "@/features/catalog/catalog-setup-workspace";
import { api, ApiClientError } from "@/lib/api/client";
import { SupplierWorkspace } from "@/features/suppliers/supplier-workspace";

const plannedModules = [
  { label: "Point of sale", icon: ShoppingCart, href: "/pos" },
  { label: "Medicine catalog", icon: Pill, href: "/catalog" },
  { label: "Catalog settings", icon: Settings2, href: "/catalog/setup" },
  { label: "Inventory", icon: PackageSearch, href: "/inventory" },
  { label: "Purchases", icon: Boxes, href: "/purchases" },
  { label: "Suppliers", icon: Truck, href: "/suppliers" },
  { label: "Sales history", icon: Activity, href: "/sales" },
  { label: "Sales returns", icon: RotateCcw, href: "/returns" },
  { label: "Customers", icon: UsersRound, href: "/customers" },
  { label: "Finance", icon: Banknote, href: "/finance" },
  { label: "Reports", icon: Activity, href: "/reports" },
  { label: "HR & attendance", icon: UsersRound, href: "/hr" },
  { label: "Duty rosters", icon: Activity, href: "/hr/rosters" },
  { label: "HR setup", icon: Settings2, href: "/hr/setup" },
  { label: "Communications & settings", icon: Bell, href: "/admin" },
  { label: "Team access", icon: UsersRound, href: "/access" },
];

export function AppShell() {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPasswordError(""); setPasswordNotice("");
    if (newPassword !== confirmPassword) { setPasswordError("New password and confirmation do not match."); return; }
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError("Use at least 8 characters with an uppercase letter, lowercase letter and number."); return;
    }
    setPasswordSaving(true);
    try {
      await api.post<unknown>("/auth/change-password", { currentPassword, newPassword, confirmPassword });
      setPasswordDialog(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordNotice("Your password has been changed.");
      window.setTimeout(() => setPasswordNotice(""), 5000);
    } catch (cause) {
      setPasswordError(cause instanceof ApiClientError ? cause.message : "Password could not be changed. Please try again.");
    } finally { setPasswordSaving(false); }
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
              <button className="password-menu-button" type="button" onClick={() => { setPasswordError(""); setPasswordDialog(true); }}><KeyRound size={14}/><span>Change password</span></button>
              <button className="logout-button" type="button" onClick={handleLogout} aria-label="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <main className={`workspace-content ${["/pos", "/catalog", "/inventory", "/purchases", "/sales", "/returns", "/customers", "/finance"].includes(pathname) ? "workspace-content-pos" : ""}`}>
          {pathname === "/pos" ? <PosWorkspace /> : pathname === "/catalog" || pathname === "/inventory" ? <CatalogInventoryWorkspace mode={pathname === "/catalog" ? "catalog" : "inventory"} /> : pathname === "/purchases" ? <PurchaseWorkspace /> : pathname === "/suppliers" ? <SupplierWorkspace /> : pathname === "/sales" || pathname === "/returns" ? <SalesWorkspace mode={pathname === "/sales" ? "sales" : "returns"} /> : pathname === "/customers" ? <CustomerWorkspace /> : pathname === "/finance" ? <FinanceWorkspace /> : pathname === "/reports" ? <ReportsWorkspace /> : pathname === "/hr" ? <HrWorkspace /> : pathname === "/hr/rosters" ? <DutyRostersWorkspace /> : pathname === "/admin" ? <AdminWorkspace /> : pathname === "/hr/setup" ? <HrSetupWorkspace /> : pathname === "/access" ? <AccessWorkspace /> : pathname === "/catalog/setup" ? <CatalogSetupWorkspace /> : <Overview />}
        </main>
        <footer className="workspace-footer"><span>Pharmacy POS</span><span>Secure workspace · Asia/Dhaka</span></footer>
      </div>
      {passwordNotice && <div className="password-toast" role="status">{passwordNotice}</div>}
      {passwordDialog && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !passwordSaving && setPasswordDialog(false)}><section className="password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" onClick={(event) => event.stopPropagation()}><div className="password-dialog-heading"><span><KeyRound size={18}/></span><button className="pos-icon-action" type="button" onClick={() => setPasswordDialog(false)} aria-label="Close change password dialog"><X size={16}/></button></div><h2 id="password-dialog-title">Change your password</h2><p>Confirm your current password, then choose a strong replacement.</p><form onSubmit={(event) => void changePassword(event)}><label>Current password<input autoComplete="current-password" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label><label>New password<input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>At least 8 characters, including uppercase, lowercase and a number.</small></label><label>Confirm new password<input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>{passwordError && <div className="pos-dialog-error" role="alert">{passwordError}</div>}<button className="pos-complete-button" type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating password…" : "Update password"}</button></form></section></div>}
    </div>
  );
}
