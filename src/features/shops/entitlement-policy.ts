export const entitlementFeatures = [
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
export type ShopEntitlements = {
  targetTenantId: string;
  state: string;
  operable: boolean;
  revision: string;
  features: Record<(typeof entitlementFeatures)[number], boolean>;
  limits: {
    branches: number | null;
    seats: number | null;
    storageBytes: number | null;
  };
  usage: {
    branches: number;
    seats: number;
    storageBytes: number;
    reservedStorageBytes: number;
  };
};
export function validShopEntitlements(
  value: unknown,
  target: string,
): value is ShopEntitlements {
  if (!value || typeof value !== "object") return false;
  const e = value as ShopEntitlements;
  return (
    e.targetTenantId === target &&
    [
      "ACTIVE",
      "TRIALING",
      "GRACE",
      "EXPIRED",
      "CANCELED",
      "SCHEDULED",
      "PENDING_PAYMENT",
      "MISSING",
      "REVIEW",
      "SECURITY_BLOCKED",
    ].includes(e.state) &&
    typeof e.operable === "boolean" && e.operable===["ACTIVE","TRIALING","GRACE"].includes(e.state)&&
    typeof e.revision === "string" &&
    !!e.features &&
    entitlementFeatures.every((k) => typeof e.features[k] === "boolean") &&
    !!e.limits &&
    !!e.usage &&
    (["branches", "seats", "storageBytes"] as const).every(
      (k) =>
        (e.limits[k] === null ||
          (Number.isSafeInteger(e.limits[k]) && Number(e.limits[k]) >= 0)) &&
        Number.isSafeInteger(e.usage[k]) &&
        e.usage[k] >= 0,
    ) &&
    Number.isSafeInteger(e.usage.reservedStorageBytes) &&
    e.usage.reservedStorageBytes >= 0
  );
}
export function canWriteFeature(
  e: ShopEntitlements | undefined,
  feature: (typeof entitlementFeatures)[number],
) {
  return !!e?.operable && ["ACTIVE","TRIALING","GRACE"].includes(e.state)&& e.features[feature] === true;
}
