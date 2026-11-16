"use client";
import "./entitlements.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Select } from "@/components/ui/select";
import { DataSkeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { createCommercialClient } from "./commercial-client";
import { PlatformError } from "./platform-client";
import {
  commercialFeatures,
  validPlanConfig,
  type PlanConfig,
} from "./commercial-policy";
type Version = {
  id: string;
  addonKey: string;
  version: number;
  revision: number;
  status: string;
  config: PlanConfig;
};
type Grant = {
  id: string;
  targetTenantId: string;
  revision: number;
  snapshot: PlanConfig;
  startsAt: string;
  endsAt: string | null;
  paidAt: string | null;
  canceledAt: string | null;
};
type Effective = {
  targetTenantId: string;
  state: string;
  operable: boolean;
  revision: string;
  features: PlanConfig["features"];
  limits: PlanConfig["limits"];
  usage: {
    branches: number;
    seats: number;
    storageBytes: number;
    reservedStorageBytes: number;
  };
};
export function validEffective(v: unknown, target: string): v is Effective {
  if (!v || typeof v !== "object") return false;
  const e = v as Effective;
  return (
    e.targetTenantId === target &&
    typeof e.state === "string" &&
    typeof e.operable === "boolean" &&
    typeof e.revision === "string" &&
    !!e.features &&
    commercialFeatures.every((k) => typeof e.features[k] === "boolean") &&
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
export function EntitlementsWorkspace({
  target,
  canManage,
  blocked,
  onLock,
}: {
  target: string;
  canManage: boolean;
  blocked: boolean;
  onLock: (v: boolean) => void;
}) {
  const { t } = useLanguage(),
    client = useRef<ReturnType<typeof createCommercialClient> | null>(null),
    live = useRef(false),
    guard = useRef(false),
    attempt = useRef<{
      path: string;
      method: string;
      body: unknown;
      key: string;
    } | null>(null);
  const initial: PlanConfig = {
    name: "",
    currency: "BDT",
    price: "0.00",
    audience: { kind: "DEDICATED", tenantIds: [target] },
    term: { kind: "MONTHLY", days: null },
    trialDays: 0,
    graceDays: 0,
    features: Object.fromEntries(
      commercialFeatures.map((k) => [k, false]),
    ) as PlanConfig["features"],
    limits: { branches: 0, seats: 0, storageBytes: 0 },
  };
  const [checkedAt,setCheckedAt]=useState(0);
  const [versions, setVersions] = useState<Version[]>([]),
    [grants, setGrants] = useState<Grant[]>([]),
    [effective, setEffective] = useState<Effective | null>(null),
    [config, setConfig] = useState(initial),
    [addonKey, setAddonKey] = useState(""),
    [editing, setEditing] = useState<Version | null>(null),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const locked = busy || uncertain,
    ready =
      canManage && !blocked && !locked && confirm && reason.trim().length >= 5;
  useEffect(() => {
    const c = createCommercialClient(sessionBoundary.capture().signal);
    client.current = c;
    live.current = true;
    return () => {
      live.current = false;
      c.dispose();
    };
  }, [target]);
  useEffect(() => {
    const c = client.current;
    if (!c) return;
    let current = true;
    Promise.all([
      c.request<Version[]>("addons"),
      c.request<{
        targetTenantId: string;
        effective: unknown;
        grants: Grant[];
      }>("shops/" + target + "/entitlements"),
    ])
      .then(([list, shop]) => {
        if (!current) return;
        if (
          !Array.isArray(list) ||
          list.length > 100 ||
          list.some(
            (v) =>
              !v ||
              typeof v.id !== "string" ||
              !["DRAFT", "PUBLISHED", "RETIRED"].includes(v.status) ||
              !validPlanConfig(v.config),
          ) ||
          shop.targetTenantId !== target ||
          !validEffective(shop.effective, target) ||
          !Array.isArray(shop.grants) ||
          shop.grants.some(
            (g) => g.targetTenantId !== target || !validPlanConfig(g.snapshot),
          )
        )
          throw Error("Entitlement data could not be verified.");
        setVersions(list);
        setGrants(shop.grants);
        setCheckedAt(Date.now());
        setEffective(shop.effective);
        setError("");
      })
      .catch((e) => {
        if (current) {
          setEffective(null);
          setError(e.message);
        }
      });
    return () => {
      current = false;
    };
  }, [target, revision]);
  async function perform(path: string, method: string, body: unknown) {
    if (
      guard.current ||
      !client.current ||
      !canManage ||
      (!attempt.current && !ready)
    )
      return;
    guard.current = true;
    if (!attempt.current)
      attempt.current = { path, method, body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    onLock(true);
    try {
      const a = attempt.current,
        v = await client.current.request<{ id: string }>(
          a.path,
          a.method,
          a.body,
          a.key,
        );
      if (!live.current) return;
      if (!v || typeof v.id !== "string")
        throw new PlatformError(
          "Add-on result could not be verified. Retry the same request.",
          502,
        );
      attempt.current = null;
      setUncertain(false);
      onLock(false);
      setEditing(null);
      setConfirm(false);
      setRevision((v) => v + 1);
    } catch (e) {
      if (!live.current) return;
      const unknown = !(e instanceof PlatformError) || e.status >= 500;
      setUncertain(unknown);
      onLock(unknown);
      if (!unknown) attempt.current = null;
      setError(e instanceof Error ? e.message : "Add-on operation failed.");
    } finally {
      guard.current = false;
      if (live.current) setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!validPlanConfig(config) || config.trialDays || config.graceDays)
      return;
    void perform(
      editing ? "addons/" + editing.id : "addons",
      editing ? "PATCH" : "POST",
      {
        ...(editing ? { revision: editing.revision } : { addonKey }),
        config,
        reason: reason.trim(),
      },
    );
  }
  const eligible = versions.filter(
    (v) =>
      v.status === "PUBLISHED" &&
      (v.config.audience.kind === "PUBLIC" ||
        v.config.audience.tenantIds.includes(target)),
  );
  return (
    <section
      className="platform-entitlements"
      aria-label={t("Features and capacity")}
    >
      <h3>{t("Features and capacity")}</h3>
      {error && <p role="alert">{t(error)}</p>}
      {!effective ? (
        <DataSkeleton rows={3} />
      ) : (
        <>
          <p>{t(effective.state)}</p>
          <dl className="entitlement-usage">
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
                  {effective.usage[k]} /{" "}
                  {effective.limits[k] === null
                    ? t("Unlimited")
                    : effective.limits[k]}
                </dd>
              </div>
            ))}
            <div>
              <dt>{t("Reserved storage bytes")}</dt>
              <dd>{effective.usage.reservedStorageBytes}</dd>
            </div>
          </dl>
          <p>
            {t("Enabled modules")}:{" "}
            {commercialFeatures
              .filter((k) => effective.features[k])
              .map((k) => t(k))
              .join(", ") || t("None")}
          </p>
        </>
      )}
      {canManage && (
        <>
          <fieldset disabled={locked || blocked}>
            <label>
              {t("Add-on change reason")}
              <textarea
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
                {t("I confirm this add-on agreement and selected shop.")}
              </span>
            </label>
          </fieldset>
          <details>
            <summary>{t("Build an add-on version")}</summary>
            <form onSubmit={save}>
              <fieldset disabled={locked || blocked}>
                <label>
                  {t("Add-on key")}
                  <input
                    required
                    disabled={!!editing}
                    value={addonKey}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={80}
                    onChange={(e) => setAddonKey(e.target.value)}
                  />
                </label>
                <label>
                  {t("Add-on name")}
                  <input
                    required
                    value={config.name}
                    maxLength={150}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("Price (BDT)")}
                  <input
                    required
                    inputMode="decimal"
                    value={config.price}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, price: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("Audience")}
                  <Select
                    value={config.audience.kind}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        audience:
                          e.target.value === "PUBLIC"
                            ? { kind: "PUBLIC", tenantIds: [] }
                            : { kind: "DEDICATED", tenantIds: [target] },
                      }))
                    }
                  >
                    <option value="DEDICATED">
                      {t("Dedicated to this shop")}
                    </option>
                    <option value="PUBLIC">{t("Public")}</option>
                  </Select>
                </label>
                <label>
                  {t("Term")}
                  <Select
                    value={config.term.kind}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        term: {
                          kind: e.target.value as PlanConfig["term"]["kind"],
                          days: e.target.value === "FIXED_DAYS" ? 30 : null,
                        },
                      }))
                    }
                  >
                    {["MONTHLY", "ANNUAL", "FIXED_DAYS", "LIFETIME"].map(
                      (k) => (
                        <option key={k} value={k}>
                          {t(k)}
                        </option>
                      ),
                    )}
                  </Select>
                </label>
                {config.term.kind === "FIXED_DAYS" && (
                  <label>
                    {t("Term days")}
                    <input
                      type="number"
                      required
                      min={1}
                      max={3660}
                      value={config.term.days ?? 30}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          term: { ...c.term, days: Number(e.target.value) },
                        }))
                      }
                    />
                  </label>
                )}
                <div className="addon-feature-list">
                  {commercialFeatures.map((k) => (
                    <label className="platform-checkbox" key={k}>
                      <input
                        type="checkbox"
                        checked={config.features[k]}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            features: { ...c.features, [k]: e.target.checked },
                          }))
                        }
                      />
                      <span>{t(k)}</span>
                    </label>
                  ))}
                </div>
                {(["branches", "seats", "storageBytes"] as const).map((k) => (
                  <div key={k}>
                    <label>
                      {t(
                        {
                          branches: "Extra branches",
                          seats: "Extra team seats",
                          storageBytes: "Extra storage bytes",
                        }[k],
                      )}
                      <input
                        type="number"
                        min={0}
                        max={Number.MAX_SAFE_INTEGER}
                        disabled={config.limits[k] === null}
                        value={config.limits[k] ?? 0}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            limits: {
                              ...c.limits,
                              [k]: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="platform-checkbox">
                      <input
                        type="checkbox"
                        checked={config.limits[k] === null}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            limits: {
                              ...c.limits,
                              [k]: e.target.checked ? null : 0,
                            },
                          }))
                        }
                      />
                      <span>{t("Explicit unlimited capacity")}</span>
                    </label>
                  </div>
                ))}
              </fieldset>
              <button type="submit" disabled={!ready}>
                {t(editing ? "Save add-on draft" : "Create add-on draft")}
              </button>
            </form>
          </details>
        </>
      )}
      <ul className="billing-records">
        {versions.map((v) => (
          <li key={v.id}>
            <strong>
              {v.config.name} · {v.version}
            </strong>
            <p>
              {t(v.status)} · BDT {v.config.price} · {t(v.config.audience.kind)}
            </p>
            {canManage && (
              <div className="billing-toolbar">
                <button
                  disabled={locked || blocked}
                  onClick={() => {
                    setEditing(null);
                    setConfig(v.config);
                    setAddonKey(v.addonKey);
                  }}
                >
                  {t("Clone as new version")}
                </button>
                {v.status === "DRAFT" && (
                  <>
                    <button
                      disabled={locked || blocked}
                      onClick={() => {
                        setEditing(v);
                        setConfig(v.config);
                        setAddonKey(v.addonKey);
                      }}
                    >
                      {t("Edit draft")}
                    </button>
                    <button
                      disabled={!ready}
                      onClick={() =>
                        void perform("addons/" + v.id + "/status", "POST", {
                          revision: v.revision,
                          status: "PUBLISHED",
                          reason: reason.trim(),
                        })
                      }
                    >
                      {t("Publish version")}
                    </button>
                  </>
                )}
                {v.status === "PUBLISHED" && (
                  <button
                    disabled={!ready}
                    onClick={() =>
                      void perform("addons/" + v.id + "/status", "POST", {
                        revision: v.revision,
                        status: "RETIRED",
                        reason: reason.trim(),
                      })
                    }
                  >
                    {t("Retire version")}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <fieldset disabled={locked || blocked}>
          <label>
            {t("Eligible add-on")}
            <Select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("Choose add-on")}</option>
              {eligible.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.config.name} · BDT {v.config.price}
                </option>
              ))}
            </Select>
          </label>
          <button
            disabled={!ready || !selected}
            onClick={() =>
              void perform("shops/" + target + "/addons", "POST", {
                addonVersionId: selected,
                startsAt: new Date().toISOString(),
                reason: reason.trim(),
              })
            }
          >
            {t("Assign add-on")}
          </button>
          <p>
            {t(
              "Paid add-ons require a verified billing invoice before access increases.",
            )}
          </p>
        </fieldset>
      )}
      <ul className="billing-records">
        {grants.map((g) => (
          <li key={g.id}>
            <strong>{g.snapshot.name}</strong>
            <p>
              {t(
                g.canceledAt
                  ? "Canceled"
                  : !g.paidAt && Number(g.snapshot.price) > 0
                    ? "Payment required"
                    : g.endsAt && Date.parse(g.endsAt) <= checkedAt
                      ? "Expired"
                      : Date.parse(g.startsAt) > checkedAt
                        ? "Scheduled"
                        : "Active",
              )}
            </p>
            {canManage && !g.canceledAt && (
              <button
                disabled={!ready}
                onClick={() =>
                  void perform(
                    "shops/" + target + "/addons/" + g.id + "/cancel",
                    "POST",
                    { revision: g.revision, reason: reason.trim() },
                  )
                }
              >
                {t("Cancel add-on")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {uncertain && (
        <button
          disabled={busy}
          onClick={() => {
            const a = attempt.current;
            if (a) void perform(a.path, a.method, a.body);
          }}
        >
          {t("Retry same request")}
        </button>
      )}
    </section>
  );
}
