import { api } from "@/lib/api/client";
import type { PharmacyDashboardStats, PharmacyGraphPoint } from "@/types/api";

export type ReportParams = { branchId?: string; startDate?: string; endDate?: string; searchTerm?: string; type?: string };
export type ReportKey = "overall" | "pharmacy-summary" | "sales" | "purchases" | "dues" | "income" | "expense" | "pharmacy-collection" | "hospital-collection" | "doctors";

const endpoints: Record<ReportKey, string> = {
  overall: "/reports/overall-summary",
  "pharmacy-summary": "/reports/pharmacy/summary",
  sales: "/reports/pharmacy/sales-report",
  purchases: "/reports/pharmacy/purchase-report",
  dues: "/reports/pharmacy/due-collection",
  income: "/reports/finance/income",
  expense: "/reports/finance/expense",
  "pharmacy-collection": "/reports/finance/pharmacy-collection",
  "hospital-collection": "/reports/finance/hospital-collection",
  doctors: "/reports/doctor-summary",
};

export function getReport(key: ReportKey, params: ReportParams) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) if (value) query.set(name, value);
  return api.get<unknown>(`${endpoints[key]}?${query.toString()}`);
}

function dhakaDate(date: Date): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export function getTodayPharmacyStats() { const today = dhakaDate(new Date()); const query = new URLSearchParams({ startDate: today, endDate: today }); return api.get<PharmacyDashboardStats>(`/reports/pharmacy/stats?${query}`); }
export function getWeeklyPharmacyGraph() { return api.get<PharmacyGraphPoint[]>("/reports/pharmacy/graph?days=7"); }
