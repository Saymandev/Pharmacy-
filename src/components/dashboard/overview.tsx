"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Wallet,
} from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import { getTodayPharmacyStats, getWeeklyPharmacyGraph } from "@/features/reports/report-service";
import { useAuth } from "@/components/providers/auth-provider";
import type { PharmacyDashboardStats, PharmacyGraphPoint } from "@/types/api";

const taka = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-BD", {
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

function SalesChart({ points }: { points: PharmacyGraphPoint[] }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.sales, point.purchases]));

  return (
    <div className="chart-area" role="img" aria-label="Sales and purchases for the last seven days">
      {points.map((point) => {
        const saleHeight = Math.max(3, (point.sales / maxValue) * 100);
        const purchaseHeight = Math.max(3, (point.purchases / maxValue) * 100);
        const date = new Date(`${point.date}T12:00:00+06:00`);
        return (
          <div className="chart-column" key={point.date}>
            <div className="chart-bars">
              <div className="chart-bar chart-bar-sales" style={{ height: `${saleHeight}%` }} title={`Sales: ${taka.format(point.sales)}`} />
              <div className="chart-bar chart-bar-purchases" style={{ height: `${purchaseHeight}%` }} title={`Purchases: ${taka.format(point.purchases)}`} />
            </div>
            <span>{new Intl.DateTimeFormat("en-BD", { weekday: "short", timeZone: "Asia/Dhaka" }).format(date)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Overview() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<PharmacyDashboardStats | null>(null);
  const [graph, setGraph] = useState<PharmacyGraphPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canReadReports = hasPermission("report:read");

  const loadDashboard = useCallback(async () => {
    if (!canReadReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [todayStats, weeklyGraph] = await Promise.all([
        getTodayPharmacyStats(),
        getWeeklyPharmacyGraph(),
      ]);
      setStats(todayStats);
      setGraph(weeklyGraph);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canReadReports]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const metrics = [
    { label: "Sales today", value: stats ? taka.format(stats.totalSales) : "—", supporting: stats ? `${stats.salesCount} completed bills` : "Today’s total", icon: ShoppingBag, tone: "mint" as const },
    { label: "Purchases today", value: stats ? taka.format(stats.totalPurchases) : "—", supporting: stats ? `${stats.purchasesCount} completed purchases` : "Today’s total", icon: ArrowDownLeft, tone: "blue" as const },
    { label: "Low stock", value: stats ? stats.lowStockCount.toLocaleString("en-BD") : "—", supporting: "Medicines below threshold", icon: AlertTriangle, tone: "amber" as const },
    { label: "Expiry watch", value: stats ? stats.expiringIn30Days.toLocaleString("en-BD") : "—", supporting: "Batches expiring in 30 days", icon: Clock3, tone: "rose" as const },
  ];

  return (
    <div className="overview-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">PHARMACY OVERVIEW</p>
          <h1>{greeting}, {user?.fullName?.split(" ")[0] || "there"}</h1>
          <p className="page-subtitle">Here’s what’s happening at your pharmacy today.</p>
        </div>
        <div className="date-chip"><CalendarDays size={16} /><span>{formatDate(new Date())}</span></div>
      </div>

      {!canReadReports && (
        <div className="notice-card"><CircleHelp size={18} /><p>Your account does not have report access. Ask an administrator to grant <strong>report:read</strong> to see dashboard figures.</p></div>
      )}
      {error && (
        <div className="notice-card notice-error"><CircleHelp size={18} /><p>{error}</p><button className="text-button" onClick={() => void loadDashboard()}><RefreshCw size={14} /> Try again</button></div>
      )}

      <section className="metric-grid" aria-label="Today’s pharmacy metrics">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} value={loading ? "…" : metric.value} />)}
      </section>

      <div className="dashboard-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div><h2>Sales &amp; purchases</h2><p>Daily totals for the last 7 days</p></div>
            <span className="period-pill">Last 7 days</span>
          </div>
          {loading ? <div className="chart-empty">Loading activity…</div> : graph?.length ? <SalesChart points={graph} /> : <div className="chart-empty">{canReadReports ? "No activity to display yet." : "Report access is needed to display activity."}</div>}
          <div className="chart-legend"><span><i className="legend-sales" /> Sales</span><span><i className="legend-purchases" /> Purchases</span></div>
        </section>

        <section className="panel inventory-panel">
          <div className="panel-heading"><div><h2>Inventory pulse</h2><p>Stock health at a glance</p></div><Boxes size={19} className="panel-heading-icon" /></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-good"><PackageCheck size={17} /></span><span>Active medicines</span><strong>{loading ? "—" : stats?.totalMedicines.toLocaleString("en-BD") ?? "—"}</strong></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-warning"><AlertTriangle size={17} /></span><span>Low stock items</span><strong>{loading ? "—" : stats?.lowStockCount.toLocaleString("en-BD") ?? "—"}</strong></div>
          <div className="inventory-stat"><span className="inventory-stat-icon inventory-danger"><Pill size={17} /></span><span>Out of stock</span><strong>{loading ? "—" : stats?.outOfStockCount.toLocaleString("en-BD") ?? "—"}</strong></div>
          <div className="inventory-footnote">Counts are loaded from the pharmacy inventory and expiry summary.</div>
        </section>
      </div>

      <section className="panel cash-panel">
        <div className="cash-icon"><Wallet size={20} /></div>
        <div className="cash-copy"><h2>Cash in active registers</h2><p>Closing balance recorded for open cash-register sessions</p></div>
        <strong>{loading ? "—" : stats ? taka.format(stats.totalCashInHand) : "—"}</strong>
        <ArrowUpRight className="cash-arrow" size={18} />
      </section>
    </div>
  );
}
