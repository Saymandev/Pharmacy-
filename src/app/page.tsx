"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Pill } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "checking") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/login");
  }, [status, router]);

  return <main className="auth-loading"><span className="loading-mark"><Pill size={19} /></span><span>{t("Preparing your workspace…")}</span></main>;
}
