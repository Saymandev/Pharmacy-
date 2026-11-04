"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ArrowLeft, ArrowRight, Check, CircleAlert, LockKeyhole, Pill, ShieldCheck, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

type SetupStatus = { isSetupComplete: boolean };
type SetupForm = {
  hospital: { name: string; nameBangla: string; address: string; phone: string; email: string; website: string; logoUrl: string; licenseNumber: string; taxRegistration: string };
  admin: { username: string; email: string; password: string; fullName: string; fullNameBangla: string };
  settings: { currency: string; currencySymbol: string; timezone: string; vatPercentage: number; lowStockThreshold: number; taxName: string; taxPercentage: number; isTaxInclusive: boolean; taxRegistrationNumber: string };
};

const initialForm: SetupForm = {
  hospital: { name: "", nameBangla: "", address: "", phone: "", email: "", website: "", logoUrl: "", licenseNumber: "", taxRegistration: "" },
  admin: { username: "", email: "", password: "", fullName: "", fullNameBangla: "" },
  settings: { currency: "BDT", currencySymbol: "৳", timezone: "Asia/Dhaka", vatPercentage: 5, lowStockThreshold: 10, taxName: "VAT", taxPercentage: 5, isTaxInclusive: true, taxRegistrationNumber: "" },
};

function errorMessage(error: unknown) { return error instanceof ApiClientError ? error.message : "We could not reach the pharmacy server. Try again."; }

export default function SetupPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [status, setStatus] = useState<"loading" | "ready" | "complete" | "failed">("loading");
  const [form, setForm] = useState<SetupForm>(initialForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function checkStatus() {
    setStatus("loading"); setError("");
    try {
      const result = await api.get<SetupStatus>("/setup/status");
      setStatus(result?.isSetupComplete ? "complete" : "ready");
    } catch (cause) { setStatus("failed"); setError(errorMessage(cause)); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void checkStatus(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update<K extends keyof SetupForm>(section: K, key: keyof SetupForm[K], value: string | number | boolean) {
    setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }
  function validateStep() {
    const hospital = form.hospital;
    const admin = form.admin;
    if (step === 0) {
      if (hospital.name.trim().length < 3) return "Pharmacy name must be at least 3 characters.";
      if (hospital.address.trim().length < 5) return "Enter a full address (at least 5 characters).";
      if (hospital.phone.trim().length < 10) return "Enter a phone number with at least 10 characters.";
      if (hospital.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hospital.email)) return "Enter a valid pharmacy email address.";
      for (const [value, label] of [[hospital.website, "Website"], [hospital.logoUrl, "Logo URL"]] as const) {
        if (value && !/^https?:\/\/.+/.test(value)) return t("{label} must be a valid URL starting with http:// or https://.", {label:t(label)});
      }
    }
    if (step === 1) {
      if (admin.username.trim().length < 3) return "Username must be at least 3 characters.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) return "Enter a valid administrator email address.";
      if (admin.fullName.trim().length < 3) return "Administrator name must be at least 3 characters.";
      if (admin.password.length < 8 || !/[a-z]/.test(admin.password) || !/[A-Z]/.test(admin.password) || !/[0-9]/.test(admin.password)) return "Password needs 8 characters with lowercase, uppercase and a number.";
      if (confirmPassword !== admin.password) return "The passwords do not match.";
    }
    return "";
  }
  function nextStep() {
    const issue = validateStep();
    if (issue) { setError(issue); return; }
    setError(""); setStep((current) => Math.min(2, current + 1));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateStep();
    if (issue) { setError(issue); if (step < 2) setStep(step === 0 ? 0 : 1); return; }
    setSaving(true); setError("");
    try {
      const { hospital, admin, settings } = form;
      await api.post<unknown>("/setup", {
        hospital: { ...hospital, name: hospital.name.trim(), address: hospital.address.trim(), phone: hospital.phone.trim() },
        admin: { ...admin, username: admin.username.trim(), email: admin.email.trim(), fullName: admin.fullName.trim() },
        settings,
      });
      setSuccess(true); setStatus("complete");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <main className="setup-page">
    <section className="setup-brand-panel"><a className="brand brand-on-dark" href="/setup"><span className="brand-mark"><Pill size={21} /></span><span className="brand-copy"><strong>Pharmacy</strong><small>CARE · CONTROL · CLARITY</small></span></a><div className="setup-brand-story"><span className="story-kicker"><Sparkles size={14}/> {t("PHARMACY OPERATIONS, SIMPLIFIED")}</span><h1>{t("Set up your")}<br/><span>{t("pharmacy workspace.")}</span></h1><p>{t("A guided first-run setup creates your branch, administrator, access roles, cash account and essential settings.")}</p><div className="story-pills"><span><ShieldCheck size={15}/> {t("Secure administrator account")}</span><span><LockKeyhole size={14}/> {t("One-time setup")}</span></div></div><div className="brand-panel-footer"><span>{t("Ready for your first day")}</span><span>01 / 03</span></div><div className="brand-decoration brand-decoration-one"/><div className="brand-decoration brand-decoration-two"/></section>
    <section className="setup-form-panel"><div className="setup-form-wrap"><label className="language-switcher"><span>{t("Language")}</span><Select aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as "en" | "bn")}><option value="en">English</option><option value="bn">বাংলা</option></Select></label>
      {status === "loading" && <div className="setup-state"><span className="button-spinner"/>{t("Checking setup status…")}</div>}
      {status === "failed" && <div className="setup-state"><CircleAlert size={22}/><h1>{t("Couldn’t check setup")}</h1><p>{t(error)}</p><button className="primary-button" type="button" onClick={() => void checkStatus()}>{t("Try again")}</button></div>}
      {status === "complete" && <div className="setup-state setup-state-complete"><span className="setup-complete-icon"><Check size={23}/></span><p className="eyebrow">{t("WORKSPACE READY")}</p><h1>{success ? t("Setup complete") : t("This pharmacy is already set up")}</h1><p>{success ? t("Your branch, administrator, roles and default finance settings are ready. Sign in with the administrator credentials you just created.") : t("This one-time setup has already been completed. Sign in with your administrator account to continue.")}</p><button className="primary-button" type="button" onClick={() => router.replace("/login")}>{t("Continue to sign in")} <ArrowRight size={16}/></button></div>}
      {status === "ready" && <>
        <p className="eyebrow">{t("FIRST-RUN SETUP")}</p><h1>{t("Create your pharmacy workspace")}</h1><p className="setup-intro">{t("A few details now will prepare the system for your team.")}</p>
        <div className="setup-steps" aria-label={t("Setup progress")}>{["Pharmacy", "Administrator", "Preferences"].map((label, index) => <div key={label} className={`setup-step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}><span>{index < step ? <Check size={13}/> : index + 1}</span><small>{label}</small></div>)}</div>
        <form onSubmit={(event) => void submit(event)} noValidate>
          {step === 0 && <div className="setup-fields"><div className="setup-section-title"><h2>{t("Pharmacy details")}</h2><p>{t("These details identify your primary branch and appear in workspace settings.")}</p></div><label>{t("Pharmacy name")} <span>*</span><input autoFocus value={form.hospital.name} onChange={(event) => update("hospital", "name", event.target.value)} placeholder={t("e.g. Green Cross Pharmacy")}/></label><label>{t("Pharmacy name in Bangla")} <small>{t("Optional")}</small><input value={form.hospital.nameBangla} onChange={(event) => update("hospital", "nameBangla", event.target.value)} placeholder="বাংলায় নাম"/></label><label className="setup-field-wide">{t("Address")} <span>*</span><textarea rows={2} value={form.hospital.address} onChange={(event) => update("hospital", "address", event.target.value)} placeholder={t("Street, area, district")}/></label><div className="setup-field-grid"><label>{t("Phone")} <span>*</span><input type="tel" value={form.hospital.phone} onChange={(event) => update("hospital", "phone", event.target.value)} placeholder="+880 1XXXXXXXXX"/></label><label>{t("Email")} <small>{t("Optional")}</small><input type="email" value={form.hospital.email} onChange={(event) => update("hospital", "email", event.target.value)} placeholder="hello@pharmacy.com"/></label><label>{t("Website")} <small>{t("Optional")}</small><input type="url" value={form.hospital.website} onChange={(event) => update("hospital", "website", event.target.value)} placeholder="https://example.com"/></label><label>Logo URL <small>{t("Optional")}</small><input type="url" value={form.hospital.logoUrl} onChange={(event) => update("hospital", "logoUrl", event.target.value)} placeholder="https://example.com/logo.png"/></label><label>{t("License number")} <small>{t("Optional")}</small><input value={form.hospital.licenseNumber} onChange={(event) => update("hospital", "licenseNumber", event.target.value)} placeholder={t("Pharmacy license")}/></label><label className="setup-field-wide">{t("Tax registration")} <small>{t("Optional")}</small><input value={form.hospital.taxRegistration} onChange={(event) => update("hospital", "taxRegistration", event.target.value)} placeholder={t("Registration number")}/></label></div></div>}
          {step === 1 && <div className="setup-fields"><div className="setup-section-title"><h2>{t("Administrator account")}</h2><p>{t("This account receives the Super Admin role created by the backend setup process.")}</p></div><label>{t("Full name")} <span>*</span><input autoFocus value={form.admin.fullName} onChange={(event) => update("admin", "fullName", event.target.value)} placeholder={t("Administrator name")}/></label><label>{t("Full name in Bangla")} <small>{t("Optional")}</small><input value={form.admin.fullNameBangla} onChange={(event) => update("admin", "fullNameBangla", event.target.value)} placeholder="বাংলায় নাম"/></label><div className="setup-field-grid"><label>{t("Username")} <span>*</span><input autoComplete="username" value={form.admin.username} onChange={(event) => update("admin", "username", event.target.value)} placeholder={t("pharmacy.admin")}/></label><label>{t("Email")} <span>*</span><input autoComplete="email" type="email" value={form.admin.email} onChange={(event) => update("admin", "email", event.target.value)} placeholder="admin@example.com"/></label><label>{t("Password")} <span>*</span><input autoComplete="new-password" type="password" value={form.admin.password} onChange={(event) => update("admin", "password", event.target.value)} placeholder={t("At least 8 characters")}/><small>{t("Uppercase, lowercase and number required")}</small></label><label>{t("Confirm password")} <span>*</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t("Enter password again")}/></label></div></div>}
          {step === 2 && <div className="setup-fields"><div className="setup-section-title"><h2>{t("Regional and tax preferences")}</h2><p>{t("Start with sensible Bangladesh defaults. These can be adjusted in settings later.")}</p></div><div className="setup-field-grid"><label>{t("Currency code")}<input value={form.settings.currency} onChange={(event) => update("settings", "currency", event.target.value.toUpperCase())}/></label><label>{t("Currency symbol")}<input value={form.settings.currencySymbol} onChange={(event) => update("settings", "currencySymbol", event.target.value)}/></label><label>{t("Timezone")}<select value={form.settings.timezone} onChange={(event) => update("settings", "timezone", event.target.value)}><option value="Asia/Dhaka">Asia/Dhaka (Bangladesh)</option><option value="Asia/Kolkata">Asia/Kolkata (India)</option><option value="UTC">UTC</option></select></label><label>{t("Low stock alert threshold")}<input type="number" min="0" value={form.settings.lowStockThreshold} onChange={(event) => update("settings", "lowStockThreshold", Number(event.target.value))}/></label><label>{t("VAT percentage")}<input type="number" min="0" max="100" step="0.01" value={form.settings.vatPercentage} onChange={(event) => update("settings", "vatPercentage", Number(event.target.value))}/></label><label>{t("Tax name")}<input value={form.settings.taxName} onChange={(event) => update("settings", "taxName", event.target.value)}/></label><label>{t("Tax percentage")}<input type="number" min="0" max="100" step="0.01" value={form.settings.taxPercentage} onChange={(event) => update("settings", "taxPercentage", Number(event.target.value))}/></label><label>{t("Tax registration number")} <small>{t("Optional")}</small><input value={form.settings.taxRegistrationNumber} onChange={(event) => update("settings", "taxRegistrationNumber", event.target.value)}/></label></div><label className="setup-check-field"><input type="checkbox" checked={form.settings.isTaxInclusive} onChange={(event) => update("settings", "isTaxInclusive", event.target.checked)}/><span><strong>{t("Prices include tax")}</strong><small>{t("Checkout prices already contain the configured tax percentage.")}</small></span></label></div>}
          {error && <div className="setup-error" role="alert"><CircleAlert size={16}/>{t(error)}</div>}
          <div className="setup-actions">{step > 0 && <button type="button" className="setup-back" onClick={() => { setStep((current) => current - 1); setError(""); }}><ArrowLeft size={15}/> {t("Back")}</button>}{step < 2 ? <button type="button" className="primary-button" onClick={nextStep}>{t("Continue")} <ArrowRight size={15}/></button> : <button type="submit" className="primary-button" disabled={saving}>{saving ? <><span className="button-spinner"/> {t("Creating workspace…")}</> : <>{t("Complete setup")} <Check size={15}/></>}</button>}</div>
        </form><p className="setup-security"><LockKeyhole size={13}/> {t("The setup can only be completed once. Your password is sent securely to the backend.")}</p>
      </>}
    </div><div className="setup-footer"><span>{t("Pharmacy POS")}</span><span>{t("One-time workspace setup")}</span></div></section>
  </main>;
}
