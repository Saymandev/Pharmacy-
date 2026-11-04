"use client";

import { DialogBehavior } from "@/components/ui/dialog-behavior";
import { Select } from "@/components/ui/select";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSidebarScroll } from "@/lib/browser/use-sidebar-scroll";
import { useBrowserPreference } from "@/lib/browser/use-browser-preference";
import Link from "next/link";
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
  Moon,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Truck,
  UsersRound,
  X,
  Sun,
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
import { useTheme } from "@/components/providers/theme-provider";
import { DisplayPreferences } from "@/components/preferences/display-preferences";
import { workspacePermissions as modulePermissions, canVisitWorkspace, workspaceDeniedMessage } from "@/lib/access/workspace-policy";
import { WorkspaceAccessNotice } from "./workspace-access-notice";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ActiveBranchProvider } from "@/components/providers/active-branch-provider";

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
  const { status, user, logout, hasPermission } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const {resolvedTheme:theme,setTheme}=useTheme();
  const [preferencesOpen,setPreferencesOpen]=useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useBrowserPreference<boolean>("pharmacy.sidebar-collapsed", false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { ref: sidebarRef, remember: rememberSidebarScroll, navigate: navigateSidebar } = useSidebarScroll(user?.id || "guest", `${pathname}:${mobileSidebarOpen}:${sidebarCollapsed}`, status === "authenticated");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileSidebarOpen(false);
    setProfileOpen(false);
  }

  useEffect(() => {
    if (!profileOpen) return;
    function closeOnOutside(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  useEffect(() => { const timer = window.setTimeout(() => setDemoMode(new URLSearchParams(window.location.search).get("demo") === "1"), 0); return () => window.clearTimeout(timer); }, []);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPasswordError(""); setPasswordNotice("");
    if (newPassword !== confirmPassword) { setPasswordError(t("New password and confirmation do not match.")); return; }
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError(t("Use at least 8 characters with an uppercase letter, lowercase letter and number.")); return;
    }
    setPasswordSaving(true);
    try {
      await api.post<unknown>("/auth/change-password", { currentPassword, newPassword, confirmPassword });
      setPasswordDialog(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordNotice(t("Your password has been changed."));
      window.setTimeout(() => setPasswordNotice(""), 5000);
    } catch (cause) {
      setPasswordError(t(cause instanceof ApiClientError ? cause.message : "Password could not be changed. Please try again."));
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
  const currentPageName = pathname === "/" || pathname === "/dashboard"
    ? "Overview"
    : plannedModules.find(({ href }) => href === pathname)?.label ?? "Overview";

  return (
    <ActiveBranchProvider><DialogBehavior/><div className={`app-frame${sidebarCollapsed ? " sidebar-collapsed" : ""}`} data-theme={theme}>
      {preferencesOpen&&<DisplayPreferences onClose={()=>setPreferencesOpen(false)}/>}
      {mobileSidebarOpen && <button type="button" className="sidebar-mobile-backdrop" aria-label={t("Close navigation")} onClick={() => setMobileSidebarOpen(false)} />}
      <aside ref={sidebarRef} onScroll={rememberSidebarScroll} className={`sidebar${mobileSidebarOpen ? " sidebar-mobile-open" : ""}`}>
        <Link scroll={false} onClick={navigateSidebar} className="brand" href={demoMode ? "/dashboard?demo=1" : "/dashboard"} aria-label={t("Home")}>
          <span className="brand-mark"><Pill size={21} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Pharmacy</strong><small>CARE · CONTROL · CLARITY</small></span>
        </Link>
        <button className="sidebar-mobile-close" type="button" aria-label={t("Close navigation")} onClick={() => setMobileSidebarOpen(false)}><X size={18}/></button>

        <div className="branch-switcher">
          <span className="branch-avatar">P</span>
          <span className="branch-name"><strong>Pharmacy</strong><small>Workspace</small></span>
        </div>

        <nav className="side-navigation" aria-label="Main navigation">
          <p className="nav-caption">{t("WORKSPACE")}</p>
          <Link scroll={false} onClick={navigateSidebar} className={`nav-link ${pathname === "/dashboard" ? "nav-link-active" : ""}`} title={t("Overview")} href={demoMode ? "/dashboard?demo=1" : "/dashboard"}><LayoutDashboard size={17} /><span>{t("Overview")}</span></Link>
          <p className="nav-caption nav-caption-spaced">{t("PHARMACY")}</p>
          {plannedModules.filter(({ href }) => !href || (modulePermissions[href] ?? []).some(hasPermission)).map(({ label, icon: Icon, href }) => href ? (
            <Link scroll={false} onClick={navigateSidebar} className={`nav-link nav-link-planned ${pathname === href ? "nav-link-active" : ""}`} key={label} title={t(label)} href={demoMode ? `${href}?demo=1` : href}>
              <Icon size={17} /><span>{t(label)}</span>
            </Link>
          ) : <button className="nav-link nav-link-planned" key={label} type="button" disabled title={`${t(label)} — ${t("Soon")}`}><Icon size={17} /><span>{t(label)}</span><span className="nav-soon">{t("Soon")}</span></button>)}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-link" type="button" onClick={()=>setPreferencesOpen(true)}><Settings2 size={17} /><span>{t("Settings")}</span></button>
          <button className="nav-link" type="button" disabled><CircleHelp size={17} /><span>{t("Help & support")}</span></button>
          <div className="sidebar-footer"><span className="online-dot" />{t("All systems operational")}</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-leading"><button className="topbar-menu-button" type="button" aria-label={mobileSidebarOpen ? t("Close navigation") : t("Toggle sidebar")} aria-expanded={mobileSidebarOpen} onClick={() => { if (window.matchMedia("(max-width: 800px)").matches) setMobileSidebarOpen((open) => !open); else setSidebarCollapsed((collapsed) => !collapsed); }}>{mobileSidebarOpen ? <X size={19}/> : sidebarCollapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}</button><div className="breadcrumb"><span>{t("Workspace")}</span><span className="breadcrumb-slash">/</span><strong>{t(currentPageName)}</strong></div></div>
          <div className="topbar-actions">
            <label className="language-switcher"><span className="sr-only">{t("Language")}</span><Select aria-label={t("Language")} value={language} onChange={(event) => setLanguage(event.target.value as "en" | "bn")}><option value="en">English</option><option value="bn">বাংলা</option></Select></label>
            <button className="icon-button theme-toggle" type="button" aria-label={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")} title={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button className="icon-button display-preferences-trigger" type="button" aria-label={t("Settings")} title={t("Settings")} onClick={()=>setPreferencesOpen(true)}><Settings2 size={18}/></button>
            {demoMode && <span className="demo-mode-badge"><span className="demo-badge-full">{t("DEMO DATA · Local only")}</span><span className="demo-badge-compact">{language === "bn" ? "ডেমো" : "DEMO"}</span></span>}<span className="shortcut-hint"><Command size={12} /> K</span>
            <button className="icon-button notification-button" type="button" aria-label={t("Notifications")}><Bell size={18} /><i /></button>
            <div className="topbar-divider" />
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button className="profile-trigger" type="button" aria-haspopup="menu" aria-expanded={profileOpen} aria-controls="profile-dropdown" onClick={() => setProfileOpen((open) => !open)}>
                <span className="user-avatar">{initials}</span>
                <span className="user-menu-copy"><strong>{language === "bn" ? user?.fullNameBangla || user?.fullName : user?.fullName}</strong><small>{user?.role?.name ?? "Team member"}</small></span>
                <ChevronDown className={profileOpen ? "profile-chevron is-open" : "profile-chevron"} size={16}/>
              </button>
              {profileOpen && <div className="profile-dropdown" id="profile-dropdown" role="menu" aria-label={t("Profile menu")}>
                <div className="profile-dropdown-identity"><span className="user-avatar">{initials}</span><span><strong>{language === "bn" ? user?.fullNameBangla || user?.fullName : user?.fullName}</strong><small>{user?.role?.name ?? "Team member"}</small></span></div>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setPasswordError(""); setPasswordDialog(true); }}><KeyRound size={16}/>{t("Change password")}</button>
                <button type="button" className="profile-signout" role="menuitem" onClick={() => { setProfileOpen(false); handleLogout(); }}><LogOut size={16}/>{t("Sign out")}</button>
              </div>}
            </div>
          </div>
        </header>
        <main className={`workspace-content ${["/pos", "/catalog", "/inventory", "/purchases", "/sales", "/returns", "/customers", "/finance"].includes(pathname) ? "workspace-content-pos" : ""}`}>
          {!canVisitWorkspace(pathname,hasPermission)?<WorkspaceAccessNotice message={workspaceDeniedMessage(pathname)} available={plannedModules.filter(item=>item.href&&canVisitWorkspace(item.href,hasPermission)).map(item=>({href:item.href!,label:item.label}))}/>:pathname === "/pos" ? <PosWorkspace /> : pathname === "/catalog" || pathname === "/inventory" ? <CatalogInventoryWorkspace mode={pathname === "/catalog" ? "catalog" : "inventory"} /> : pathname === "/purchases" ? <PurchaseWorkspace /> : pathname === "/suppliers" ? <SupplierWorkspace /> : pathname === "/sales" || pathname === "/returns" ? <SalesWorkspace mode={pathname === "/sales" ? "sales" : "returns"} /> : pathname === "/customers" ? <CustomerWorkspace /> : pathname === "/finance" ? <FinanceWorkspace /> : pathname === "/finance/consultations" ? <section className="data-page"><h1>{t("Doctor settlements")}</h1><p>{t("Hospital and doctor features are currently disabled.")}</p></section> : pathname === "/reports" ? <ReportsWorkspace /> : pathname === "/hr" ? <HrWorkspace /> : pathname === "/hr/rosters" ? <DutyRostersWorkspace /> : pathname === "/admin" ? <AdminWorkspace /> : pathname === "/hr/setup" ? <HrSetupWorkspace /> : pathname === "/access" ? <AccessWorkspace /> : pathname === "/catalog/setup" ? <CatalogSetupWorkspace /> : <Overview />}
        </main>
        <footer className="workspace-footer"><span>{t("Pharmacy POS")}</span><span>{t("Secure workspace · Asia/Dhaka")}</span></footer>
      </div>
      {passwordNotice && <div className="password-toast" role="status">{passwordNotice}</div>}
      {passwordDialog && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !passwordSaving && setPasswordDialog(false)}><section className="password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" onClick={(event) => event.stopPropagation()}><div className="password-dialog-heading"><span><KeyRound size={18}/></span><button className="pos-icon-action" type="button" onClick={() => setPasswordDialog(false)} aria-label={`${t("Close")} ${t("Change password")}`}><X size={16}/></button></div><h2 id="password-dialog-title">{t("Change your password")}</h2><p>{t("Confirm your current password, then choose a strong replacement.")}</p><form onSubmit={(event) => void changePassword(event)}><label>{t("Current password")}<input autoComplete="current-password" type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label><label>{t("New password")}<input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>{t("At least 8 characters, including uppercase, lowercase and a number.")}</small></label><label>{t("Confirm new password")}<input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>{passwordError && <div className="pos-dialog-error" role="alert">{t(passwordError)}</div>}<button className="pos-complete-button" type="submit" disabled={passwordSaving}>{passwordSaving ? t("Updating password…") : t("Update password")}</button></form></section></div>}
    </div></ActiveBranchProvider>
  );
}
