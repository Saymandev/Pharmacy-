"use client";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sellableStocks } from "./stock-selection";
import type { Medicine } from "./pos-types";

export function CatalogList({ medicines, branchId, selected, canAdd, onAdd, money }: {
  medicines: Medicine[]; branchId: string; selected: number; canAdd: boolean;
  onAdd: (medicine: Medicine, keyboard: boolean) => void; money: (amount: number) => string;
}) {
  const { t, language } = useLanguage();
  return <ul className="pos-catalog-list" aria-label={t("Medicine list")}>{medicines.map((medicine, index) => {
    const stocks = sellableStocks(medicine.stocks ?? [], branchId), first = stocks[0];
    const available = stocks.reduce((sum, row) => sum + row.quantity, 0);
    const name = language === "bn" ? medicine.nameBangla || medicine.name : medicine.name;
    const details = [medicine.strength, medicine.genericName || medicine.dosageForm, first?.batchNumber,
      first ? new Date(first.expiryDate).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB") : ""].filter(Boolean).join(" · ");
    return <li key={medicine.id}><button type="button" className="pos-catalog-list-row" data-pos-result={index}
      data-keyboard-active={selected === index ? "true" : undefined} aria-label={`${t("Add")} ${name}`}
      title={`${name}${details ? ` · ${details}` : ""}`} disabled={!canAdd || available <= 0} onClick={event => onAdd(medicine, event.detail === 0)}>
      <span className="pos-list-identity"><strong>{name}</strong><small>{details || t("Pharmacy medicine")}</small></span>
      <span className="pos-list-stock">{available} {medicine.unit || t("pcs")}</span>
      <strong className="pos-list-price">{money(Number(medicine.salePrice) || Number(first?.mrp) || Number(medicine.mrp) || 0)}</strong>
    </button></li>;
  })}</ul>;
}
