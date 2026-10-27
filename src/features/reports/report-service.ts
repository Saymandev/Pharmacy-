import { api } from "@/lib/api/client";
import type { PharmacyDashboardStats, PharmacyGraphPoint } from "@/types/api";

function dhakaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getTodayPharmacyStats() {
  const today = dhakaDate(new Date());
  const query = new URLSearchParams({ startDate: today, endDate: today });
  return api.get<PharmacyDashboardStats>(`/reports/pharmacy/stats?${query}`);
}

export function getWeeklyPharmacyGraph() {
  return api.get<PharmacyGraphPoint[]>("/reports/pharmacy/graph?days=7");
}
