"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Barcode, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, Filter, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

type Row = Record<string, unknown>;
type Branch = { id: string; name: string };
type Stock = { id: string; branchId: string; batchNumber: string; expiryDate: string; quantity: number; mrp: number; unit: string };
type Medicine = { id: string; name: string; nameBangla?: string; genericName?: string; dosageForm?: string; strength?: string; unit?: string; salePrice?: number; mrp?: number; barcode?: string; category?: { id: string; name: string }; medicineManufacturer?: { name: string }; stocks?: Stock[] };
type Customer = { id: string; name: string; phone: string; balance?: number; customerNumber?: string };
type Account = { id: string; name: string; type: string; currentBalance?: number };
type CartLine = { medicine: Medicine; stock: Stock; quantity: number; price: number; discountPercent: number };
type FilterOption = { id: string; name: string };
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;

function rows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Row;
    if ("data" in record) return rows<T>(record.data);
    for (const key of ["branches", "customers", "medicines", "accounts", "categories", "generics", "manufacturers", "units", "groups"]) {
      if (key in record) return rows<T>(record[key]);
    }
  }
  return [];
}
function money(value: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function getError(error: unknown) { return error instanceof ApiClientError ? error.message : "Something went wrong. Please try again."; }

export function PosWorkspace() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [session, setSession] = useState<Row | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [generics, setGenerics] = useState<FilterOption[]>([]);
  const [manufacturers, setManufacturers] = useState<FilterOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [genericId, setGenericId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [formulation, setFormulation] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [paymentMethod, setPaymentMethod] = useState<(typeof methods)[number]>("cash");
  const [accountId, setAccountId] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [paidInput, setPaidInput] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");

  const loadProducts = useCallback(async () => {
    if (!branchId) return;
    const params = new URLSearchParams({ page: "1", limit: "60", branchId, isActive: "true" });
    if (query.trim()) params.set("search", query.trim());
    if (categoryId) params.set("categoryId", categoryId);
    if (genericId) params.set("genericId", genericId);
    if (manufacturerId) params.set("medicineManufacturerId", manufacturerId);
    if (formulation.trim()) params.set("dosageForm", formulation.trim());
    if (inStockOnly) params.set("hasStock", "true");
    try {
      const result = await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`);
      setMedicines(rows<Medicine>(result));
      setError("");
    } catch (cause) { setError(getError(cause)); }
  }, [branchId, categoryId, genericId, manufacturerId, formulation, inStockOnly, query]);

  const loadSession = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const active = await api.get<unknown>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(id)}`);
      setSession(active && typeof active === "object" ? active as Row : null);
    } catch { setSession(null); }
  }, []);

  useEffect(() => {
    let live = true;
    async function init() {
      setLoading(true);
      const [branchResult, catResult, genResult, makerResult, accountResult, settingResult] = await Promise.allSettled([
        api.get<unknown>("/branches?page=1&limit=100"),
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
        api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true"),
        api.get<unknown>("/settings/tax"),
      ]);
      if (!live) return;
      const branchRows = branchResult.status === "fulfilled" ? rows<Branch>(branchResult.value) : [];
      setBranches(branchRows);
      const initialBranch = branchRows[0]?.id ?? "";
      setBranchId(initialBranch);
      if (catResult.status === "fulfilled") setCategories(rows<FilterOption>(catResult.value));
      if (genResult.status === "fulfilled") setGenerics(rows<FilterOption>(genResult.value));
      if (makerResult.status === "fulfilled") setManufacturers(rows<FilterOption>(makerResult.value));
      if (accountResult.status === "fulfilled") {
        const list = rows<Account>(accountResult.value).filter((item) => ["cash", "bank", "mfs"].includes(item.type));
        setAccounts(list);
        setAccountId(list.find((item) => item.type === "cash")?.id ?? list[0]?.id ?? "");
      }
      if (settingResult.status === "fulfilled" && settingResult.value && typeof settingResult.value === "object") {
        const setting = settingResult.value as Row;
        const configs = setting.configs && typeof setting.configs === "object" ? setting.configs as Row : {};
        setTaxRate(Math.min(100, Math.max(0, numeric(configs.taxPercentage))));
      }
      if (branchRows.length === 0) setError("No branch is available for your account. Ask an administrator to assign a branch.");
      setLoading(false);
    }
    void init();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!branchId) return;
    const timer = window.setTimeout(() => { void loadSession(branchId); }, 0);
    return () => window.clearTimeout(timer);
  }, [branchId, loadSession]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (branchId) void loadProducts(); }, 220);
    return () => window.clearTimeout(timer);
  }, [loadProducts, branchId]);
  useEffect(() => {
    if (!customerQuery.trim()) return;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: "1", limit: "8", name: customerQuery.trim() });
        const result = await api.get<unknown>(`/customers?${params.toString()}`);
        setCustomers(rows<Customer>(result));
      } catch { setCustomers([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const itemDiscount = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity * line.discountPercent / 100, 0), [cart]);
  const saleEligible = Math.max(0, subtotal - itemDiscount);
  const actualSaleDiscount = discountMode === "percent" ? Math.min(saleEligible, saleEligible * Math.min(100, Math.max(0, saleDiscount)) / 100) : Math.min(saleEligible, Math.max(0, saleDiscount));
  const taxPercent = taxRate;
  const taxable = Math.max(0, saleEligible - actualSaleDiscount);
  const taxAmount = Math.round(taxable * taxPercent) / 100;
  const total = taxable + taxAmount;
  const paid = paidInput === "" ? total : Math.max(0, numeric(paidInput));
  const due = Math.max(0, total - paid);
  const totalUnits = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addMedicine(medicine: Medicine) {
    const available = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0);
    if (!available.length) { setNotice(`${medicine.name} has no sellable stock in this branch.`); return; }
    const chosen = [...available].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
    setCart((current) => {
      const existing = current.find((line) => line.stock.id === chosen.id);
      if (existing) return current.map((line) => line.stock.id === chosen.id ? { ...line, quantity: Math.min(line.quantity + 1, chosen.quantity) } : line);
      return [...current, { medicine, stock: chosen, quantity: 1, price: numeric(medicine.salePrice) || numeric(chosen.mrp) || numeric(medicine.mrp), discountPercent: 0 }];
    });
    setNotice(available.length > 1 ? `${medicine.name}: earliest-expiry batch selected. Change it in the cart if needed.` : "");
  }
  function changeLine(stockId: string, change: Partial<Pick<CartLine, "quantity" | "price" | "discountPercent">>) {
    setCart((current) => current.map((line) => line.stock.id === stockId ? { ...line, ...change } : line).filter((line) => line.quantity > 0));
  }
  async function openRegister() {
    setError(""); setSaving(true);
    try {
      const created = await api.post<unknown>("/pharmacy/cash-register/open", { branchId, openingBalance: Math.max(0, numeric(openingBalance)) });
      setSession(created as Row); setOpening(false); setNotice("Register opened. You can now complete sales.");
      await loadSession(branchId);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }
  async function submitSale(status: "pending" | "completed") {
    setError(""); setNotice("");
    if (!branchId || cart.length === 0) { setError("Select a branch and add at least one medicine."); return; }
    if (!customer) { setError("Select a customer before saving. This avoids the backend’s unresolved walk-in customer behavior."); return; }
    if (status === "completed" && !session) { setOpening(true); setError("Open the cash register before completing a sale."); return; }
    if (paid > total) { setError("Collected amount cannot exceed the sale total. Change is not supported by this backend flow."); return; }
    if (paid > 0 && !accountId) { setError("Choose an account for this payment."); return; }
    if (cart.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.stock.quantity)) { setError("Each quantity must be a whole number within the selected batch stock."); return; }
    setSaving(true);
    const saleDiscountPercent = saleEligible > 0 ? actualSaleDiscount / saleEligible * 100 : 0;
    const payload = {
      customerId: customer.id, branchId, type: "pos", status,
      paymentMethod, discountPercentage: saleDiscountPercent, discountAmount: actualSaleDiscount,
      taxPercentage: taxPercent, taxAmount, paidAmount: paid, dueAmount: due,
      paymentStatus: due <= 0 ? "paid" : paid > 0 ? "partial" : "due",
      note: session && (session.id || session.sessionId) ? `Register: ${String(session.id ?? session.sessionId)}` : undefined,
      ...(paid > 0 ? { payments: [{ accountId, amount: paid, paymentMethod }] } : {}),
      saleItems: cart.map((line) => ({
        medicineId: line.medicine.id, itemName: line.medicine.name,
        itemDescription: [line.medicine.genericName, line.medicine.strength].filter(Boolean).join(" · ") || undefined,
        unit: line.stock.unit || line.medicine.unit || "Pcs", price: line.price, mrp: numeric(line.stock.mrp) || line.price,
        quantity: line.quantity, batchNumber: line.stock.batchNumber, expiryDate: line.stock.expiryDate,
        discountPercentage: line.discountPercent,
        discountAmount: Math.round(line.price * line.quantity * line.discountPercent) / 100,
      })),
    };
    try {
      const result = await api.post<Row>("/sales", payload);
      const invoice = String(result.invoiceNumber ?? result.id ?? "");
      setCart([]); setCustomer(null); setCustomerQuery(""); setSaleDiscount(0); setPaidInput(""); setCartOpen(false);
      await loadProducts(); await loadSession(branchId);
      setNotice(`${status === "completed" ? "Sale completed" : "Sale saved as pending"}${invoice ? ` · Invoice ${invoice}` : ""}.`);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }

  const cartContent = <>
    <div className="pos-cart-heading"><div><h2>Current sale</h2><p>{totalUnits} item{totalUnits === 1 ? "" : "s"}</p></div><button className="pos-icon-action pos-cart-close" onClick={() => setCartOpen(false)} aria-label="Close cart"><X size={18} /></button></div>
    <div className="pos-cart-controls">
      <div className="pos-customer-wrap">
        {customer ? <div className="pos-selected-customer"><span className="pos-customer-icon"><UserRound size={16} /></span><span><strong>{customer.name}</strong><small>{customer.phone} · Due {money(numeric(customer.balance))}</small></span><button className="pos-icon-action" onClick={() => { setCustomer(null); setCustomerQuery(""); }} aria-label="Remove customer"><X size={15} /></button></div> : <><label className="pos-field-caption" htmlFor="customer-search">Customer <span>required</span></label><div className="pos-input-with-icon"><UserRound size={16} /><input id="customer-search" value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerOpen(true); }} onFocus={() => setCustomerOpen(true)} placeholder="Search name or phone" autoComplete="off" /></div>{customerOpen && customerQuery.trim() && customers.length > 0 && <div className="pos-customer-options">{customers.map((item) => <button key={item.id} type="button" onClick={() => { setCustomer(item); setCustomerQuery(""); setCustomerOpen(false); }}><strong>{item.name}</strong><small>{item.phone} · Balance {money(numeric(item.balance))}</small></button>)}</div>}</>}
      </div>
    </div>
    <div className="pos-cart-lines">
      {cart.length === 0 ? <div className="pos-empty-cart"><span><ShoppingBag size={21} /></span><strong>Your cart is empty</strong><small>Search or scan a medicine to begin.</small></div> : cart.map((line) => <div className="pos-cart-line" key={line.stock.id}>
        <div className="pos-line-main"><div><strong>{line.medicine.name}</strong><small>{line.medicine.strength || line.medicine.genericName || "Medicine"}</small><select className="pos-batch-select" aria-label={`Batch for ${line.medicine.name}`} value={line.stock.id} onChange={(event) => { const nextStock = (line.medicine.stocks ?? []).find((stock) => stock.id === event.target.value); if (nextStock) setCart((current) => current.map((entry) => entry.stock.id === line.stock.id ? { ...entry, stock: nextStock, quantity: Math.min(entry.quantity, nextStock.quantity), price: numeric(entry.medicine.salePrice) || numeric(nextStock.mrp) || entry.price } : entry)); }}>{(line.medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).map((stock) => <option key={stock.id} value={stock.id}>Batch {stock.batchNumber} · exp {new Date(stock.expiryDate).toLocaleDateString("en-GB")} · {stock.quantity} available</option>)}</select></div><button className="pos-icon-action pos-remove" onClick={() => setCart((current) => current.filter((item) => item.stock.id !== line.stock.id))} aria-label={`Remove ${line.medicine.name}`}><Trash2 size={15} /></button></div>
        <div className="pos-line-controls"><div className="pos-quantity-stepper"><button onClick={() => changeLine(line.stock.id, { quantity: line.quantity - 1 })} aria-label="Decrease quantity"><Minus size={13} /></button><input aria-label="Quantity" inputMode="numeric" value={line.quantity} onChange={(event) => { const next = Math.floor(numeric(event.target.value)) || 1; changeLine(line.stock.id, { quantity: Math.max(1, Math.min(line.stock.quantity, next)) }); }} /><button onClick={() => changeLine(line.stock.id, { quantity: Math.min(line.stock.quantity, line.quantity + 1) })} aria-label="Increase quantity" disabled={line.quantity >= line.stock.quantity}><Plus size={13} /></button></div><span className="pos-stock-hint">{line.stock.quantity} {line.stock.unit} available</span><label className="pos-discount-mini"><input aria-label="Item discount percent" type="number" min="0" max="100" value={line.discountPercent} onChange={(event) => changeLine(line.stock.id, { discountPercent: Math.min(100, Math.max(0, numeric(event.target.value))) })} /><span>% off</span></label><strong className="pos-line-total">{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>
      </div>)}
    </div>
    <div className="pos-checkout">
      <div className="pos-discount-row"><span>Sale discount</span><div className="pos-discount-input"><input type="number" min="0" max={discountMode === "percent" ? 100 : saleEligible} value={saleDiscount} onChange={(event) => setSaleDiscount(Math.max(0, numeric(event.target.value)))} /><select aria-label="Discount type" value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">BDT</option></select></div></div>
      <div className="pos-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="pos-total-row"><span>Item discount</span><span>−{money(itemDiscount)}</span></div><div className="pos-total-row"><span>Sale discount</span><span>−{money(actualSaleDiscount)}</span></div><div className="pos-total-row"><span>Tax · exclusive {taxPercent}%</span><span>{money(taxAmount)}</span></div>
      <div className="pos-grand-total"><span>Total due</span><strong>{money(total)}</strong></div>
      <div className="pos-payment-grid"><label><span>Method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as (typeof methods)[number])}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label><span>Account</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></label></div>
      <label className="pos-paid-field"><span>Collected now</span><span className="pos-currency-input"><b>৳</b><input inputMode="decimal" placeholder={total.toFixed(2)} value={paidInput} onChange={(event) => setPaidInput(event.target.value)} /></span></label>
      <div className="pos-due-row"><span>Remaining due</span><strong>{money(due)}</strong></div>
      <button className="pos-complete-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("completed")}><Check size={17} />{saving ? "Saving sale…" : "Complete sale"}</button>
      <button className="pos-pending-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("pending")}>Save as pending</button>
      <small className="pos-checkout-note">Stock is deducted by the server only after a completed sale.</small>
    </div>
  </>;

  return <section className="pos-page">
    <div className="pos-page-heading"><div><p className="eyebrow">PHARMACY · SALES</p><h1>Point of sale</h1><p className="page-subtitle">Find medicines, build a basket and check out securely.</p></div><div className="pos-context"><label><span>Branch</span><select value={branchId} onChange={(event) => { setBranchId(event.target.value); setSession(null); }}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><div className={`pos-register-state ${session ? "is-open" : "is-closed"}`}><span className="pos-state-dot"/><span><strong>{session ? "Register open" : "Register closed"}</strong><small>{session ? `Session ${String(session.sessionNumber ?? session.id ?? "active").slice(0, 12)}` : "Required to complete sales"}</small></span>{!session && <button type="button" onClick={() => setOpening(true)}>Open</button>}</div></div></div>
    {(error || notice) && <div className={`pos-alert ${error ? "pos-alert-error" : "pos-alert-success"}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X size={15}/></button></div>}
    <div className="pos-workspace">
      <div className="pos-catalog panel">
        <div className="pos-catalog-top"><div><h2>Medicine catalog</h2><p>Search by name, generic or barcode</p></div><button className={`pos-filter-button ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> Filters <ChevronDown size={14}/></button></div>
        <div className="pos-search-row"><div className="pos-search-box"><Search size={18}/><input autoFocus placeholder="Search medicine or scan barcode…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd><button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Barcode size={17}/></button></div><button type="button" className="pos-scan-button" onClick={() => document.querySelector<HTMLInputElement>(".pos-search-box input")?.focus()}><Barcode size={17}/><span>Scan</span></button></div>
        {filtersOpen && <div className="pos-filter-drawer"><label><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Generic</span><select value={genericId} onChange={(event) => setGenericId(event.target.value)}><option value="">All generics</option>{generics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Manufacturer</span><select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)}><option value="">All manufacturers</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Dosage form</span><input placeholder="e.g. Tablet" value={formulation} onChange={(event) => setFormulation(event.target.value)}/></label><label className="pos-stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)}/> In stock only</label><button className="pos-clear-filters" onClick={() => { setCategoryId(""); setGenericId(""); setManufacturerId(""); setFormulation(""); setInStockOnly(false); }}>Clear filters</button></div>}
        <div className="pos-results-meta"><span>{loading ? "Loading catalog…" : `${medicines.length} medicines`}</span><span><span className="pos-dot-green"/> Batch stock · selected branch</span></div>
        <div className="pos-product-grid">{medicines.map((medicine) => {
          const available = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).reduce((sum, stock) => sum + stock.quantity, 0);
          const earliest = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).sort((a,b) => a.expiryDate.localeCompare(b.expiryDate))[0];
          return <button type="button" key={medicine.id} className={`pos-product-card ${available === 0 ? "out-of-stock" : ""}`} onClick={() => addMedicine(medicine)} disabled={available === 0}>
            <span className="pos-product-icon"><Package size={19}/></span><span className="pos-product-copy"><strong>{medicine.name}</strong><small>{[medicine.strength, medicine.dosageForm || medicine.genericName].filter(Boolean).join(" · ") || "Pharmacy medicine"}</small><small className="pos-product-brand">{medicine.medicineManufacturer?.name || medicine.category?.name || "Catalog item"}</small></span><span className={`pos-stock-badge ${available > 0 ? "" : "empty"}`}>{available > 0 ? `${available} ${medicine.unit || "pcs"}` : "Out of stock"}</span><span className="pos-product-bottom"><span><strong>{money(numeric(medicine.salePrice) || numeric(earliest?.mrp) || numeric(medicine.mrp))}</strong><small>{earliest ? `Batch ${earliest.batchNumber}` : medicine.barcode || "No batch"}</small></span><span className="pos-add-icon"><Plus size={17}/></span></span>
          </button>;
        })}{!loading && medicines.length === 0 && <div className="pos-no-products"><Package size={22}/><strong>No matching medicines</strong><span>Try another name or clear some filters.</span></div>}</div>
        <div className="pos-catalog-footer"><span><Activity size={14}/> Prices and batch availability come from current stock.</span><span>Whole-unit quantities only</span></div>
      </div>
      <aside className="pos-cart-panel panel">{cartContent}</aside>
    </div>
    <button className="pos-mobile-cart-bar" onClick={() => setCartOpen(true)}><span className="pos-mobile-cart-icon"><ShoppingCart size={18}/><i>{totalUnits}</i></span><span><strong>{totalUnits} item{totalUnits === 1 ? "" : "s"}</strong><small>Tap to review order</small></span><strong className="pos-mobile-cart-total">{money(total)}</strong><ChevronRight size={17}/></button>
    {cartOpen && <div className="pos-cart-modal-backdrop" role="presentation" onClick={() => setCartOpen(false)}><div className="pos-cart-modal" role="dialog" aria-modal="true" aria-label="Current sale" onClick={(event) => event.stopPropagation()}>{cartContent}</div></div>}
    {opening && <div className="pos-dialog-backdrop" role="presentation" onClick={() => setOpening(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-dialog-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setOpening(false)} aria-label="Close"><X size={17}/></button><h2 id="register-dialog-title">Open cash register</h2><p>Record the opening float for {branches.find((branch) => branch.id === branchId)?.name || "this branch"}. This starts your cashier session.</p><label><span>Opening cash balance</span><span className="pos-currency-input"><b>৳</b><input autoFocus inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></span></label>{accounts.length === 0 && <div className="pos-dialog-warning">No active cash or payment accounts were found. A sale with collected payment needs an active account.</div>}{error && <div className="pos-dialog-error">{error}</div>}<button className="pos-complete-button" disabled={saving || !branchId} onClick={() => void openRegister()}>{saving ? "Opening…" : "Open register"}</button><button className="pos-dialog-cancel" onClick={() => { setOpening(false); setError(""); }}>Cancel</button></div></div>}
  </section>;
}
