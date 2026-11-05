"use client";
import { useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { validHttpUrl } from "@/lib/forms/validation";

export function BrandingField({ value, onChange, disabled, onUploading }: { value: string; onChange: (value: string) => void; disabled: boolean; onUploading: (value: boolean) => void }) {
  const { t } = useLanguage(), { hasPermission } = useAuth();
  const file = useRef<HTMLInputElement>(null), lock = useRef(false);
  const [uploading, setUploading] = useState(false), [error, setError] = useState(""), [failed, setFailed] = useState("");
  async function upload(selected?: File) {
    if (!selected || lock.current || disabled || !hasPermission("media:create")) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 2 * 1024 * 1024) { setError(t("Use a PNG, JPG or WebP logo up to 2 MB.")); return; }
    lock.current = true; setUploading(true); onUploading(true); setError("");
    try {
      const body = new FormData(); body.append("file", selected);
      const result = await api.upload<{ path?: string; url?: string; secure_url?: string }>("/media/upload", body);
      const url = result.secure_url || result.url || result.path || "";
      if (!validHttpUrl(url)) throw new Error(t("The upload did not return a valid logo URL."));
      onChange(url); setFailed("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Logo upload failed. Try again.")); }
    finally { lock.current = false; setUploading(false); onUploading(false); if (file.current) file.current.value = ""; }
  }
  return <section className="branding-setting"><div className="branding-setting-heading"><div><h4>{t("App & receipt logo")}</h4><p>{t("Used in the sidebar and sale receipts. Save settings to apply the logo.")}</p></div></div>
    <div className="branding-logo-preview">{validHttpUrl(value) && failed !== value ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt={t("Logo preview")} referrerPolicy="no-referrer" onError={() => setFailed(value)}/> : <ImagePlus size={30}/>}</div>
    <label>{t("Logo URL")}<input type="url" aria-label={t("Logo URL")} value={value} disabled={disabled || uploading} placeholder="https://example.com/logo.png" onChange={event => { onChange(event.target.value); setError(""); }}/></label>
    <div className="branding-logo-actions">{hasPermission("media:create") && <><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("Upload logo file")} hidden onChange={event => void upload(event.target.files?.[0])}/><button type="button" disabled={disabled || uploading} onClick={() => file.current?.click()}><Upload size={15}/>{t(uploading ? "Uploading…" : "Upload logo")}</button></>}
    <button type="button" disabled={disabled || uploading || !value} onClick={() => onChange("")}>{t("Remove logo")}</button><small>{t("PNG, JPG or WebP · up to 2 MB")}</small></div>
    {failed === value && value && <p role="status">{t("The logo could not be loaded. Check its URL before saving.")}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
