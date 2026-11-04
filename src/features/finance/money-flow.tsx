"use client";

import { ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

export function MoneyFlow({ flow }: { flow: string }) {
  const { t } = useLanguage();
  const direction = flow === "in" || flow === "out" ? flow : "unknown";
  const Icon = direction === "in" ? ArrowDownLeft : direction === "out" ? ArrowUpRight : Minus;
  return <span className="finance-flow-badge" data-flow={direction}><Icon size={15} aria-hidden="true"/>{t(direction === "in" ? "Money in" : direction === "out" ? "Money out" : "Unknown direction")}</span>;
}
