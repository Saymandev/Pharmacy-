"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CircleHelp,
  Clock3,
  PackageCheck,
  Pill,
  RefreshCw,
  ShoppingBag,
  MapPin,
  Wallet,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { getTodayPharmacyStats, getWeeklyPharmacyGraph } from "@/features/reports/report-service";
import { useAuth } from "@/components/providers/auth-provider";
import type { PharmacyDashboardStats, PharmacyGraphPoint } from "@/types/api";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

function formatCount(value: unknown, locale: string) {
  const count = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(count) ? count.toLocaleString(locale) : "—";
}

function formatMoney(value: unknown, locale: string) {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(amount) ? new Intl.NumberFormat(locale, { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(amount) : "—";
}

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dhaka",
  }).format(value);
}

function MetricCard({
  label,
  value,
  supporting,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  supporting: string;
  icon: typeof ShoppingBag;
  tone: "mint" | "blue" | "amber" | "rose";
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon-${tone}`}><Icon size={19} strokeWidth={1.8} /></div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-support">{supporting}</p>
    </article>
  );
}

function SalesChart({ points, locale, t }: { points: PharmacyGraphPoint[]; locale: string; t: (key: string) => string }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.sales, point.purchases]));

  return (
    <div className="chart-area" role="img" aria-label={t("Sales and purchases for the last seven days")}>
      {points.map((point) => {
        const saleHeight = Math.max(3, (point.sales / maxValue) * 100);
        const purchaseHeight = Math.max(3, (point.purchases / maxValue) * 100);
        const date = new Date(`${point.date}T12:00:00+06:00`);
        return (
          <div className="chart-column" key={point.date}>
            <div className="chart-bars">
              <div className="chart-bar chart-bar-sales" style={{ height: `${saleHeight}%` }} title={`${t("Sales")}: ${formatMoney(point.sales, locale)}`} />
              <div className="chart-bar chart-bar-purchases" style={{ height: `${purchaseHeight}%` }} title={`${t("Purchases today")}: ${formatMoney(point.purchases, locale)}`} />
            </div>
            <span>{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Asia/Dhaka" }).format(date)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Overview() {
  const { user, hasPermission } = useAuth();
  const { activeBranchId: branchId, activeBranch } = useActiveBranch();
  const { language, t } = useLanguage();
  const locale = language === "bn" ? "bn-BD" : "en-BD";
  const [stats, setStats] = useState<PharmacyDashboardStats | null>(null);
  const [graph, setGraph] = useState<PharmacyGraphPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const canReadReports = hasPermission("report:read");

  const loadDashboard = useCallback(async () => {
    if (!canReadReports) {
      setLoading(false);
      return;
    }
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    try {
      const [todayStats, weeklyGraph] = await Promise.all([
        getTodayPharmacyStats(branchId || undefined),
        getWeeklyPharmacyGraph(branchId || undefined),
      ]);
      setStats(todayStats);
      setGraph(weeklyGraph);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Dashboard data could not be loaded.");
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, [canReadReports, branchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
    return hour < 12 ? t("Good morning") : hour < 17 ? t("Good afternoon") : t("Good evening");
  }, [t]);

  const metrics = [
    { label: t("Sales today"), value: stats ? formatMoney(stats.totalSales, locale) : "—", supporting: stats ? `${formatCount(stats.salesCount, locale)} ${t("completed bills")}` : t("Today’s total"), icon: ShoppingBag, tone: "mint" as const },
    { label: t("Purchases today"), value: stats ? formatMoney(stats.totalPurchases, locale) : "—", supporting: stats ? `${formatCount(stats.purchasesCount, locale)} ${t("completed purchases")}` : t("Today’s total"), icon: ArrowDownLeft, tone: "blue" as const },
    { label: t("Low stock"), value: stats ? formatCount(stats.lowStockCount, locale) : "—", supporting: t("Medicines below threshold"), icon: AlertTriangle, tone: "amber" as const },
    { label: t("Expiry watch"), value: stats ? formatCount(stats.expiringIn30Days, locale) : "—", supporting: t("Batches expiring in 30 days"), icon: Clock3, tone: "rose" as const },
  ];
  const quickActions = [
    { label: t("Start a sale"), detail: t("Open point of sale"), href: "/pos", icon: ShoppingBag, permission: "sale:create" },
    { label: t("Check inventory"), detail: t("Review branch stock"), href: "/inventory", icon: PackageCheck, permission: "stock:read" },
    { label: t("Record a purchase"), detail: t("Receive new stock"), href: "/purchases", icon: Boxes, permission: "purchase:create" },
  ].filter((action) => hasPermission(action.permission));

  return (
    <div className="overview-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">{t("PHARMACY OVERVIEW")}</p>
          <h1>{greeting}, {language === "bn" ? user?.fullNameBangla?.split(" ")[0] || user?.fullName?.split(" ")[0] || t("there") : user?.fullName?.split(" ")[0] || t("there")}</h1>
          <p className="page-subtitle">{t("Here’s what’s happening at your pharmacy today.")}</p>
        </div>
        <div className="overview-context"><span className="date-chip"><MapPin size={16} /><span>{activeBranch?.name ?? t("No branch selected")}</span></span><div className="date-chip"><CalendarDays size={16} /><span>{formatDate(new Date(), locale)}</span></div></div>
      </div>

      {!canReadReports && (
        <div className="notice-card"><CircleHelp size={18} /><p>{t("Your account does not have report access. Ask an administrator to grant ")}<strong>report:read</strong>{t(" to see dashboard figures.")}</p></div>
      )}
      {error && (
        <div className="notice-card notice-error"><CircleHelp size={18} /><p>{t(error)}</p><button className="text-button" onClick={() => void loadDashboard()}><RefreshCw size={14} /> {t("Try again")}</button></div>
      )}

      <section className="metric-grid" aria-label={t("Today’s pharmacy metrics")}>
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} value={loading ? "…" : metric.value} />)}
      </section>

      {quickActions.length > 0 && <section className="overview-quick-actions" aria-label={t("Common pharmacy tasks")}><div className="overview-quick-heading"><div><p className="eyebrow">{t("QUICK ACTIONS")}</p><h2>{t("Get work started")}</h2></div><span>{t("Common tasks for your role")}</span></div><div className="overview-quick-grid">{quickActions.map(({ label, detail, href, icon: Icon }) => <Link href={href} key={href}><span><Icon size={18}/></span><div><strong>{label}</strong><small>{detail}</small></div><ArrowUpRight size={15}/></Link>)}</div></section>}

      <div className="dashboard-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div><h2>{t("Sales & purchases")}</h2><p>{t("Daily totals for the last 7 days")}</p></div>
            <span className="period-pill">{t("Last 7 days")}</span>
          </div>
          {loading ? <div className="chart-empty">{t("Loading activity…")}</div> : graph?.length ? <SalesChart points={graph} locale={locale} t={t} /> : <div className="chart-empty">{canReadReports ? t("No activity to display yet.") : t("Report access is needed to display activity.")}</div>}
          <div className="chart-legend"><span><i className="legend-sales" /> {t("Sales")}</span><span><i className="legend-purchases" /> {t("Purchases today")}</span></div>
        </section>

        <section className="panel inventory-panel">
          <div className="panel-heading"><div><h2>{t("Inventory pulse")}</h2><p>{t("Stock health at a glance")}</p></div><Boxes size={19} className="panel-heading-icon" /></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-good"><PackageCheck size={17} /></span><span>{t("Active medicines")}</span><strong>{loading ? "—" : formatCount(stats?.totalMedicines, locale)}</strong></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-warning"><AlertTriangle size={17} /></span><span>{t("Low stock items")}</span><strong>{loading ? "—" : formatCount(stats?.lowStockCount, locale)}</strong></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-danger"><Pill size={17} /></span><span>{t("Out of stock")}</span><strong>{loading ? "—" : formatCount(stats?.outOfStockCount, locale)}</strong></div>
          <div className="inventory-footnote">{t("Counts are loaded from the pharmacy inventory and expiry summary.")}</div>
        </section>
      </div>

      <section className="panel cash-panel">
        <div className="cash-icon"><Wallet size={20} /></div>
        <div className="cash-copy"><h2>{t("Cash in active registers")}</h2><p>{t("Closing balance recorded for open cash-register sessions")}</p></div>
        <strong>{loading ? "—" : stats ? formatMoney(stats.totalCashInHand, locale) : "—"}</strong>
        <ArrowUpRight className="cash-arrow" size={18} />
      </section>
    </div>
  );
}
