"use client";
import { SessionSkeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n/language-provider";
export default function Loading(){const {t}=useLanguage();return <SessionSkeleton>{t("Opening your workspace…")}</SessionSkeleton>;}
