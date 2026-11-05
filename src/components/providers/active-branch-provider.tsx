"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

function readSavedBranch(){try{return typeof window==="undefined"?"":window.localStorage.getItem("pharmacy.active-branch")??"";}catch{return "";}}
function persistBranch(id:string){try{if(id)window.localStorage.setItem("pharmacy.active-branch",id);else window.localStorage.removeItem("pharmacy.active-branch");}catch{/* Branch selection remains usable for the current session. */}}

export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [branches, setBranches] = useState<PharmacyBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState(readSavedBranch);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    try {
      const nextBranches = unwrapBranches(await api.get<unknown>("/branches?page=1&limit=100"));
      setBranches(nextBranches);
      setActiveBranchIdState((current) => {
        const saved = readSavedBranch();
        const next = nextBranches.some((branch) => branch.id === current)
          ? current
          : nextBranches.some((branch) => branch.id === saved)
            ? saved!
            : nextBranches[0]?.id ?? "";
        persistBranch(next);
        return next;
      });
    } catch {
      setBranches([]);
      setActiveBranchIdState("");
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    queueMicrotask(() => { if (active) void refreshBranches(); });
    return () => { active = false; };
  }, [refreshBranches, status]);

  // localStorage is shared across tabs, but React state is not.
  useEffect(() => {
    if (status !== "authenticated" || branchesLoading) return;
    function syncSavedBranch() {
      const saved = readSavedBranch();
      // An unknown/removed selection must stop branch-scoped work, never silently
      // redirect a cashier to the first branch returned by the server.
      setActiveBranchIdState(branches.some(branch => branch.id === saved) ? saved : "");
    }
    function onStorage(event: StorageEvent) {
      if (event.storageArea === window.localStorage && (event.key === "pharmacy.active-branch" || event.key === null)) syncSavedBranch();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncSavedBranch);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncSavedBranch);
    };
  }, [branches, branchesLoading, status]);

  const setActiveBranchId = useCallback((id: string) => {
    if (!branches.some(branch => branch.id === id)) return;
    setActiveBranchIdState(id);
    persistBranch(id);
  }, [branches]);

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
