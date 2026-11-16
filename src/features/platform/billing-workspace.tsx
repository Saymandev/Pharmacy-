"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Select } from "@/components/ui/select";
import { DataSkeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { createCommercialClient } from "./commercial-client";
import { PlatformError } from "./platform-client";
import {
  validBillingBody,
  validBillingView,
  validChangePreview,
  type BillingView,
  type BillingInvoice,
  type ChangePreview,
} from "./billing-policy";
import { BillingProofForm } from "./billing-proof";
import "./billing.css";
type Action = {
  title: string;
  path: string;
  fields: Record<string, string>;
  fixed?: Record<string, unknown>;
};
const money = (n: number) => "BDT " + (n / 100).toFixed(2);
export function BillingWorkspace({
  target,
  capabilities,
  writesEnabled,
  blocked,
  onLock,
  onSaved,
}: {
  target: string;
  capabilities: string[];
  writesEnabled: boolean;
  blocked: boolean;
  onLock: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage(),
    [data, setData] = useState<BillingView | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<Action | null>(null),
    [preview, setPreview] = useState<BillingInvoice | null>(null),
    [quote, setQuote] = useState<ChangePreview | null>(null),
    [proofPayment, setProofPayment] = useState<string | null>(null),
    [pages, setPages] = useState({
      invoicePage: 1,
      paymentPage: 1,
      activityPage: 1,
      creditPage: 1,
    });
  const can = (cap: string) => writesEnabled && capabilities.includes(cap),
    manage = can("platform:billing:manage"),
    verify = can("platform:payments:verify"),
    approve = can("platform:refunds:approve");
  useEffect(() => {
    const c = createCommercialClient(sessionBoundary.capture().signal);
    let live = true;
    c.request(
      "shops/" +
        target +
        "/billing?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(pages).map(([key, value]) => [key, String(value)]),
          ),
        ),
    )
      .then((v) => {
        if (!live) return;
        if (!validBillingView(v, target))
          throw Error("Billing data could not be verified.");
        setData(v);
        setError("");
      })
      .catch((e) => {
        if (live) {
          setData(null);
          setError(e.message);
        }
      });
    return () => {
      live = false;
      c.dispose();
    };
  }, [target, revision, pages]);
  const pager = (key: keyof typeof pages) =>
    data?.pagination?.[key] && (
      <nav
        aria-label={t(
          {
            invoicePage: "Invoice pages",
            paymentPage: "Payment pages",
            creditPage: "Credit pages",
            activityPage: "Activity pages",
          }[key],
        )}
      >
        <button
          disabled={blocked || pages[key] === 1}
          onClick={() => setPages((v) => ({ ...v, [key]: v[key] - 1 }))}
        >
          {t("Previous")}
        </button>
        <span>{pages[key]}</span>
        <button
          disabled={blocked || !data.pagination[key].hasNextPage}
          onClick={() => setPages((v) => ({ ...v, [key]: v[key] + 1 }))}
        >
          {t("Next")}
        </button>
      </nav>
    );
  const begin = (
    title: string,
    path: string,
    fields: Record<string, string> = {},
    fixed: Record<string, unknown> = {},
  ) => {
    if (blocked) return;
    setAction({ title, path, fields, fixed });
  };
  return (
    <section className="platform-billing" aria-label={t("Shop billing")}>
      <header>
        <div>
          <h3>{t("Shop billing")}</h3>
          <p>
            {t(
              "Subscription invoices and shop credit are separate from pharmacy sales.",
            )}
          </p>
        </div>
        <button disabled={blocked} onClick={() => setRevision((v) => v + 1)}>
          {t("Reload billing")}
        </button>
      </header>
      {error ? (
        <p role="alert">{t(error)}</p>
      ) : !data ? (
        <DataSkeleton rows={3} />
      ) : (
        <>
          {!data.merchantConfigured && (
            <p role="status">
              {t(
                "Configure the billing seller and tax rules before creating invoices.",
              )}
            </p>
          )}
          <div className="billing-toolbar">
            {manage && (
              <>
                <button
                  disabled={
                    blocked ||
                    !data.merchantConfigured ||
                    !data.subscriptionRevision
                  }
                  onClick={() =>
                    begin(
                      "Create invoice draft",
                      "invoices",
                      {
                        discount: "0.00",
                        dueAt: new Date(
                          Date.now() + 7 * 86400000,
                        ).toISOString(),
                        billingName: "",
                        billingAddress: "",
                      },
                      {
                        purpose: "CURRENT",
                        subscriptionRevision: data.subscriptionRevision,
                      },
                    )
                  }
                >
                  {t("Create invoice draft")}
                </button>
                <button
                  disabled={blocked}
                  onClick={() =>
                    begin(
                      "Record manual payment",
                      "payments",
                      {
                        amount: "",
                        reference: "",
                        receivedAt: new Date().toISOString(),
                      },
                      { currency: "BDT", method: "BANK" },
                    )
                  }
                >
                  {t("Record manual payment")}
                </button>
              </>
            )}
          </div>
          {manage && capabilities.includes("platform:subscriptions:manage") && (
            <button
              disabled={blocked}
              onClick={() =>
                begin("Preview immediate plan change", "change-preview", {
                  planVersionId: "",
                })
              }
            >
              {t("Preview immediate plan change")}
            </button>
          )}
          {quote && (
            <aside
              className="billing-quote"
              aria-label={t("Plan change preview")}
            >
              <h4>{quote.config.name}</h4>
              <dl>
                {(["branches", "seats", "storageBytes"] as const).map((k) => (
                  <div key={k}>
                    <dt>
                      {t(
                        {
                          branches: "Branches",
                          seats: "Team seats",
                          storageBytes: "Storage bytes",
                        }[k],
                      )}
                    </dt>
                    <dd>
                      {quote.usage[k]} /{" "}
                      {quote.config.limits[k] === null
                        ? t("Unlimited")
                        : quote.config.limits[k]}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>
                {t("Enabled modules")}:{" "}
                {Object.entries(quote.config.features)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) =>
                    t(
                      (
                        {
                          pos: "Point of sale",
                          catalog: "Medicine catalog",
                          inventory: "Inventory",
                          purchases: "Purchases",
                          customers: "Customers",
                          finance: "Finance",
                          reports: "Reports",
                          hr: "HR",
                          communications: "Communication",
                          team: "Team access",
                          customization: "Customization",
                        } as Record<string, string>
                      )[key] ?? key,
                    ),
                  )
                  .join(", ") || t("None")}
              </p>
              <p>
                {t("Unused service credit")}: {money(quote.creditMinor)} ·{" "}
                {t("New service charge")}: {money(quote.debitMinor)}
              </p>
              <p>
                {t("Pay now")}: <strong>{money(quote.chargeMinor)}</strong> ·{" "}
                {t("Shop credit after change")}: {money(quote.shopCreditMinor)}
              </p>
              <p>
                {t("Preview expires")}:{" "}
                {new Date(quote.expiresAt).toLocaleTimeString()}
              </p>
              <button
                disabled={blocked}
                onClick={() =>
                  begin(
                    "Create change invoice",
                    "invoices",
                    {
                      dueAt: new Date().toISOString(),
                      billingName: "",
                      billingAddress: "",
                    },
                    {
                      purpose: "CHANGE",
                      previewKey: quote.id,
                      subscriptionRevision: quote.subscriptionRevision,
                      discount: "0",
                    },
                  )
                }
              >
                {t("Create change invoice")}
              </button>
            </aside>
          )}
          <h4>{t("Invoices")}</h4>
          {!data.invoices.length ? (
            <p>{t("No invoices yet.")}</p>
          ) : (
            <ul className="billing-records">
              {data.invoices.map((i) => (
                <li key={i.id}>
                  <header>
                    <button onClick={() => setPreview(i)}>
                      {i.number ?? t("Draft invoice")}
                    </button>
                    <span className="platform-state">{t(i.state)}</span>
                  </header>
                  <p>
                    <strong>{money(i.totalMinor)}</strong> · {t("Outstanding")}:{" "}
                    {money(i.dueMinor)}
                  </p>
                  <small>
                    {t(i.purpose)} · {new Date(i.dueAt).toLocaleDateString()}
                  </small>
                  <div className="billing-toolbar">
                    {manage && i.state === "DRAFT" && (
                      <>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Edit invoice draft",
                              "invoices/" + i.id + "/edit",
                              {
                                discount: (
                                  i.snapshot.discountMinor / 100
                                ).toFixed(2),
                                dueAt: i.dueAt,
                                billingName: i.snapshot.buyer.name,
                                billingAddress: i.snapshot.buyer.address,
                              },
                              {
                                purpose: i.purpose,
                                subscriptionRevision: i.subscriptionRevision,
                                revision: i.revision,
                              },
                            )
                          }
                        >
                          {t("Edit draft")}
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Issue invoice",
                              "invoices/" + i.id + "/issue",
                              {},
                              { revision: i.revision },
                            )
                          }
                        >
                          {t("Issue invoice")}
                        </button>
                      </>
                    )}
                    {manage &&
                      !["VOID", "DRAFT"].includes(i.state) &&
                      i.dueMinor > 0 && (
                        <>
                          <button
                            disabled={blocked}
                            onClick={() =>
                              begin(
                                "Apply verified payment",
                                "allocations",
                                {
                                  paymentId: "",
                                  amount: (i.dueMinor / 100).toFixed(2),
                                },
                                { invoiceId: i.id },
                              )
                            }
                          >
                            {t("Apply payment")}
                          </button>
                          <button
                            disabled={blocked}
                            onClick={() =>
                              begin(
                                "Issue credit note",
                                "invoices/" + i.id + "/credit",
                                { amount: "" },
                              )
                            }
                          >
                            {t("Credit note")}
                          </button>
                        </>
                      )}
                    {manage &&
                      i.state === "PAID" &&
                      !i.settled &&
                      capabilities.includes(
                        "platform:subscriptions:manage",
                      ) && (
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Settle subscription",
                              "invoices/" + i.id + "/settle",
                            )
                          }
                        >
                          {t("Settle subscription")}
                        </button>
                      )}
                    {manage &&
                      i.settled &&
                      capabilities.includes(
                        "platform:subscriptions:manage",
                      ) && (
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Reverse subscription settlement",
                              "invoices/" + i.id + "/unsettle",
                            )
                          }
                        >
                          {t("Reverse subscription settlement")}
                        </button>
                      )}
                    {manage &&
                      i.state !== "VOID" &&
                      !i.allocatedMinor &&
                      !i.settled && (
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin("Void invoice", "invoices/" + i.id + "/void")
                          }
                        >
                          {t("Void invoice")}
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pager("invoicePage")}
          <h4>{t("Payments and shop credit")}</h4>
          {!data.payments.length ? (
            <p>{t("No payments yet.")}</p>
          ) : (
            <ul className="billing-records">
              {data.payments.map((p) => (
                <li key={p.id}>
                  <header>
                    <strong>{p.reference}</strong>
                    <span className="platform-state">{t(p.state)}</span>
                  </header>
                  <p>
                    {money(p.amountMinor)} · {p.method}
                  </p>
                  <p>
                    {t("Available credit")}:{" "}
                    <strong>{money(p.availableMinor)}</strong> · {t("Refunded")}
                    : {money(p.refundedMinor)}
                  </p>
                  {capabilities.includes("platform:payments:verify") &&
                    (data.proofs ?? [])
                      .filter((v) => v.paymentId === p.id)
                      .map((v) => (
                        <a
                          className="billing-proof-link"
                          key={v.id}
                          href={
                            "/api/backend/platform/shops/" +
                            encodeURIComponent(target) +
                            "/billing/proofs/" +
                            encodeURIComponent(v.id)
                          }
                          download
                        >
                          {t("Download private proof")} · {v.name}
                        </a>
                      ))}
                  <div className="billing-toolbar">
                    {manage && data.proofEnabled && (
                      <button
                        disabled={blocked}
                        onClick={() => setProofPayment(p.id)}
                      >
                        {t("Attach payment proof")}
                      </button>
                    )}
                    {verify && p.state === "PENDING" && (
                      <>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Verify payment",
                              "payments/" + p.id + "/decision",
                              {},
                              { decision: "VERIFY" },
                            )
                          }
                        >
                          {t("Verify payment")}
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Reject payment",
                              "payments/" + p.id + "/decision",
                              {},
                              { decision: "REJECT" },
                            )
                          }
                        >
                          {t("Reject payment")}
                        </button>
                      </>
                    )}
                    {manage && p.availableMinor > 0 && (
                      <button
                        disabled={blocked}
                        onClick={() =>
                          begin(
                            "Request refund",
                            "refunds",
                            { amount: (p.availableMinor / 100).toFixed(2) },
                            { paymentId: p.id },
                          )
                        }
                      >
                        {t("Request refund")}
                      </button>
                    )}
                    {verify &&
                      p.state === "VERIFIED" &&
                      !p.allocatedMinor &&
                      !p.refundedMinor &&
                      !p.reservedMinor && (
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Reverse payment",
                              "payments/" + p.id + "/reverse",
                            )
                          }
                        >
                          {t("Reverse payment")}
                        </button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pager("paymentPage")}
          <h4>{t("Credit notes")}</h4>
          <ul className="billing-records">
            {(data.credits ?? []).map((c) => (
              <li key={c.id}>
                <strong>
                  {t("Available credit")}: {money(c.availableMinor)}
                </strong>
                <p>{c.reason}</p>
                {manage && c.availableMinor > 0 && (
                  <button
                    disabled={blocked}
                    onClick={() =>
                      begin("Apply shop credit", "credits/" + c.id + "/apply", {
                        invoiceId: "",
                        amount: (c.availableMinor / 100).toFixed(2),
                      })
                    }
                  >
                    {t("Apply shop credit")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {pager("creditPage")}
          <h4>{t("Billing activity")}</h4>
          <ul className="billing-records">
            {data.entries.map((e) => (
              <li key={e.id}>
                <header>
                  <strong>{t(e.kind)}</strong>
                  <span>{money(e.amountMinor)}</span>
                </header>
                <p>{e.reason}</p>
                <small>{new Date(e.createdAt).toLocaleString()}</small>
                <div className="billing-toolbar">
                  {manage && e.kind === "CREDIT_USE" && (
                    <button
                      disabled={blocked}
                      onClick={() =>
                        begin(
                          "Return applied credit",
                          "credits/" + e.id + "/return",
                          { amount: (e.amountMinor / 100).toFixed(2) },
                        )
                      }
                    >
                      {t("Return applied credit")}
                    </button>
                  )}
                  {manage && e.kind === "ALLOCATE" && (
                    <button
                      disabled={blocked}
                      onClick={() =>
                        begin(
                          "Release allocation",
                          "allocations/" + e.id + "/release",
                          { amount: (e.amountMinor / 100).toFixed(2) },
                        )
                      }
                    >
                      {t("Release allocation")}
                    </button>
                  )}
                  {approve &&
                    e.kind === "REFUND_REQUEST" &&
                    !data.entries.some(
                      (v) =>
                        v.parentId === e.id &&
                        ["REFUND_APPROVE", "REFUND_REJECT"].includes(v.kind),
                    ) && (
                      <>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Confirm refund paid",
                              "refunds/" + e.id + "/decision",
                              { reference: "" },
                              { decision: "APPROVE" },
                            )
                          }
                        >
                          {t("Confirm refund paid")}
                        </button>
                        <button
                          disabled={blocked}
                          onClick={() =>
                            begin(
                              "Reject refund",
                              "refunds/" + e.id + "/decision",
                              { reference: "" },
                              { decision: "REJECT" },
                            )
                          }
                        >
                          {t("Reject refund")}
                        </button>
                      </>
                    )}
                </div>
              </li>
            ))}
          </ul>
          {pager("activityPage")}
        </>
      )}
      {action && data && (
        <BillingCommand
          action={action}
          data={data}
          target={target}
          onLock={onLock}
          onClose={() => setAction(null)}
          onSaved={(value) => {
            if ((value as ChangePreview)?.kind === "billing.change.preview")
              setQuote(value as ChangePreview);
            else setQuote(null);
            setAction(null);
            setRevision((v) => v + 1);
            onSaved();
          }}
        />
      )}
      {proofPayment && (
        <BillingProofForm
          target={target}
          paymentId={proofPayment}
          onLock={onLock}
          onClose={() => setProofPayment(null)}
          onSaved={() => {
            setProofPayment(null);
            setRevision((v) => v + 1);
            onSaved();
          }}
        />
      )}
      {preview && (
        <BillingDocument invoice={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
function BillingCommand({
  action,
  data,
  target,
  onLock,
  onClose,
  onSaved,
}: {
  action: Action;
  data: BillingView;
  target: string;
  onLock: (v: boolean) => void;
  onClose: () => void;
  onSaved: (value: unknown) => void;
}) {
  const { t } = useLanguage(),
    dialog = useRef<HTMLDialogElement>(null),
    client = useRef<ReturnType<typeof createCommercialClient> | null>(null),
    guard = useRef(false),
    attempt = useRef<{ body: Record<string, unknown>; key: string } | null>(
      null,
    ),
    live = useRef(false),
    [values, setValues] = useState(action.fields),
    [fixed, setFixed] = useState(action.fixed ?? {}),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [saving, setSaving] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState("");
  const locked = saving || uncertain;
  useEffect(() => {
    live.current = true;
    dialog.current?.showModal();
    client.current = createCommercialClient(sessionBoundary.capture().signal);
    return () => {
      live.current = false;
      client.current?.dispose();
    };
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (guard.current || !confirm || !client.current) return;
    guard.current = true;
    setSaving(true);
    setError("");
    onLock(true);
    try {
      if (!attempt.current) {
        const body: Record<string, unknown> = {
          ...values,
          ...fixed,
          reason: reason.trim(),
        };
        if ("subscriptionRevision" in body)
          body.subscriptionRevision = Number(body.subscriptionRevision);
        if (
          !validBillingBody(
            ["shops", target, "billing", ...action.path.split("/")],
            body,
          )
        )
          throw new PlatformError("Check the billing fields and reason.", 422);
        attempt.current = { body, key: crypto.randomUUID() };
      }
      const receipt = await client.current.request<{
        id: string;
        targetTenantId: string;
      }>(
        "shops/" + target + "/billing/" + action.path,
        "POST",
        attempt.current.body,
        attempt.current.key,
      );
      if (!live.current) return;
      if (
        !receipt ||
        receipt.targetTenantId !== target ||
        typeof receipt.id !== "string" ||
        (action.path === "change-preview" &&
          !validChangePreview(receipt, target))
      )
        throw new PlatformError(
          "Billing result could not be verified. Retry the same request.",
          502,
        );
      onLock(false);
      onSaved(receipt);
    } catch (e) {
      if (!live.current) return;
      const unknown = !(e instanceof PlatformError) || e.status >= 500;
      setUncertain(unknown);
      onLock(unknown);
      if (!unknown) attempt.current = null;
      setError(e instanceof Error ? e.message : "Billing save failed.");
    } finally {
      guard.current = false;
      if (live.current) setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="platform-confirm billing-command"
      aria-label={t(action.title)}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
    >
      <form onSubmit={save}>
        <header>
          <h2>{t(action.title)}</h2>
          <p>{t("Check the shop, amount and reference before confirming.")}</p>
        </header>
        {error && <p role="alert">{t(error)}</p>}
        {uncertain && (
          <p role="status">
            {t(
              "Save result is unknown. Retry the same request before continuing.",
            )}
          </p>
        )}
        <fieldset disabled={locked}>
          {action.path === "invoices" && fixed.purpose !== "CHANGE" && (
            <label>
              {t("Invoice period")}
              <Select
                value={String(fixed.purpose)}
                onChange={(e) =>
                  setFixed((v) => ({ ...v, purpose: e.target.value }))
                }
              >
                <option value="CURRENT">{t("Current unpaid term")}</option>
                <option value="RENEWAL">{t("Next renewal term")}</option>
              </Select>
            </label>
          )}
          {action.path === "payments" && (
            <label>
              {t("Payment method")}
              <Select
                value={String(fixed.method)}
                onChange={(e) =>
                  setFixed((v) => ({ ...v, method: e.target.value }))
                }
              >
                <option value="BANK">{t("Bank")}</option>
                <option value="CASH">{t("Cash")}</option>
                <option value="MOBILE">{t("Mobile payment")}</option>
              </Select>
            </label>
          )}
          {Object.entries(values).map(([key, value]) =>
            key === "planVersionId" ? (
              <label key={key}>
                {t("New plan")}
                <Select
                  required
                  value={value}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                >
                  <option value="">{t("Choose plan")}</option>
                  {(data.eligiblePlans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · BDT {p.price}
                    </option>
                  ))}
                </Select>
              </label>
            ) : key === "invoiceId" ? (
              <label key={key}>
                {t("Invoice")}
                <Select
                  required
                  value={value}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                >
                  <option value="">{t("Choose invoice")}</option>
                  {data.invoices
                    .filter(
                      (i) =>
                        i.dueMinor > 0 && !["DRAFT", "VOID"].includes(i.state),
                    )
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · {money(i.dueMinor)}
                      </option>
                    ))}
                </Select>
              </label>
            ) : key === "paymentId" ? (
              <label key={key}>
                {t("Verified payment")}
                <Select
                  required
                  value={value}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                >
                  <option value="">{t("Choose payment")}</option>
                  {data.payments
                    .filter(
                      (p) => p.state === "VERIFIED" && p.availableMinor > 0,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference} · {money(p.availableMinor)}
                      </option>
                    ))}
                </Select>
              </label>
            ) : (
              <label key={key}>
                {t(
                  (
                    {
                      amount: "Amount",
                      discount: "Discount",
                      subscriptionRevision: "Subscription revision",
                      dueAt: "Due date (UTC)",
                      receivedAt: "Received date (UTC)",
                      billingName: "Billing name",
                      billingAddress: "Billing address",
                      reference: "Reference",
                    } as Record<string, string>
                  )[key] ?? key,
                )}
                <input
                  autoFocus={key === Object.keys(values)[0]}
                  required
                  value={value}
                  inputMode={
                    ["amount", "discount"].includes(key) ? "decimal" : undefined
                  }
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </label>
            ),
          )}
          <label>
            {t("Billing reason")}
            <textarea
              autoFocus={!Object.keys(values).length}
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="platform-checkbox">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <span>
              {t("I confirm this billing operation for the selected shop.")}
            </span>
          </label>
        </fieldset>
        <footer>
          <button type="button" disabled={locked} onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || !confirm || reason.trim().length < 5}
          >
            {t(
              saving
                ? "Saving…"
                : uncertain
                  ? "Retry same request"
                  : "Confirm billing operation",
            )}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
function printBillingDocument(node: HTMLElement | null) {
  if (!node) return;
  const frame = document.createElement("iframe");
  frame.title = "Subscription invoice print";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  frame.srcdoc =
    '<!doctype html><html><head><meta charset="utf-8"><title>Subscription invoice</title><style>@page{size:A4;margin:18mm}body{font:14px Arial,sans-serif;color:#17221d}h2{font-size:22px}p{line-height:1.6}dl{margin-top:24px}dl>div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #ddd}dd{margin:0;font-weight:bold}</style></head><body>' +
    node.outerHTML +
    "</body></html>";
  frame.onload = () => {
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.appendChild(frame);
}
function BillingDocument({
  invoice: i,
  onClose,
}: {
  invoice: BillingInvoice;
  onClose: () => void;
}) {
  const { t } = useLanguage(),
    dialog = useRef<HTMLDialogElement>(null),
    documentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="platform-confirm billing-preview"
      aria-label={t("Subscription invoice")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="billing-toolbar">
        <button onClick={onClose}>{t("Close")}</button>
        <button onClick={() => printBillingDocument(documentRef.current)}>
          {t("Print / Save PDF")}
        </button>
      </header>
      <article ref={documentRef} className="billing-document">
        <header>
          <h2>{i.snapshot.seller.name}</h2>
          <p>{i.snapshot.seller.address}</p>
        </header>
        <h3>
          {t("Subscription invoice")} · {i.number ?? t("DRAFT")}
        </h3>
        <p>
          {i.snapshot.buyer.name}
          <br />
          {i.snapshot.buyer.address}
        </p>
        <p>{i.snapshot.description}</p>
        <p>
          {new Date(i.snapshot.periodStart).toLocaleDateString()} —{" "}
          {i.snapshot.periodEnd
            ? new Date(i.snapshot.periodEnd).toLocaleDateString()
            : t("Lifetime")}
        </p>
        <dl>
          {[
            ["Charge before discount", i.snapshot.grossMinor],
            ["Discount / service credit", i.snapshot.discountMinor],
            ["Subtotal", i.snapshot.subtotalMinor],
            ["Tax", i.snapshot.taxMinor],
            ["Invoice total", i.totalMinor],
            ["Paid / credited", i.allocatedMinor + i.creditedMinor],
            ["Outstanding", i.dueMinor],
          ].map(([label, n]) => (
            <div key={label}>
              <dt>{t(String(label))}</dt>
              <dd>{money(Number(n))}</dd>
            </div>
          ))}
        </dl>
        <strong>{t(i.state)}</strong>
      </article>
    </dialog>
  );
}
