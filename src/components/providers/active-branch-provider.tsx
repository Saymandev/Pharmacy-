"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api/client";

export type PharmacyBranch = { id: string; name: string; address?: string; phone?: string; email?: string };
type ActiveBranchValue = {
  branches: PharmacyBranch[];
  activeBranchId: string;
  activeBranch: PharmacyBranch | null;
  branchesLoading: boolean;
  setActiveBranchId: (id: string) => void;
  refreshBranches: () => Promise<void>;
};

const ActiveBranchContext = createContext<ActiveBranchValue | null>(null);

function unwrapBranches(value: unknown): PharmacyBranch[] {
  if (Array.isArray(value)) return value as PharmacyBranch[];
  if (!value || typeof value !== "object") return [];
  const payload = value as Record<string, unknown>;
  if ("data" in payload) return unwrapBranches(payload.data);
  if ("branches" in payload) return unwrapBranches(payload.branches);
  return [];
}

function readSavedBranch(key:string){try{return typeof window==="undefined"?"":window.localStorage.getItem(key)??"";}catch{return "";}}
function persistBranch(key:string,id:string){try{if(id)window.localStorage.setItem(key,id);else window.localStorage.removeItem(key);}catch{/* Branch selection remains usable for the current session. */}}

export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const storageKey = `pharmacy.active-branch:user:${user?.id ?? "anonymous"}`;
  const request = useRef(0);
  const invalidateRequests = useCallback(() => { request.current++; }, []);
  const [branches, setBranches] = useState<PharmacyBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    const revision = ++request.current;
    setBranchesLoading(true);
    try {
      const nextBranches = unwrapBranches(await api.get<unknown>("/branches?page=1&limit=100"));
      if (revision !== request.current) return;
      setBranches(nextBranches);
      setActiveBranchIdState((current) => {
        const saved = readSavedBranch(storageKey);
        const next = nextBranches.some((branch) => branch.id === current)
          ? current
          : nextBranches.some((branch) => branch.id === saved)
            ? saved!
            : nextBranches[0]?.id ?? "";
        persistBranch(storageKey,next);
        return next;
      });
    } catch {
      if (revision !== request.current) return;
      setBranches([]);
      setActiveBranchIdState("");
    } finally {
      if (revision === request.current) setBranchesLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    queueMicrotask(() => { if (active) void refreshBranches(); });
    return () => { active = false; invalidateRequests(); };
  }, [refreshBranches, status, invalidateRequests]);

  // localStorage is shared across tabs, but React state is not.
  useEffect(() => {
    if (status !== "authenticated" || branchesLoading) return;
    function syncSavedBranch() {
      const saved = readSavedBranch(storageKey);
      // An unknown/removed selection must stop branch-scoped work, never silently
      // redirect a cashier to the first branch returned by the server.
      setActiveBranchIdState(branches.some(branch => branch.id === saved) ? saved : "");
    }
    function onStorage(event: StorageEvent) {
      if (event.storageArea === window.localStorage && (event.key === storageKey || event.key === null)) syncSavedBranch();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncSavedBranch);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncSavedBranch);
    };
  }, [branches, branchesLoading, status, storageKey]);

  const setActiveBranchId = useCallback((id: string) => {
    if (!branches.some(branch => branch.id === id)) return;
    setActiveBranchIdState(id);
    persistBranch(storageKey,id);
  }, [branches, storageKey]);

  const value = useMemo(() => ({
    branches,
    activeBranchId,
    activeBranch: branches.find((branch) => branch.id === activeBranchId) ?? null,
    branchesLoading,
    setActiveBranchId,
    refreshBranches,
  }), [activeBranchId, branches, branchesLoading, refreshBranches, setActiveBranchId]);

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>;
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext);
  if (!context) throw new Error("useActiveBranch must be used inside ActiveBranchProvider");
  return context;
}
