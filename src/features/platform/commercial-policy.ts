export const commercialFeatures = [
  "pos",
  "catalog",
  "inventory",
  "purchases",
  "customers",
  "finance",
  "reports",
  "hr",
  "communications",
  "team",
  "customization",
] as const;
export type PlanConfig = {
  name: string;
  currency: "BDT";
  price: string;
  audience: { kind: "PUBLIC" | "DEDICATED"; tenantIds: string[] };
  term: {
    kind: "MONTHLY" | "ANNUAL" | "FIXED_DAYS" | "LIFETIME";
    days: number | null;
  };
  trialDays: number;
  graceDays: number;
  features: Record<(typeof commercialFeatures)[number], boolean>;
  limits: {
    branches: number | null;
    seats: number | null;
    storageBytes: number | null;
  };
};
export type PlanVersion = {
  id: string;
  planKey: string;
  version: number;
  revision: number;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  config: PlanConfig;
};
export type Subscription = {
  id: string;
  targetTenantId: string;
  planVersionId: string;
  snapshot: PlanConfig;
  revision: number;
  state: string;
  periodStart: string;
  periodEnd: string | null;
  trialEnd: string | null;
  graceEnd: string | null;
  cancelAtEnd: boolean;
  canceledAt: string | null;
  scheduledPlanVersionId: string | null;
};
const obj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v),
  integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
export function validPlanConfig(v: unknown): v is PlanConfig {
  if (
    !obj(v) ||
    !obj(v.audience) ||
    !obj(v.term) ||
    !obj(v.features) ||
    !obj(v.limits)
  )
    return false;
  return (
    Object.keys(v).sort().join(",") ===
      "audience,currency,features,graceDays,limits,name,price,term,trialDays" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    v.name.length <= 150 &&
    v.currency === "BDT" &&
    typeof v.price === "string" &&
    /^(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?$/.test(v.price) &&
    ["PUBLIC", "DEDICATED"].includes(String(v.audience.kind)) &&
    Object.keys(v.audience).sort().join(",") === "kind,tenantIds" &&
    Object.keys(v.term).sort().join(",") === "days,kind" &&
    Array.isArray(v.audience.tenantIds) &&
    new Set(v.audience.tenantIds).size === v.audience.tenantIds.length &&
    v.audience.tenantIds.length <= 50 &&
    v.audience.tenantIds.every(
      (id) =>
        typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id),
    ) &&
    (v.audience.kind === "PUBLIC"
      ? v.audience.tenantIds.length === 0
      : v.audience.tenantIds.length > 0) &&
    ["MONTHLY", "ANNUAL", "FIXED_DAYS", "LIFETIME"].includes(
      String(v.term.kind),
    ) &&
    (v.term.kind === "FIXED_DAYS"
      ? integer(v.term.days, 1, 3660)
      : v.term.days === null) &&
    integer(v.trialDays, 0, 365) &&
    integer(v.graceDays, 0, 90) &&
    Object.keys(v.features).sort().join(",") ===
      [...commercialFeatures].sort().join(",") &&
    commercialFeatures.every(
      (k) => typeof (v.features as Record<string, unknown>)[k] === "boolean",
    ) &&
    Object.keys(v.limits).sort().join(",") === "branches,seats,storageBytes" &&
    Object.values(v.limits).every((n) => n === null || integer(n))
  );
}
export function validCommercialBody(path: string[], v: unknown): boolean {
  if (
    !obj(v) ||
    typeof v.reason !== "string" ||
    v.reason.trim().length < 5 ||
    v.reason.trim().length > 1000
  )
    return false;
  const allowed =
    path[0] === "plans"
      ? path.length === 1
        ? ["planKey", "config", "cloneFromId", "reason"]
        : path[2] === "status"
          ? ["revision", "status", "reason"]
          : ["revision", "config", "reason"]
      : path.length === 3
        ? ["planVersionId", "startAt", "useTrial", "reason"]
        : path[3] === "change"
          ? ["revision", "planVersionId", "reason"]
          : path[3] === "cancel"
            ? ["revision", "immediate", "reason"]
            : path[3] === "extend"
              ? ["revision", "kind", "days", "reason"]
              : ["revision", "reason"];
  if (Object.keys(v).some((k) => !allowed.includes(k))) return false;
  if ("config" in v && !validPlanConfig(v.config)) return false;
  if (allowed.includes("config") && !("config" in v)) return false;
  if (allowed.includes("revision") && !integer(v.revision, 1, 2147483646))
    return false;
  if (
    path[0] === "plans" &&
    path.length === 1 &&
    (typeof v.planKey !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.planKey) ||
      v.planKey.length > 80)
  )
    return false;
  if (
    path[2] === "status" &&
    !["PUBLISHED", "RETIRED"].includes(String(v.status))
  )
    return false;
  if (
    allowed.includes("planVersionId") &&
    (typeof v.planVersionId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v.planVersionId))
  )
    return false;
  if (
    allowed.includes("startAt") &&
    (typeof v.startAt !== "string" ||
      !Number.isFinite(Date.parse(v.startAt)) ||
      typeof v.useTrial !== "boolean")
  )
    return false;
  if (allowed.includes("immediate") && typeof v.immediate !== "boolean")
    return false;
  if (
    allowed.includes("days") &&
    (!integer(v.days, 1, 365) || !["trial", "grace"].includes(String(v.kind)))
  )
    return false;
  return true;
}
