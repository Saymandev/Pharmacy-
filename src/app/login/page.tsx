"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Pill, ShieldCheck, Sparkles } from "lucide-react";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { status, login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "checking") {
    return <main className="auth-loading"><span className="loading-mark"><Pill size={19} /></span><span>Checking your session…</span></main>;
  }

  if (status === "authenticated") {
    return <main className="auth-loading"><span className="loading-mark"><Pill size={19} /></span><span>Opening your workspace…</span></main>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(usernameOrEmail.trim(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "We couldn’t sign you in. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <a className="brand brand-on-dark" href="/login">
          <span className="brand-mark"><Pill size={21} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>Pharmacy</strong><small>CARE · CONTROL · CLARITY</small></span>
        </a>
        <div className="brand-story">
          <span className="story-kicker"><Sparkles size={14} /> PHARMACY OPERATIONS, SIMPLIFIED</span>
          <h1>More care.<br /><span>Less complexity.</span></h1>
          <p>A calm, clear workspace for the people who keep your pharmacy moving.</p>
          <div className="story-pills"><span><ShieldCheck size={15} /> Role-based access</span><span><LockKeyhole size={15} /> Secure sign-in</span></div>
        </div>
        <div className="brand-panel-footer"><span>Built for everyday pharmacy work</span><span>01 / 01</span></div>
        <div className="brand-decoration brand-decoration-one" /><div className="brand-decoration brand-decoration-two" />
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <span className="mobile-brand-mark"><Pill size={20} /></span>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace</h2>
          <p className="login-intro">Use the username or email provided by your administrator.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="usernameOrEmail">Username or email</label>
            <input
              autoComplete="username"
              id="usernameOrEmail"
              name="usernameOrEmail"
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              placeholder="e.g. pharmacy.admin"
              required
              value={usernameOrEmail}
            />
            <div className="password-label-row"><label htmlFor="password">Password</label><span>Contact your administrator if you need help</span></div>
            <div className="password-field">
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button aria-label={showPassword ? "Hide password" : "Show password"} className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button login-submit" disabled={submitting} type="submit">
              {submitting ? <><span className="button-spinner" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
            </button>
          </form>
          <div className="login-security"><LockKeyhole size={14} /><span>Your sign-in is protected by your pharmacy’s access controls.</span></div>
        </div>
        <div className="login-footer"><span>Pharmacy POS</span><span>Need access? Contact your system administrator.</span></div>
      </section>
    </main>
  );
}
