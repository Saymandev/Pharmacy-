export type BillingInvoice = {
  id: string;
  targetTenantId: string;
  currency: string;
  number: string | null;
  revision: number;
  subscriptionRevision: number;
  purpose: "CURRENT" | "RENEWAL" | "CHANGE";
  state: string;
  totalMinor: number;
  dueMinor: number;
  allocatedMinor: number;
  creditedMinor: number;
  settled: boolean;
  dueAt: string;
  snapshot: {
    seller: { name: string; address: string };
    buyer: { name: string; address: string };
    description: string;
    periodStart: string;
    periodEnd: string | null;
    grossMinor: number;
    discountMinor: number;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
};
export type BillingPayment = {
  id: string;
  targetTenantId: string;
  currency: string;
  amountMinor: number;
  availableMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  reservedMinor: number;
  method: string;
  reference: string;
  state: string;
  receivedAt: string;
};
export type BillingEntry = {
  id: string;
  targetTenantId: string;
  kind: string;
  currency: string;
  invoiceId: string | null;
  paymentId: string | null;
  parentId: string | null;
  amountMinor: number;
  reason: string;
  createdAt: string;
};
export type BillingView = {
  targetTenantId: string;
  currency: string;
  merchantConfigured: boolean;
  subscriptionRevision: number | null;
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  entries: BillingEntry[];
  proofEnabled?: boolean;
  proofs?: {
    id: string;
    targetTenantId: string;
    paymentId: string;
    name: string;
    mime: string;
    size: number;
  }[];
  pagination?: Record<string, { page: number; hasNextPage: boolean }>;
  historyWindow: number;
  credits: (BillingEntry & { availableMinor: number })[];
  eligiblePlans: { id: string; name: string; price: string }[];
};
export type ChangePreview = {
  id: string;
  kind: "billing.change.preview";
  targetTenantId: string;
  subscriptionRevision: number;
  expiresAt: string;
  config: {
    name: string;
    features: Record<string, boolean>;
    limits: Record<string, number | null>;
  };
  usage: Record<string, number>;
  creditMinor: number;
  debitMinor: number;
  chargeMinor: number;
  shopCreditMinor: number;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const cash = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
export function validChangePreview(
  v: unknown,
  target: string,
): v is ChangePreview {
  return (
    object(v) &&
    v.kind === "billing.change.preview" &&
    v.targetTenantId === target &&
    typeof v.id === "string" &&
    Number.isInteger(v.subscriptionRevision) &&
    typeof v.expiresAt === "string" &&
    Number.isFinite(Date.parse(v.expiresAt)) &&
    object(v.config) &&
    typeof v.config.name === "string" &&
    object(v.config.features) &&
    Object.keys(v.config.features).length <= 11 &&
    Object.values(v.config.features).every((n) => typeof n === "boolean") &&
    object(v.config.limits) &&
    ["branches", "seats", "storageBytes"].every(
      (k) =>
        v.config &&
        object(v.config) &&
        object(v.config.limits) &&
        (v.config.limits[k] === null || cash(v.config.limits[k])),
    ) &&
    object(v.usage) &&
    ["branches", "seats", "storageBytes"].every(
      (k) => object(v.usage) && cash(v.usage[k]),
    ) &&
    ["creditMinor", "debitMinor", "chargeMinor", "shopCreditMinor"].every((k) =>
      cash(v[k]),
    ) &&
    Number(v.debitMinor) - Number(v.creditMinor) ===
      Number(v.chargeMinor) - Number(v.shopCreditMinor)
  );
}
export function validBillingView(v: unknown, target: string): v is BillingView {
  if (
    !object(v) ||
    v.targetTenantId !== target ||
    v.currency !== "BDT" ||
    typeof v.merchantConfigured !== "boolean" ||
    !Array.isArray(v.invoices) ||
    !Array.isArray(v.payments) ||
    !Array.isArray(v.entries) ||
    v.invoices.length > 50 ||
    v.payments.length > 50 ||
    v.entries.length > 100
  )
    return false;
  const bound = (r: unknown) =>
    object(r) &&
    r.targetTenantId === target &&
    r.currency === "BDT" &&
    typeof r.id === "string";
  if (
    v.proofs !== undefined &&
    (!Array.isArray(v.proofs) ||
      v.proofs.length > 250 ||
      !v.proofs.every(
        (p) =>
          object(p) &&
          p.targetTenantId === target &&
          typeof p.id === "string" &&
          typeof p.paymentId === "string" &&
          typeof p.name === "string" &&
          ["application/pdf", "image/png", "image/jpeg"].includes(
            String(p.mime),
          ) &&
          cash(p.size),
      ))
  )
    return false;
  if (
    !Array.isArray(v.credits) ||
    !v.credits.every(
      (r) =>
        bound(r) &&
        cash(r.amountMinor) &&
        cash(r.availableMinor) &&
        r.availableMinor <= r.amountMinor,
    ) ||
    !Array.isArray(v.eligiblePlans) ||
    v.eligiblePlans.length > 100 ||
    !v.eligiblePlans.every(
      (p) =>
        object(p) &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.price === "string",
    )
  )
    return false;
  return (
    v.invoices.every(
      (r) =>
        bound(r) &&
        cash(r.totalMinor) &&
        cash(r.dueMinor) &&
        cash(r.allocatedMinor) &&
        cash(r.creditedMinor) &&
        r.dueMinor + r.allocatedMinor + r.creditedMinor === r.totalMinor &&
        [
          "DRAFT",
          "ISSUED",
          "PARTIALLY_PAID",
          "PAID",
          "OVERDUE",
          "VOID",
        ].includes(r.state) &&
        typeof r.settled === "boolean" &&
        Number.isInteger(r.revision) &&
        object(r.snapshot) &&
        object(r.snapshot.seller) &&
        typeof r.snapshot.seller.name === "string" &&
        typeof r.snapshot.seller.address === "string" &&
        object(r.snapshot.buyer) &&
        typeof r.snapshot.buyer.name === "string" &&
        typeof r.snapshot.buyer.address === "string" &&
        typeof r.snapshot.description === "string",
    ) &&
    v.payments.every(
      (r) =>
        bound(r) &&
        cash(r.amountMinor) &&
        cash(r.availableMinor) &&
        cash(r.allocatedMinor) &&
        cash(r.refundedMinor) &&
        cash(r.reservedMinor) &&
        ["PENDING", "VERIFIED", "REJECTED", "REVERSED"].includes(r.state) &&
        typeof r.reference === "string" &&
        typeof r.method === "string",
    ) &&
    v.entries.every(
      (r) =>
        bound(r) &&
        cash(r.amountMinor) &&
        typeof r.kind === "string" &&
        typeof r.reason === "string",
    )
  );
}
const money = (v: unknown) =>
  typeof v === "string" && /^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/.test(v);
const id = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
export function validBillingBody(path: string[], v: unknown) {
  if (
    !object(v) ||
    typeof v.reason !== "string" ||
    v.reason.trim().length < 5 ||
    v.reason.length > 1000
  )
    return false;
  const tail = path.slice(3),
    keys = Object.keys(v).sort().join(","),
    exact = (names: string) => keys === names.split(",").sort().join(",");
  if (tail[0] === "change-preview")
    return exact("planVersionId,reason") && id(v.planVersionId);
  if (tail[0] === "credits" && tail[2] === "apply")
    return (
      exact("invoiceId,amount,reason") &&
      id(v.invoiceId) &&
      money(v.amount) &&
      Number(v.amount) > 0
    );
  if (tail[0] === "credits" && tail[2] === "return")
    return exact("amount,reason") && money(v.amount) && Number(v.amount) > 0;
  if (
    tail[0] === "invoices" &&
    (tail.length === 1 || (tail.length === 3 && tail[2] === "edit"))
  )
    return (
      exact(
        "purpose,subscriptionRevision,discount,dueAt,billingName,billingAddress,reason" +
          (v.purpose === "CHANGE" ? ",previewKey" : "") +
          (tail.length === 3 ? ",revision" : ""),
      ) &&
      (v.purpose !== "CHANGE" || id(v.previewKey)) &&
      ["CURRENT", "RENEWAL", "CHANGE"].includes(String(v.purpose)) &&
      Number.isInteger(v.subscriptionRevision) &&
      Number(v.subscriptionRevision) > 0 &&
      money(v.discount) &&
      typeof v.dueAt === "string" &&
      Number.isFinite(Date.parse(v.dueAt)) &&
      typeof v.billingName === "string" &&
      v.billingName.trim().length > 0 &&
      v.billingName.length <= 150 &&
      typeof v.billingAddress === "string" &&
      v.billingAddress.trim().length > 0 &&
      v.billingAddress.length <= 500 &&
      (tail.length === 1 ||
        (Number.isInteger(v.revision) && Number(v.revision) > 0))
    );
  if (tail[0] === "invoices" && tail[2] === "issue")
    return (
      exact("revision,reason") &&
      Number.isInteger(v.revision) &&
      Number(v.revision) > 0
    );
  if (tail[0] === "payments" && tail.length === 1)
    return (
      exact("amount,currency,method,reference,receivedAt,reason") &&
      money(v.amount) &&
      Number(v.amount) > 0 &&
      v.currency === "BDT" &&
      ["BANK", "CASH", "MOBILE"].includes(String(v.method)) &&
      typeof v.reference === "string" &&
      /^[A-Za-z0-9._/-]{3,150}$/.test(v.reference) &&
      typeof v.receivedAt === "string" &&
      Number.isFinite(Date.parse(v.receivedAt))
    );
  if (tail[0] === "payments" && tail[2] === "decision")
    return (
      exact("decision,reason") &&
      ["VERIFY", "REJECT"].includes(String(v.decision))
    );
  if (tail[0] === "allocations" && tail.length === 1)
    return (
      exact("invoiceId,paymentId,amount,reason") &&
      id(v.invoiceId) &&
      id(v.paymentId) &&
      money(v.amount) &&
      Number(v.amount) > 0
    );
  if (tail[0] === "refunds" && tail.length === 1)
    return (
      exact("paymentId,amount,reason") &&
      id(v.paymentId) &&
      money(v.amount) &&
      Number(v.amount) > 0
    );
  if (tail[0] === "refunds" && tail[2] === "decision")
    return (
      exact("decision,reference,reason") &&
      ["APPROVE", "REJECT"].includes(String(v.decision)) &&
      typeof v.reference === "string" &&
      v.reference.trim().length >= 3 &&
      v.reference.length <= 150
    );
  if (
    (tail[0] === "invoices" && tail[2] === "credit") ||
    (tail[0] === "allocations" && tail[2] === "release")
  )
    return exact("amount,reason") && money(v.amount) && Number(v.amount) > 0;
  return (
    exact("reason") &&
    ((tail[0] === "invoices" &&
      ["void", "settle", "unsettle"].includes(String(tail[2]))) ||
      (tail[0] === "payments" && tail[2] === "reverse"))
  );
}
