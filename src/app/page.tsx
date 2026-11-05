"use client";
import { SessionSkeleton } from "@/components/ui/skeleton";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";


export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "checking") return;
    router.replace(status === "authenticated" ? "/dashboard" : "/login");
  }, [status, router]);

  return <SessionSkeleton>{t("Preparing your workspace…")}</SessionSkeleton>;
}
