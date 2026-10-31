"use client";

import { useLanguage } from "@/lib/i18n/language-provider";

type Money = number | string;
type ReceiptSale = {
  id: string; invoiceNumber: string; status: string; createdAt: string; createdBy?: string;
  branch?: { name: string }; customer?: { name: string; phone?: string };
  totalPrice: Money; netPrice: Money; paidAmount: Money; dueAmount: Money; discountAmount: Money; taxAmount: Money;
  saleItems: { id: string; itemName: string; unit: string; price: Money; quantity: Money; totalPrice?: Money; discountAmount?: Money; batchNumber?: string | null }[];
};

/** Reprints persisted sales only; cash tender/change is not stored by this backend. */
export function SaleReceipt({ sale, onClose }: { sale: ReceiptSale; onClose: () => void }) {
  const { t, language } = useLanguage();
  const locale = language === "bn" ? "bn-BD" : "en-BD";
  const money = (value: Money) => new Intl.NumberFormat(locale, { style: "currency", currency: "BDT" }).format(Number(value) || 0);
  return <div className="pos-receipt-backdrop"><section className="pos-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-reprint-title">
    <div className="pos-receipt-actions"><button className="pos-dialog-cancel" onClick={onClose}>{t("Close")}</button><button className="pos-complete-button" onClick={() => window.print()}>{t("Print receipt")}</button></div>
    <div className="pos-receipt-paper"><header><h2 id="sale-reprint-title">{t("Receipt reprint")}</h2><strong>{sale.branch?.name ?? t("Pharmacy")}</strong><small>{sale.invoiceNumber || sale.id}</small><small>{new Date(sale.createdAt).toLocaleString(locale, { timeZone: "Asia/Dhaka" })}</small></header>
      <div className="pos-receipt-customer"><strong>{sale.customer?.name ?? t("Customer")}</strong><span>{sale.customer?.phone}</span><span>{t("Status")}: {t(sale.status)}</span></div>
      {sale.saleItems?.map((item) => <div className="pos-receipt-item" key={item.id}><span><strong>{item.itemName}</strong><small>{Number(item.quantity)} {item.unit} × {money(item.price)} · {t("Batch")} {item.batchNumber || "—"}</small></span><strong>{money(item.totalPrice ?? Number(item.price) * Number(item.quantity) - Number(item.discountAmount ?? 0))}</strong></div>)}
      <div className="pos-receipt-totals"><span>{t("Subtotal")}<strong>{money(sale.totalPrice)}</strong></span><span>{t("Item discount")}<strong>−{money(sale.saleItems.reduce((sum, item) => sum + Number(item.discountAmount ?? 0), 0))}</strong></span><span>{t("Sale discount")}<strong>−{money(sale.discountAmount)}</strong></span><span>{t("Tax")}<strong>{money(sale.taxAmount)}</strong></span><span className="pos-receipt-grand">{t("Total")}<strong>{money(sale.netPrice)}</strong></span><span>{t("Paid")}<strong>{money(sale.paidAmount)}</strong></span><span>{t("Due")}<strong>{money(sale.dueAmount)}</strong></span></div>
      <footer>{t("Receipt reprint")} · {sale.createdBy || ""}</footer>
    </div>
  </section></div>;
}
