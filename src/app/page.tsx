"use client";
import { SessionSkeleton } from "@/components/ui/skeleton";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { workspaceEntry } from "@/lib/auth/workspace-entry";


export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { status, saasMode } = useAuth();

  useEffect(() => {
    if (status === "checking") return;
    router.replace(status === "authenticated" ? workspaceEntry(saasMode?'true':'false') : "/login");
  }, [status, router, saasMode]);

  return <SessionSkeleton>{t("Preparing your workspace…")}</SessionSkeleton>;
}
