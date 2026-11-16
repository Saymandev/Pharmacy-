import { validPlanConfig } from "./commercial-policy.ts";
export function validEntitlementBody(path: string[], value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>,
    keys = Object.keys(v).sort().join(","),
    why =
      typeof v.reason === "string" &&
      v.reason.trim().length >= 5 &&
      v.reason.length <= 1000,
    rev = Number.isInteger(v.revision) && Number(v.revision) > 0;
  if (!why) return false;
  if (path[0] === "addons" && path.length === 1)
    return (
      keys === "addonKey,config,reason" &&
      typeof v.addonKey === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.addonKey) &&
      v.addonKey.length <= 80 &&
      validPlanConfig(v.config) &&
      v.config.trialDays === 0 &&
      v.config.graceDays === 0
    );
  if (path[0] === "addons" && path.length === 2)
    return (
      keys === "config,reason,revision" &&
      rev &&
      validPlanConfig(v.config) &&
      v.config.trialDays === 0 &&
      v.config.graceDays === 0
    );
  if (path[0] === "addons" && path[2] === "status")
    return (
      keys === "reason,revision,status" &&
      rev &&
      ["PUBLISHED", "RETIRED"].includes(String(v.status))
    );
  if (path[2] === "addons" && path.length === 3)
    return (
      keys === "addonVersionId,reason,startsAt" &&
      typeof v.addonVersionId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(v.addonVersionId) &&
      typeof v.startsAt === "string" &&
      Number.isFinite(Date.parse(v.startsAt))
    );
  return (
    path[2] === "addons" &&
    path[4] === "cancel" &&
    keys === "reason,revision" &&
    rev
  );
}
