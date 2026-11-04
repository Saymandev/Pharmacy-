"use client";
import { Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { sellableStocks } from "./stock-selection";
import type { Medicine } from "./pos-types";

export function CatalogTable({ medicines, branchId, selected, canAdd, onAdd, money }: {
  medicines: Medicine[]; branchId: string; selected: number; canAdd: boolean;
  onAdd: (medicine: Medicine, keyboard: boolean) => void; money: (amount: number) => string;
}) {
  const { t, language } = useLanguage();
  return <div className="pos-table-scroll"><table className="pos-catalog-table"><thead><tr>{["Medicine", "Generic", "Batch / expiry", "Stock", "Sale price", "Actions"].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{medicines.map((medicine, index) => {
    const stocks = sellableStocks(medicine.stocks ?? [], branchId), first = stocks[0];
    const available = stocks.reduce((sum, row) => sum + row.quantity, 0);
    const name = language === "bn" ? medicine.nameBangla || medicine.name : medicine.name;
    return <tr key={medicine.id} data-pos-result={index} data-keyboard-active={selected === index ? "true" : undefined}>
      <td><button type="button" className="pos-table-name" disabled={!canAdd || available <= 0} onClick={event => onAdd(medicine, event.detail === 0)}><strong>{name}</strong><small>{[medicine.strength, medicine.dosageForm].filter(Boolean).join(" · ")}</small></button></td>
      <td>{medicine.genericName || "—"}</td><td><strong>{first?.batchNumber || "—"}</strong><small>{first ? new Date(first.expiryDate).toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB") : "—"}</small></td>
      <td><span className={available ? "pos-table-stock" : "pos-table-stock empty"}>{available} {medicine.unit || t("pcs")}</span></td>
      <td className="pos-table-price">{money(Number(medicine.salePrice) || Number(first?.mrp) || Number(medicine.mrp) || 0)}</td>
      <td><button type="button" className="pos-table-add" disabled={!canAdd || available <= 0} aria-label={`${t("Add")} ${name}`} onClick={event => onAdd(medicine, event.detail === 0)}><Plus size={16}/>{t("Add")}</button></td>
    </tr>;
  })}</tbody></table></div>;
}
