"use client";
import {
  History,
  LayoutTemplate,
  Palette,
  RotateCcw,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api as legacyApi, ApiClientError } from "@/lib/api/client";
import {sessionBoundary} from '@/lib/api/session-boundary';
import {validCustomizationResponse} from '../shops/customization-policy';
import {
  useCustomization,
  type TenantCustomization,
} from "@/components/providers/customization-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

type Snapshot = TenantCustomization & { publishedAt: string };
type Saved = {
  revision: number;
  configs: { current: Snapshot; history: Snapshot[] };
};
const palettes: TenantCustomization["theme"]["palette"][] = [
  "pharmacy",
  "ocean",
  "violet",
  "slate",
];
const fonts: TenantCustomization["theme"]["font"][] = [
  "system",
  "rounded",
  "compact",
];
const densities: TenantCustomization["theme"]["density"][] = [
  "comfortable",
  "compact",
];
const pos: TenantCustomization["templates"]["pos"][] = ["cards", "list"];
const receipts: TenantCustomization["templates"]["receipt"][] = [
  "standard",
  "compact",
];
const reports: TenantCustomization["templates"]["report"][] = [
  "standard",
  "dense",
];
const label = (value: string) =>
  value.replace(/^./, (char) => char.toUpperCase());
export function TenantCustomizationEditor({
  canUpdate,
  busy,
  onNotice,
  onError,
  tenantId,
}: {
  canUpdate: boolean;
  busy: boolean;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  tenantId?: string;
}) {
  const { t, language } = useLanguage(),
    { customization, refreshCustomization } = useCustomization();
  const mounted=useRef(false),mutation=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const api=useMemo(()=>{
    if(!tenantId)return legacyApi;
    const signal=sessionBoundary.capture().signal;
    const request=async<T,>(path:string,method='GET',body?:unknown):Promise<T>=>{const response=await fetch(`/api/backend/tenant-workspace/${encodeURIComponent(tenantId)}${path}`,{method,credentials:'same-origin',cache:'no-store',signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();if(signal.aborted)throw new Error('Shop selection changed.');if(!response.ok||value.success!==true)throw new Error(value.message??'Customization request failed.');return value.data as T;};
    return {get:<T,>(path:string)=>request<T>(path),patch:<T,>(path:string,body:unknown)=>request<T>(path,'PATCH',body),post:<T,>(path:string,body:unknown)=>request<T>(path,'POST',body)};
  },[tenantId]);
  const [saved, setSaved] = useState<Saved | null>(null),
    [draft, setDraft] = useState<TenantCustomization>(customization),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const error = (cause: unknown) =>
    cause instanceof ApiClientError || cause instanceof Error
      ? cause.message
      : "Customization could not be saved.";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await api.get<Saved>("/settings/customization");
      if(!validCustomizationResponse(value))throw new Error('Customization response could not be verified.');
      if(!mounted.current)return;
      setSaved(value);
      setDraft(value.configs.current);
    } catch (cause) {
      if(mounted.current)onError(error(cause));
    } finally {
      if(mounted.current)setLoading(false);
    }
  }, [onError,api]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const changed = useMemo(
    () =>
      !!saved &&
      JSON.stringify({ theme: draft.theme, templates: draft.templates }) !==
        JSON.stringify({
          theme: saved.configs.current.theme,
          templates: saved.configs.current.templates,
        }),
    [draft, saved],
  );
  function choose<K extends keyof TenantCustomization["theme"]>(
    key: K,
    value: TenantCustomization["theme"][K],
  ) {
    setDraft((current) => ({
      ...current,
      theme: { ...current.theme, [key]: value },
    }));
  }
  function chooseTemplate<K extends keyof TenantCustomization["templates"]>(
    key: K,
    value: TenantCustomization["templates"][K],
  ) {
    setDraft((current) => ({
      ...current,
      templates: { ...current.templates, [key]: value },
    }));
  }
  async function publish() {
    if (!saved || mutation.current || saving || !canUpdate) return;
    mutation.current=true;
    setSaving(true);
    try {
      const value = await api.patch<Saved>("/settings/customization", {
        revision: saved.revision,
        theme: draft.theme,
        templates: draft.templates,
      });
      if(!validCustomizationResponse(value))throw new Error('Customization response could not be verified.');
      if(!mounted.current)return;
      setSaved(value);
      setDraft(value.configs.current);
      if(tenantId)window.dispatchEvent(new CustomEvent('tenant-customization-published',{detail:{tenantId}}));else await refreshCustomization();
      onNotice(t("Theme and templates published."));
    } catch (cause) {
      if(mounted.current)onError(error(cause));
    } finally {
      mutation.current=false;if(mounted.current)setSaving(false);
    }
  }
  async function restore(version: number) {
    if (!saved || mutation.current || saving || !canUpdate) return;
    mutation.current=true;
    setSaving(true);
    try {
      const value = await api.post<Saved>(
        `/settings/customization/restore/${version}`,
        { revision: saved.revision },
      );
      if(!validCustomizationResponse(value))throw new Error('Customization response could not be verified.');
      if(!mounted.current)return;
      setSaved(value);
      setDraft(value.configs.current);
      if(tenantId)window.dispatchEvent(new CustomEvent('tenant-customization-published',{detail:{tenantId}}));else await refreshCustomization();
      onNotice(t("Previous version restored as a new publication."));
    } catch (cause) {
      if(mounted.current)onError(error(cause));
    } finally {
      mutation.current=false;if(mounted.current)setSaving(false);
    }
  }
  const disabled = busy || saving || loading || !canUpdate;
  return (
    <article
      className="tenant-customization panel"
      aria-label={t("Theme and templates")}
    >
      <header>
        <span className="tenant-customization-icon">
          <Palette size={20} />
        </span>
        <div>
          <p>{t("SHOP APPEARANCE")}</p>
          <h3>{t("Theme and templates")}</h3>
          <small>
            {t(
              "Only reviewed pharmacy presets can be published. Your business data and access do not change.",
            )}
          </small>
        </div>
        {saved && (
          <span className="tenant-customization-version">
            v{saved.configs.current.version}
          </span>
        )}
      </header>
      {loading ? (
        <p>{t("Loading customization…")}</p>
      ) : (
        <div className="tenant-customization-body">
          <button type="button" disabled={saving||busy} onClick={()=>void load()}>{t('Reload customization')}</button>
          <section>
            <h4>{t("Theme")}</h4>
            <div className="tenant-customization-options">
              {palettes.map((value) => (
                <button
                  type="button"
                  key={value}
                  disabled={disabled}
                  aria-pressed={draft.theme.palette === value}
                  className={`tenant-palette tenant-palette-${value}${draft.theme.palette === value ? " selected" : ""}`}
                  onClick={() => choose("palette", value)}
                >
                  <i />
                  <span>{t(label(value))}</span>
                </button>
              ))}
            </div>
            <div className="tenant-customization-fields">
              <Choice
                label={t("Font")}
                value={draft.theme.font}
                values={fonts}
                disabled={disabled}
                onChange={(value) =>
                  choose("font", value as TenantCustomization["theme"]["font"])
                }
              />
              <Choice
                label={t("Spacing")}
                value={draft.theme.density}
                values={densities}
                disabled={disabled}
                onChange={(value) =>
                  choose(
                    "density",
                    value as TenantCustomization["theme"]["density"],
                  )
                }
              />
            </div>
          </section>
          <section>
            <h4>
              <LayoutTemplate size={16} />
              {t("Templates")}
            </h4>
            <div className="tenant-customization-fields">
              <Choice
                label={t("POS layout")}
                value={draft.templates.pos}
                values={pos}
                disabled={disabled}
                onChange={(value) =>
                  chooseTemplate(
                    "pos",
                    value as TenantCustomization["templates"]["pos"],
                  )
                }
              />
              <Choice
                label={t("Receipt")}
                value={draft.templates.receipt}
                values={receipts}
                disabled={disabled}
                onChange={(value) =>
                  chooseTemplate(
                    "receipt",
                    value as TenantCustomization["templates"]["receipt"],
                  )
                }
              />
              <Choice
                label={t("Reports")}
                value={draft.templates.report}
                values={reports}
                disabled={disabled}
                onChange={(value) =>
                  chooseTemplate(
                    "report",
                    value as TenantCustomization["templates"]["report"],
                  )
                }
              />
            </div>
          </section>
          <aside
            className={`tenant-customization-preview palette-${draft.theme.palette}`}
          >
            <span>{t("Preview")}</span>
            <strong>{t("Pharmacy workspace")}</strong>
            <div>
              <i />
              <b />
              <b />
              <b />
            </div>
            <small>{t("Published choices apply to this shop only.")}</small>
          </aside>
          <footer>
            <span>
              {saved?.configs.current.publishedAt
                ? `${t("Published")} ${new Date(saved.configs.current.publishedAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}`
                : t("Not published")}
            </span>
            <button
              type="button"
              className="purchase-primary-action"
              disabled={disabled || !changed}
              onClick={() => void publish()}
            >
              <Save size={15} />
              {t(saving ? "Publishing…" : "Publish changes")}
            </button>
          </footer>
          {saved?.configs.history.length ? (
            <details className="tenant-customization-history">
              <summary>
                <History size={15} />
                {t("Version history")}{" "}
                <span>{saved.configs.history.length}</span>
              </summary>
              {saved.configs.history.map((item) => (
                <div key={item.version}>
                  <span>
                    <strong>v{item.version}</strong>
                    <small>
                      {new Date(item.publishedAt).toLocaleString(
                        language === "bn" ? "bn-BD" : "en-GB",
                        {
                          timeZone: "Asia/Dhaka",
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    </small>
                  </span>
                  <span>
                    {t(label(item.theme.palette))} ·{" "}
                    {t(label(item.templates.pos))}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void restore(item.version)}
                  >
                    <RotateCcw size={14} />
                    {t("Restore")}
                  </button>
                </div>
              ))}
            </details>
          ) : null}
        </div>
      )}
    </article>
  );
}
function Choice({
  label: caption,
  value,
  values,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="tenant-customization-choice">
      <span>{caption}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {values.map((item) => (
          <option value={item} key={item}>
            {label(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
