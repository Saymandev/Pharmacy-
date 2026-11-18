"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiClientError } from "@/lib/api/client";
import { getCurrentUser, signIn } from "@/features/auth/auth-service";
import type { CurrentUser } from "@/types/api";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { logoutEndpoint } from "@/lib/auth/workspace-entry";
import { SessionSkeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n/language-provider";

const demoUser: CurrentUser = {
  id: "user-demo-manager",
  username: "demo.manager",
  email: "manager@pharmacy.demo",
  fullName: "Ayesha Rahman",
  fullNameBangla: null,
  phone: "+880 1712-345678",
  isActive: true,
  role: { id: "role-demo-admin", name: "Demo Manager", description: "Local demo access", permissions: [{ key: "*", module: "all", action: "all", description: "Demo only" }] },
  employee: null,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

type AuthStatus = "checking" | "authenticated" | "anonymous";

interface AuthContextValue {
  saasMode: boolean;
  status: AuthStatus;
  user: CurrentUser | null;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_EVENT = "pharmacy.session-event";
function announceSessionChange() {
  try { window.localStorage.setItem(SESSION_EVENT, crypto.randomUUID()); } catch { /* Same-tab boundary still works without storage. */ }
}

export function AuthProvider({ children, saasMode=false }: { children: ReactNode; saasMode?: boolean }) {
  const {t}=useLanguage();
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const authRevision = useRef(0);
  const logoutRequest = useRef<Promise<void>>(Promise.resolve());
  const logoutInFlight = useRef(false);
  const [signingOut,setSigningOut]=useState(false);
  const [logoutError,setLogoutError]=useState("");

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || event.key !== SESSION_EVENT) return;
      authRevision.current++;
      sessionBoundary.reset();
      setUser(null);
      setStatus("checking");
      setSessionVersion(value => value + 1);
      // Cookies are shared by tabs. Never keep a workspace under the old actor.
      window.location.reload();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const revision = authRevision.current;

    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      const timer = window.setTimeout(() => {
        if (isCurrent && revision === authRevision.current) { setUser(demoUser); setStatus("authenticated"); }
      }, 0);
      return () => { isCurrent = false; window.clearTimeout(timer); };
    }

    getCurrentUser()
      .then((currentUser) => {
        if (!isCurrent || revision !== authRevision.current) return;
        setUser(currentUser);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!isCurrent || revision !== authRevision.current) return;
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const revision = ++authRevision.current;
    sessionBoundary.reset();
    setUser(null);
    setStatus("anonymous");
    // A previous logout response must not clear cookies from this new login.
    await logoutRequest.current;
    if (revision !== authRevision.current) return;
    await signIn(usernameOrEmail, password);
    if (revision !== authRevision.current) return;
    try {
      const currentUser = await getCurrentUser();
      if (revision !== authRevision.current) return;
      setUser(currentUser);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        throw new ApiClientError("Your session could not be started. Please sign in again.", 401);
      }
      throw error;
    }

    setSessionVersion(value => value + 1);
    setStatus("authenticated");
    announceSessionChange();
  }, []);

  const logout = useCallback(() => {
    if(logoutInFlight.current)return;
    logoutInFlight.current=true;
    const revision=++authRevision.current;
    sessionBoundary.reset();
    setSessionVersion(value => value + 1);
    setSigningOut(true);setLogoutError("");
    logoutRequest.current = logoutRequest.current.catch(()=>{}).then(async () => {
      const response = await fetch(logoutEndpoint(saasMode?'true':'false'), { method: "POST", credentials: "same-origin", signal:AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Sign out could not be confirmed. Retry sign out.");
      announceSessionChange();
      if(revision!==authRevision.current)return;
      setUser(null);setStatus("anonymous");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Reload after cookie deletion to discard the previous actor's router and component state.
      window.location.assign("/login");
    });
    // A failed request preserves the actor and can be retried without latching
    // its rejected promise into every later logout/login attempt.
    void logoutRequest.current.catch(() => {setLogoutError("Sign out could not be confirmed. Retry sign out.");}).finally(()=>{logoutInFlight.current=false;setSigningOut(false);});
  }, [saasMode]);

  const hasPermission = useCallback(
    (permission: string) => {
      const permissions = user?.role?.permissions ?? [];
      return permissions.some((item) => item.key === "*" || item.key === permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, login, logout, hasPermission, saasMode }),
    [status, user, login, logout, hasPermission, saasMode],
  );

  return <AuthContext.Provider value={value}>
    {logoutError&&<div className="session-logout-error" role="alert"><span>{t(logoutError)}</span><button type="button" onClick={logout}>{t('Retry sign out')}</button></div>}
    {signingOut?<SessionSkeleton>{t('Signing out…')}</SessionSkeleton>:<SessionContents key={sessionVersion}>{children}</SessionContents>}
  </AuthContext.Provider>;
}

function SessionContents({ children }: { children: ReactNode }) { return children; }

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
