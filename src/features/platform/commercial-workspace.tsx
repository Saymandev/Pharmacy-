"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Select } from "@/components/ui/select";
import { DataSkeleton } from "@/components/ui/skeleton";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { useLanguage } from "@/lib/i18n/language-provider";
import { createCommercialClient } from "./commercial-client";
import { PlatformError } from "./platform-client";
import {
  commercialFeatures,
  validPlanConfig,
  type PlanConfig,
  type PlanVersion,
  type Subscription,
} from "./commercial-policy";
import "./commercial.css";
type Client = ReturnType<typeof createCommercialClient>;
type Lock = (v: boolean) => void;
const initial: PlanConfig = {
  name: "Pharmacy plan",
  currency: "BDT",
  price: "0.00",
  audience: { kind: "PUBLIC", tenantIds: [] },
  term: { kind: "MONTHLY", days: null },
  trialDays: 0,
  graceDays: 0,
  features: Object.fromEntries(
    commercialFeatures.map((k) => [k, false]),
  ) as PlanConfig["features"],
  limits: { branches: 1, seats: 1, storageBytes: 104857600 },
};
const validPlan = (p: PlanVersion) =>
  p &&
  typeof p.id === "string" &&
  typeof p.planKey === "string" &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.planKey) &&
  p.planKey.length <= 80 &&
  Number.isInteger(p.revision) &&
  Number.isInteger(p.version) &&
  ["DRAFT", "PUBLISHED", "RETIRED"].includes(p.status) &&
  validPlanConfig(p.config);
const validSubscription = (s: Subscription, target: string) =>
  s &&
  s.targetTenantId === target &&
  typeof s.id === "string" &&
  Number.isInteger(s.revision) &&
  validPlanConfig(s.snapshot) &&
  (s.snapshot.audience.kind === "PUBLIC" ||
    s.snapshot.audience.tenantIds.includes(target)) &&
  [
    "SCHEDULED",
    "TRIALING",
    "ACTIVE",
    "PENDING_PAYMENT",
    "GRACE",
    "EXPIRED",
    "CANCELED",
  ].includes(s.state);
function useCommercial(onLock: Lock) {
  const client = useRef<Client | null>(null),
    alive = useRef(false),
    guard = useRef(false),
    pending = useRef<{
      path: string;
      method: string;
      body: unknown;
      key: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const transport = createCommercialClient(sessionBoundary.capture().signal);
    client.current = transport;
    alive.current = true;
    return () => {
      alive.current = false;
      client.current = null;
      transport.dispose();
    };
  }, []);
  const write = async (
    path: string,
    method: string,
    body: unknown,
    verify: (value: unknown) => boolean,
    onSaved: () => void,
  ) => {
    if (guard.current || !client.current) return;
    guard.current = true;
    if (!pending.current)
      pending.current = {
        path,
        method,
        body: structuredClone(body),
        key: crypto.randomUUID(),
      };
    setBusy(true);
    setError("");
    onLock(true);
    try {
      const a = pending.current,
        value = await client.current.request(a.path, a.method, a.body, a.key);
      if (!alive.current) return;
      if (!verify(value))
        throw new PlatformError(
          "Save response could not be verified. Retry the same request.",
          502,
        );
      pending.current = null;
      setUncertain(false);
      onLock(false);
      onSaved();
    } catch (cause) {
      if (!alive.current) return;
      const unknown = !(cause instanceof PlatformError) || cause.status >= 500;
      setUncertain(unknown);
      if (!unknown) pending.current = null;
      onLock(unknown);
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return {
    client,
    alive,
    write,
    busy,
    uncertain,
    error,
    setError,
    disabled: busy || uncertain,
  };
}
export function PlanCatalog({
  canManage,
  onLock,
  target,
  blocked = false,
}: {
  canManage: boolean;
  onLock: Lock;
  target?: string;
  blocked?: boolean;
}) {
  const { t } = useLanguage(),
    c = useCommercial(onLock),
    [rows, setRows] = useState<PlanVersion[]>([]),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [reload, setReload] = useState(0),
    [editing, setEditing] = useState<PlanVersion | null>(null),
    [cloneId, setCloneId] = useState<string | undefined>(),
    [planKey, setPlanKey] = useState("pharmacy-standard"),
    [draft, setDraft] = useState<PlanConfig>(initial),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState("");
  const { client: transportRef, setError: reportError } = c;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      reportError("");
      void transportRef
        .current!.request<{ items: PlanVersion[]; hasMore: boolean }>(
          "plans?page=" + page,
        )
        .then((value) => {
          if (!active) return;
          if (!Array.isArray(value.items) || !value.items.every(validPlan))
            throw new Error("Plan catalog could not be verified.");
          setRows(value.items);
          setHasMore(value.hasMore);
        })
        .catch((e) => {
          if (active) {
            setRows([]);
            reportError(e.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [page, reload, transportRef, reportError]);
  const saved = () => {
    setNotice(
      "Plan changes saved. Existing subscribers keep their agreed version.",
    );
    setEditing(null);
    setCloneId(undefined);
    setReload((v) => v + 1);
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!validPlanConfig(draft)) {
      reportError("Check the audience, term, features and limits.");
      return;
    }
    await c.write(
      editing ? "plans/" + editing.id : "plans",
      editing ? "PATCH" : "POST",
      editing
        ? { revision: editing.revision, config: draft, reason }
        : {
            planKey,
            config: draft,
            ...(cloneId ? { cloneFromId: cloneId } : {}),
            reason,
          },
      (v) => validPlan(v as PlanVersion),
      saved,
    );
  }
  function choose(p: PlanVersion, edit = false) {
    if (c.disabled) return;
    setDraft(structuredClone(p.config));
    setPlanKey(p.planKey);
    setEditing(edit ? p : null);
    setCloneId(edit ? undefined : p.id);
    setReason("");
    setNotice("");
  }
  return (
    <section className="commercial-panel" aria-label={t("Plans and versions")}>
      <fieldset disabled={blocked && !c.disabled}>
        <header>
          <div>
            <h2>{t("Plans and versions")}</h2>
            <p>
              {t(
                "Publish public plans or a dedicated agreement for selected shops. Published terms stay unchanged.",
              )}
            </p>
          </div>
          <button
            disabled={c.disabled || loading}
            onClick={() => setReload((v) => v + 1)}
          >
            {t("Reload plans")}
          </button>
        </header>
        {notice && <p role="status">{t(notice)}</p>}
        {c.error && <p role="alert">{t(c.error)}</p>}
        {loading ? (
          <DataSkeleton rows={3}>{t("Loading plans…")}</DataSkeleton>
        ) : (
          <>
            <ul className="commercial-plans">
              {rows.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>
                      {p.config.name} · v{p.version}
                    </strong>
                    <small>
                      {p.planKey} · {p.status} · {p.config.audience.kind}
                    </small>
                    <p>
                      BDT {p.config.price} / {p.config.term.kind}
                    </p>
                    <details>
                      <summary>{t("Preview agreed terms")}</summary>
                      <p>
                        {t("Trial days")}: {p.config.trialDays} ·{" "}
                        {t("Grace days")}: {p.config.graceDays}
                      </p>
                      <p>
                        {commercialFeatures
                          .filter((k) => p.config.features[k])
                          .map((k) => t(k))
                          .join(" · ") || t("No modules enabled")}
                      </p>
                      <ul>
                        {Object.entries(p.config.limits).map(([k, v]) => (
                          <li key={k}>
                            {t(k)}: {v === null ? t("Unlimited") : v}
                          </li>
                        ))}
                      </ul>
                      {p.config.audience.kind === "DEDICATED" && (
                        <p>
                          {t("Eligible shops")}:{" "}
                          {p.config.audience.tenantIds.join(", ")}
                        </p>
                      )}
                    </details>
                  </div>
                  {canManage && (
                    <div>
                      <button disabled={c.disabled} onClick={() => choose(p)}>
                        {t("Clone as new version")}
                      </button>
                      {p.status === "DRAFT" && (
                        <button
                          disabled={c.disabled}
                          onClick={() => choose(p, true)}
                        >
                          {t("Edit draft")}
                        </button>
                      )}
                      {p.status !== "RETIRED" && (
                        <button
                          disabled={
                            c.busy || (!c.uncertain && reason.trim().length < 5)
                          }
                          onClick={() =>
                            void c.write(
                              `plans/${p.id}/status`,
                              "POST",
                              {
                                revision: p.revision,
                                status:
                                  p.status === "DRAFT"
                                    ? "PUBLISHED"
                                    : "RETIRED",
                                reason,
                              },
                              (v) => validPlan(v as PlanVersion),
                              saved,
                            )
                          }
                        >
                          {t(
                            c.uncertain
                              ? "Retry same request"
                              : p.status === "DRAFT"
                                ? "Publish version"
                                : "Retire version",
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!rows.length && <p>{t("No plan versions yet.")}</p>}
            <nav>
              <button
                disabled={c.disabled || page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("Previous")}
              </button>
              <span>{page}</span>
              <button
                disabled={c.disabled || !hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("Next")}
              </button>
            </nav>
          </>
        )}
        {canManage && (
          <form onSubmit={save} className="commercial-editor">
            <h3>
              {t(
                editing
                  ? "Edit draft"
                  : cloneId
                    ? "New version from existing plan"
                    : "Create plan draft",
              )}
            </h3>
            <fieldset disabled={c.disabled}>
              <div className="commercial-grid">
                <label>
                  {t("Plan key")}
                  <input
                    required
                    maxLength={80}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    disabled={!!editing}
                    value={planKey}
                    onChange={(e) => setPlanKey(e.target.value)}
                  />
                </label>
                <label>
                  {t("Plan name")}
                  <input
                    required
                    maxLength={150}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((v) => ({ ...v, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("Price (BDT)")}
                  <input
                    required
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) =>
                      setDraft((v) => ({ ...v, price: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("Audience")}
                  <Select
                    value={draft.audience.kind}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        audience:
                          e.target.value === "PUBLIC"
                            ? { kind: "PUBLIC", tenantIds: [] }
                            : {
                                kind: "DEDICATED",
                                tenantIds: target ? [target] : [],
                              },
                      }))
                    }
                  >
                    <option>PUBLIC</option>
                    <option>DEDICATED</option>
                  </Select>
                </label>
                {draft.audience.kind === "DEDICATED" && (
                  <label>
                    {t("Dedicated shop IDs")}
                    <input
                      required
                      value={draft.audience.tenantIds.join(",")}
                      onChange={(e) =>
                        setDraft((v) => ({
                          ...v,
                          audience: {
                            kind: "DEDICATED",
                            tenantIds: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                    />
                    <small>
                      {t(
                        "Comma-separated shop IDs. Other shops cannot use this agreement.",
                      )}
                    </small>
                  </label>
                )}
                <label>
                  {t("Term")}
                  <Select
                    value={draft.term.kind}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        term: {
                          kind: e.target.value as PlanConfig["term"]["kind"],
                          days: e.target.value === "FIXED_DAYS" ? 30 : null,
                        },
                      }))
                    }
                  >
                    {["MONTHLY", "ANNUAL", "FIXED_DAYS", "LIFETIME"].map(
                      (k) => (
                        <option key={k}>{k}</option>
                      ),
                    )}
                  </Select>
                </label>
                {draft.term.kind === "FIXED_DAYS" && (
                  <label>
                    {t("Term days")}
                    <input
                      required
                      type="number"
                      min={1}
                      max={3660}
                      value={draft.term.days ?? 30}
                      onChange={(e) =>
                        setDraft((v) => ({
                          ...v,
                          term: { ...v.term, days: Number(e.target.value) },
                        }))
                      }
                    />
                  </label>
                )}
                <label>
                  {t("Trial days")}
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={draft.trialDays}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        trialDays: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  {t("Grace days")}
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={draft.graceDays}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        graceDays: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <h4>{t("Enabled modules")}</h4>
              <div className="commercial-features">
                {commercialFeatures.map((k) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={draft.features[k]}
                      onChange={(e) =>
                        setDraft((v) => ({
                          ...v,
                          features: { ...v.features, [k]: e.target.checked },
                        }))
                      }
                    />
                    {t(k)}
                  </label>
                ))}
              </div>
              <h4>{t("Limits")}</h4>
              <p>
                {t(
                  "Enter zero to allow none. Select Unlimited explicitly when agreed.",
                )}
              </p>
              <div className="commercial-grid">
                {(["branches", "seats", "storageBytes"] as const).map((k) => (
                  <label key={k}>
                    {t(k)}
                    <input
                      type="number"
                      min={0}
                      disabled={draft.limits[k] === null}
                      value={draft.limits[k] ?? ""}
                      onChange={(e) =>
                        setDraft((v) => ({
                          ...v,
                          limits: { ...v.limits, [k]: Number(e.target.value) },
                        }))
                      }
                    />
                    <span>
                      <input
                        type="checkbox"
                        checked={draft.limits[k] === null}
                        onChange={(e) =>
                          setDraft((v) => ({
                            ...v,
                            limits: {
                              ...v.limits,
                              [k]: e.target.checked ? null : 0,
                            },
                          }))
                        }
                      />
                      {t("Unlimited")}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              {t("Commercial change reason")}
              <textarea
                aria-label={t("Commercial change reason")}
                required
                minLength={5}
                maxLength={1000}
                disabled={c.disabled}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <small>
                {t("Required for draft saves, publication and retirement.")}
              </small>
            </label>
            <button type="submit" disabled={c.busy || reason.trim().length < 5}>
              {t(
                c.busy
                  ? "Saving…"
                  : c.uncertain
                    ? "Retry same request"
                    : "Save draft",
              )}
            </button>
          </form>
        )}
      </fieldset>
    </section>
  );
}
export function ShopSubscription({
  target,
  canManage,
  canReadPlans,
  onLock,
  blocked = false,
}: {
  target: string;
  canManage: boolean;
  canReadPlans: boolean;
  blocked?: boolean;
  onLock: Lock;
}) {
  const { t } = useLanguage(),
    c = useCommercial(onLock),
    [subscription, setSubscription] = useState<Subscription | null>(null),
    [plans, setPlans] = useState<PlanVersion[]>([]),
    [planId, setPlanId] = useState(""),
    [reason, setReason] = useState(""),
    [useTrial, setUseTrial] = useState(false),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [notice, setNotice] = useState(""),
    [events, setEvents] = useState<
      {
        id: string;
        targetTenantId: string;
        kind: string;
        reason: string;
        createdAt: string;
      }[]
    >([]),
    [planPage, setPlanPage] = useState(1),
    [morePlans, setMorePlans] = useState(false);
  const [extensionDays, setExtensionDays] = useState(7);
  const [startAt,setStartAt]=useState(()=>new Date(Date.now()+21600000).toISOString().slice(0,16));
  const { client: transportRef, alive: aliveRef, setError: reportError } = c;
  const load = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;
    setLoading(true);
    try {
      const [sub, catalog, history] = await Promise.all([
        transport.request<Subscription | null>(`shops/${target}/subscription`),
        canReadPlans
          ? transport.request<{ items: PlanVersion[]; hasMore: boolean }>(
              `plans?status=PUBLISHED&targetTenantId=${encodeURIComponent(target)}&page=${planPage}`,
            )
          : Promise.resolve({ items: [], hasMore: false }),
        transport.request<{
          items: {
            id: string;
            targetTenantId: string;
            kind: string;
            reason: string;
            createdAt: string;
          }[];
        }>(`shops/${target}/subscription/events`),
      ]);
      if (!aliveRef.current) return;
      if (
        (sub && !validSubscription(sub, target)) ||
        !Array.isArray(catalog.items) ||
        !catalog.items.every(validPlan) ||
        !Array.isArray(history.items) ||
        !history.items.every(
          (e) =>
            e.targetTenantId === target &&
            typeof e.id === "string" &&
            typeof e.kind === "string" &&
            typeof e.reason === "string" &&
            Number.isFinite(Date.parse(e.createdAt)),
        )
      )
        throw new Error("Subscription details could not be verified.");
      setSubscription(sub);
      setPlans(catalog.items);
      setMorePlans(catalog.hasMore);
      setEvents(history.items);
    } catch (e) {
      if (aliveRef.current)
        reportError(
          e instanceof Error ? e.message : "Subscription could not be loaded.",
        );
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [target, canReadPlans, planPage, transportRef, aliveRef, reportError]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, reload]);
  const save = (action: string) => {
    if(!subscription&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt)||!Number.isFinite(Date.parse(startAt+':00+06:00')))){reportError('Choose a valid subscription start date.');return;}
    if (reason.trim().length < 5) {
      reportError("Enter a reason of at least five characters.");
      return;
    }
    const body = !subscription
      ? {
          planVersionId: planId,
          startAt: new Date(startAt+':00+06:00').toISOString(),
          useTrial,
          reason,
        }
      : action === "change"
        ? { revision: subscription.revision, planVersionId: planId, reason }
        : action === "cancel" || action === "cancel-now"
          ? {
              revision: subscription.revision,
              immediate: action === "cancel-now",
              reason,
            }
          : action === "extend-trial" || action === "extend-grace"
            ? {
                revision: subscription.revision,
                kind: action === "extend-trial" ? "trial" : "grace",
                days: extensionDays,
                reason,
              }
            : { revision: subscription.revision, reason };
    void c.write(
      `shops/${target}/subscription${action ? "/" + (action.startsWith("extend-") ? "extend" : action === "cancel-now" ? "cancel" : action) : ""}`,
      "POST",
      body,
      (v) => validSubscription(v as Subscription, target),
      () => {
        setNotice("Subscription change saved.");
        setReload((v) => v + 1);
      },
    );
  };
  return (
    <section className="commercial-panel" aria-label={t("Shop subscription")}>
      <fieldset disabled={blocked && !c.disabled}>
        <header>
          <h3>{t("Shop subscription")}</h3>
          <button
            disabled={c.disabled || loading}
            onClick={() => {
              reportError("");
              setReload((v) => v + 1);
            }}
          >
            {t("Reload subscription")}
          </button>
        </header>
        {c.error && <p role="alert">{t(c.error)}</p>}
        {notice && <p role="status">{t(notice)}</p>}
        {loading ? (
          <DataSkeleton rows={3}>{t("Loading subscription…")}</DataSkeleton>
        ) : (
          <>
            {subscription ? (
              <>
                <strong>
                  {subscription.snapshot.name} · {subscription.state}
                </strong>
                <p>
                  BDT {subscription.snapshot.price} /{" "}
                  {subscription.snapshot.term.kind}
                </p>
                <dl>
                  <dt>{t("Period start")}</dt>
                  <dd>
                    {new Date(subscription.periodStart).toLocaleString(
                      undefined,
                      { timeZone: "Asia/Dhaka" },
                    )}
                  </dd>
                  <dt>{t("Period end")}</dt>
                  <dd>
                    {subscription.periodEnd
                      ? new Date(subscription.periodEnd).toLocaleString(
                          undefined,
                          { timeZone: "Asia/Dhaka" },
                        )
                      : t("Lifetime")}
                  </dd>
                  <dt>{t("Grace ends")}</dt>
                  <dd>
                    {subscription.graceEnd
                      ? new Date(subscription.graceEnd).toLocaleString(
                          undefined,
                          { timeZone: "Asia/Dhaka" },
                        )
                      : "—"}
                  </dd>
                </dl>
                {subscription.scheduledPlanVersionId && (
                  <p>{t("Plan change scheduled for the next renewal.")}</p>
                )}
                {subscription.cancelAtEnd && (
                  <p>{t("Cancellation scheduled for period end.")}</p>
                )}
                {subscription.state === "PENDING_PAYMENT" && (
                  <p>
                    {t(
                      "Payment verification is required before paid access starts.",
                    )}
                  </p>
                )}
              </>
            ) : (
              <p>{t("No base subscription assigned.")}</p>
            )}
            {canManage && (
              <div className="commercial-editor">
                <fieldset disabled={c.disabled}>
                {!subscription&&<label>{t('Subscription starts (Asia/Dhaka)')}<input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)}/></label>}
                  <label>
                    {t("Eligible plan version")}
                    <Select
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                    >
                      <option value="">{t("Choose a published plan")}</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.config.name} · v{p.version} · BDT {p.config.price}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <nav>
                    <button
                      disabled={planPage === 1}
                      onClick={() => setPlanPage((p) => p - 1)}
                    >
                      {t("Previous plans")}
                    </button>
                    <button
                      disabled={!morePlans}
                      onClick={() => setPlanPage((p) => p + 1)}
                    >
                      {t("Next plans")}
                    </button>
                  </nav>
                  {!subscription && (
                    <label>
                      <input
                        type="checkbox"
                        checked={useTrial}
                        onChange={(e) => setUseTrial(e.target.checked)}
                      />
                      {t("Start with the configured trial")}
                    </label>
                  )}
                  <label>
                    {t("Subscription change reason")}
                    <textarea
                      aria-label={t("Subscription change reason")}
                      required
                      minLength={5}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                </fieldset>
                {subscription && (
                  <label>
                    {t("Extension days")}
                    <input
                      type="number"
                      min={1}
                      max={365}
                      disabled={c.disabled}
                      value={extensionDays}
                      onChange={(e) => setExtensionDays(Number(e.target.value))}
                    />
                  </label>
                )}
                <div className="commercial-actions">
                  {c.uncertain ? (
                    <button disabled={c.busy} onClick={() => save("")}>
                      {t("Retry same request")}
                    </button>
                  ) : !subscription ? (
                    <button
                      disabled={c.busy || !planId || !canReadPlans}
                      onClick={() => save("")}
                    >
                      {t("Assign subscription")}
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={
                          c.busy ||
                          !planId ||
                          !canReadPlans ||
                          subscription.cancelAtEnd ||
                          !!subscription.canceledAt
                        }
                        onClick={() => save("change")}
                      >
                        {t("Schedule plan at renewal")}
                      </button>
                      <button
                        disabled={
                          c.busy ||
                          !subscription.periodEnd ||
                          new Date(subscription.periodEnd) > new Date() ||
                          subscription.cancelAtEnd ||
                          !!subscription.canceledAt
                        }
                        onClick={() => save("renew")}
                      >
                        {t("Renew complimentary term")}
                      </button>
                      <button
                        disabled={
                          c.busy ||
                          !subscription.periodEnd ||
                          subscription.cancelAtEnd ||
                          !!subscription.canceledAt
                        }
                        onClick={() => save("cancel")}
                      >
                        {t("Cancel at period end")}
                      </button>
                      <button
                        disabled={c.busy || !!subscription.canceledAt}
                        onClick={() => save("cancel-now")}
                      >
                        {t("Cancel immediately")}
                      </button>
                      <button
                        disabled={
                          c.busy ||
                          !subscription.trialEnd ||
                          subscription.cancelAtEnd ||
                          !!subscription.canceledAt
                        }
                        onClick={() => save("extend-trial")}
                      >
                        {t("Extend trial")}
                      </button>
                      <button
                        disabled={
                          c.busy ||
                          !subscription.periodEnd ||
                          subscription.cancelAtEnd ||
                          !!subscription.canceledAt
                        }
                        onClick={() => save("extend-grace")}
                      >
                        {t("Extend grace")}
                      </button>
                    </>
                  )}
                </div>
                <p>
                  {t(
                    "Changes default to renewal. Paid renewal and immediate price adjustments require billing settlement.",
                  )}
                </p>
              </div>
            )}
            <details>
              <summary>{t("Subscription history")}</summary>
              <ul>
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.kind}</strong>
                    <p>{event.reason}</p>
                    <small>
                      {new Date(event.createdAt).toLocaleString(undefined, {
                        timeZone: "Asia/Dhaka",
                      })}
                    </small>
                  </li>
                ))}
              </ul>
              {!events.length && <p>{t("No subscription events yet.")}</p>}
            </details>
          </>
        )}
      </fieldset>
    </section>
  );
}
