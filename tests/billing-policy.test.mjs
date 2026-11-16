import test from "node:test";
import assert from "node:assert/strict";
import {
  validBillingBody,
  validBillingView,
} from "../src/features/platform/billing-policy.ts";
import { platformTarget } from "../src/lib/server/platform-policy.ts";
test("billing BFF has explicit write gates and rejects amount/state/tenant forgery", () => {
  const path = ["shops", "a", "billing", "payments"],
    body = {
      amount: "100.00",
      currency: "BDT",
      method: "BANK",
      reference: "TRANSFER-123",
      receivedAt: "2026-11-16T00:00:00Z",
      reason: "Verified bank deposit",
    };
  assert.ok(validBillingBody(path, body));
  for (const v of [
    { ...body, state: "VERIFIED" },
    { ...body, targetTenantId: "b" },
    { ...body, amount: "1e3" },
    { ...body, amount: "-1" },
    { ...body, currency: "USD" },
  ])
    assert.equal(validBillingBody(path, v), false);
  const env = {
    enabled: "true",
    writes: "true",
    base: "http://127.0.0.1:5000/api/v1/platform",
  };
  assert.ok(platformTarget(path, "POST", env));
  assert.ok(platformTarget(["shops", "a", "billing"], "GET", env));
  assert.equal(platformTarget(path, "POST", { ...env, writes: "false" }), null);
  assert.equal(
    platformTarget(["shops", "a", "billing", "webhook"], "POST", env),
    null,
  );
});
test("billing view rejects foreign records and impossible balances", () => {
  const v = {
    targetTenantId: "a",
    currency: "BDT",
    merchantConfigured: true,
    subscriptionRevision: 1,
    historyWindow: 50,
    invoices: [],
    payments: [],
    entries: [],
    credits: [],
    eligiblePlans: [],
  };
  assert.ok(validBillingView(v, "a"));
  assert.equal(validBillingView(v, "b"), false);
  assert.equal(
    validBillingView(
      {
        ...v,
        entries: [
          {
            id: "entry",
            targetTenantId: "b",
            currency: "BDT",
            amountMinor: 100,
            kind: "VERIFY",
            reason: "Reviewed",
          },
        ],
      },
      "a",
    ),
    false,
  );
});
