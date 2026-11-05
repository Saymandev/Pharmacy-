"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";

type Branding = { name: string; logoUrl: string; address?: string; phone?: string; email?: string };
const empty: Branding = { name: "", logoUrl: "" };
const BrandingContext = createContext({ branding: empty, refreshBranding: async () => {} });
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(empty);
  const request = useRef(0);
  const refreshBranding = useCallback(async () => {
    const id = ++request.current;
    try {
      const value = await api.get<Branding>("/settings/branding/receipt");
      if (id === request.current && value && !Array.isArray(value)) setBranding({ ...value, name: typeof value.name === "string" ? value.name : "", logoUrl: typeof value.logoUrl === "string" && /^https?:\/\//.test(value.logoUrl) ? value.logoUrl : "" });
    } catch { /* Older deployments keep the existing pharmacy icon until the branding endpoint is deployed. */ }
  }, []);
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { const timer = setTimeout(() => { void refreshBranding(); }, 0); return () => { clearTimeout(timer); invalidate(); }; }, [refreshBranding, invalidate]);
  return <BrandingContext.Provider value={{ branding, refreshBranding }}>{children}</BrandingContext.Provider>;
}
export const useBranding = () => useContext(BrandingContext);
export function BrandLogo({ className = "", children }: { className?: string; children?: ReactNode }) {
  const { branding } = useBranding();
  const [failed, setFailed] = useState("");
  if (!branding.logoUrl || failed === branding.logoUrl) return <>{children}</>;
  // Admin-managed image URLs can come from the existing media service or another image host.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={branding.logoUrl} alt={branding.name || "Pharmacy"} referrerPolicy="no-referrer" onError={() => setFailed(branding.logoUrl)}/>;
}
