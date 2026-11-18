"use client";
import { SessionSkeleton } from "@/components/ui/skeleton";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Pill, ShieldCheck, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { workspaceEntry } from "@/lib/auth/workspace-entry";

export default function LoginPage() {
  const router = useRouter();
  const { status, login } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupChecking, setSetupChecking] = useState(true);

  useEffect(() => {
    if (status === "authenticated") router.replace(workspaceEntry());
  }, [status, router]);

  useEffect(() => {
    if (status !== "anonymous") return;
    let active = true;
    void api.get<{ isSetupComplete: boolean }>("/setup/status")
      .then((result) => { if (active && !result.isSetupComplete) router.replace("/setup"); })
      .catch(() => { /* Keep sign-in available when setup status is temporarily unreachable. */ })
      .finally(() => { if (active) setSetupChecking(false); });
    return () => { active = false; };
  }, [status, router]);

  if (status === "checking" || (status === "anonymous" && setupChecking)) {
    return <SessionSkeleton>{t("Checking your session…")}</SessionSkeleton>;
  }

  if (status === "authenticated") {
    return <SessionSkeleton>{t("Opening your workspace…")}</SessionSkeleton>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(usernameOrEmail.trim(), password);
      router.replace(workspaceEntry());
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t("We couldn’t sign you in. Please try again."));
      setSubmitting(false);
    }
  }

  if (submitting) return <SessionSkeleton>{t("Signing in…")}</SessionSkeleton>;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <a className="brand brand-on-dark" href="/login">
          <span className="brand-mark"><Pill size={21} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Pharmacy</strong><small>CARE · CONTROL · CLARITY</small></span>
        </a>
        <div className="brand-story">
          <span className="story-kicker"><Sparkles size={14} /> {t("PHARMACY OPERATIONS, SIMPLIFIED")}</span>
          <h1>{t("More care.")}<br /><span>{t("Less complexity.")}</span></h1>
          <p>{t("A calm, clear workspace for the people who keep your pharmacy moving.")}</p>
          <div className="story-pills"><span><ShieldCheck size={15} /> {t("Role-based access")}</span><span><LockKeyhole size={15} /> {t("Secure sign-in")}</span></div>
        </div>
        <div className="brand-panel-footer"><span>{t("Built for everyday pharmacy work")}</span><span>01 / 01</span></div>
        <div className="brand-decoration brand-decoration-one" /><div className="brand-decoration brand-decoration-two" />
      </section>

      <section className="login-form-panel">
        <div className="language-switcher login-language-switcher"><select aria-label={t("Language")} value={language} onChange={(event) => setLanguage(event.target.value as "en" | "bn")}><option value="en">English</option><option value="bn">বাংলা</option></select></div>
        <div className="login-form-wrap">
          <span className="mobile-brand-mark"><Pill size={20} /></span>
          <p className="eyebrow">{t("WELCOME BACK")}</p>
          <h2>{t("Sign in to your workspace")}</h2>
          <p className="login-intro">{t("Use the username or email provided by your administrator.")}</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="usernameOrEmail">{t("Username or email")}</label>
            <input
              autoComplete="username"
              id="usernameOrEmail"
              name="usernameOrEmail"
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              placeholder={t("e.g. pharmacy.admin")}
              required
              value={usernameOrEmail}
            />
            <div className="password-label-row"><label htmlFor="password">{t("Password")}</label><span>{t("Contact your administrator if you need help")}</span></div>
            <div className="password-field">
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("Enter your password")}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button aria-label={t(showPassword ? "Hide password" : "Show password")} className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && <div className="form-error" role="alert">{t(error)}</div>}
            <button className="primary-button login-submit" disabled={submitting || setupChecking} type="submit">
              {submitting ? <><span className="button-spinner" /> {t("Signing in…")}</> : <>{t("Sign in")} <span aria-hidden="true">→</span></>}
            </button>
          </form>
          <div className="login-security"><LockKeyhole size={14} /><span>{t("Your sign-in is protected by your pharmacy’s access controls.")}</span></div>
        </div>
        <div className="login-footer"><span>{t("Pharmacy POS")}</span><span>{t("Need access? Contact your system administrator.")}</span></div>
      </section>
    </main>
  );
}
