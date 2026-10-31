"use client";
import { useLanguage } from "@/lib/i18n/language-provider";
export function PageControls({ page, totalPages, total, hasNextPage, busy, onPage }: {
  page: number; totalPages: number; total: number; hasNextPage: boolean; busy: boolean; onPage: (page: number) => void;
}) {
  const { t } = useLanguage();
  return <nav className="sales-pagination" aria-label={t("Pagination")}><span>{t("Total")}: {total}</span><div>
    <button type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>{t("Previous")}</button>
    <span>{t("Page")} {page} / {totalPages}</span>
    <button type="button" disabled={busy || !hasNextPage} onClick={() => onPage(page + 1)}>{t("Next")}</button>
  </div></nav>;
}
