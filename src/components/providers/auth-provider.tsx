"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClientError } from "@/lib/api/client";
import { getCurrentUser, signIn } from "@/features/auth/auth-service";
import type { CurrentUser } from "@/types/api";

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
  status: AuthStatus;
  user: CurrentUser | null;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      const timer = window.setTimeout(() => {
        if (isCurrent) { setUser(demoUser); setStatus("authenticated"); }
      }, 0);
      return () => { isCurrent = false; window.clearTimeout(timer); };
    }

    getCurrentUser()
      .then((currentUser) => {
        if (!isCurrent) return;
        setUser(currentUser);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!isCurrent) return;
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    await signIn(usernameOrEmail, password);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        throw new ApiClientError("Your session could not be started. Please sign in again.", 401);
      }
      throw error;
    }

    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    void fetch("/api/session/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
    setStatus("anonymous");
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      const permissions = user?.role?.permissions ?? [];
      return permissions.some((item) => item.key === "*" || item.key === permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ status, user, login, logout, hasPermission }),
    [status, user, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

