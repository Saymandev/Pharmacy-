"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Barcode, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, Filter, Minus, Package, Pill, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

type Row = Record<string, unknown>;
type Branch = { id: string; name: string };
type Stock = { id: string; branchId: string; batchNumber: string; expiryDate: string; quantity: number; mrp: number; unit: string };
type Medicine = { id: string; name: string; nameBangla?: string; genericName?: string; dosageForm?: string; strength?: string; unit?: string; salePrice?: number; mrp?: number; barcode?: string; category?: { id: string; name: string }; group?: { id: string; name: string }; medicineUnit?: { id: string; name: string }; medicineManufacturer?: { name: string }; stocks?: Stock[] };
type Customer = { id: string; name: string; phone: string; balance?: number; customerNumber?: string };
type Account = { id: string; name: string; type: string; currentBalance?: number };
type CartLine = { medicine: Medicine; stock: Stock; quantity: number; price: number; discountPercent: number };
type FilterOption = { id: string; name: string };
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;
type PaymentLine = { id: string; amount: string; accountId: string; paymentMethod: (typeof methods)[number] };
type Receipt = { invoice: string; date: string; status: "pending" | "completed"; branch: string; cashier: string; customer: Customer; items: { name: string; description: string; quantity: number; unit: string; price: number; discount: number; total: number; batch: string }[]; subtotal: number; itemDiscount: number; saleDiscount: number; taxPercent: number; taxAmount: number; total: number; paid: number; due: number; payments: { method: string; account: string; amount: number }[] };

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
function pageSummary(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Row;
  const pagination = record.pagination && typeof record.pagination === "object" ? record.pagination as Row : null;
  const total = numeric(pagination?.total ?? pagination?.totalItems);
  const page = numeric(pagination?.page) || 1;
  const totalPages = numeric(pagination?.totalPages);
  return pagination ? { total, page, totalPages } : null;
}
function money(value: number) { return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function getError(error: unknown) { return error instanceof ApiClientError ? error.message : "Something went wrong. Please try again."; }

export function PosWorkspace() {
  const { hasPermission, user } = useAuth();
  const canCreateSales = hasPermission("sale:create");
  const canReadSales = hasPermission("sale:read");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [session, setSession] = useState<Row | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [generics, setGenerics] = useState<FilterOption[]>([]);
  const [manufacturers, setManufacturers] = useState<FilterOption[]>([]);
  const [groups, setGroups] = useState<FilterOption[]>([]);
  const [units, setUnits] = useState<FilterOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [genericId, setGenericId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [formulation, setFormulation] = useState("");
  const [strength, setStrength] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [productPage, setProductPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const productRequestId = useRef(0);
  const sessionRequestId = useRef(0);
  const paymentIdCounter = useRef(2);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<"percent" | "fixed">("percent");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ id: "payment-1", amount: "", accountId: "", paymentMethod: "cash" }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closing, setClosing] = useState(false);
  const [actualBalance, setActualBalance] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<Row[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<Row | null>(null);

  const loadProducts = useCallback(async (page = 1, append = false) => {
    if (!branchId) return;
    const requestId = ++productRequestId.current;
    const limit = 60;
    const params = new URLSearchParams({ page: String(page), limit: String(limit), branchId, isActive: "true" });
    if (query.trim()) params.set("search", query.trim());
    if (categoryId) params.set("categoryId", categoryId);
    if (genericId) params.set("genericId", genericId);
    if (manufacturerId) params.set("medicineManufacturerId", manufacturerId);
    if (groupId) params.set("groupId", groupId);
    if (unitId) params.set("medicineUnitId", unitId);
    if (formulation.trim()) params.set("dosageForm", formulation.trim());
    if (strength.trim()) params.set("strength", strength.trim());
    if (inStockOnly) params.set("hasStock", "true");
    setLoading(true);
    if (!append) setMedicines([]);
    try {
      const result = await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`);
      if (requestId !== productRequestId.current) return;
      const items = rows<Medicine>(result);
      setMedicines((current) => append ? [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))] : items);
      const summary = pageSummary(result);
      setProductPage(page);
      setTotalProducts(summary?.total ?? items.length);
      setHasMoreProducts(summary ? page < summary.totalPages : items.length === limit);
      setError("");
    } catch (cause) {
      if (requestId === productRequestId.current) {
        if (!append) setMedicines([]);
        setError(getError(cause));
      }
    } finally { if (requestId === productRequestId.current) setLoading(false); }
  }, [branchId, categoryId, genericId, manufacturerId, groupId, unitId, formulation, strength, inStockOnly, query]);

  const loadSession = useCallback(async (id: string) => {
    if (!id) return;
    const requestId = ++sessionRequestId.current;
    try {
      const active = await api.get<unknown>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(id)}`);
      if (requestId === sessionRequestId.current) setSession(active && typeof active === "object" ? active as Row : null);
    } catch { if (requestId === sessionRequestId.current) setSession(null); }
  }, []);

  function selectBranch(nextBranchId: string) {
    if (nextBranchId === branchId) return;
    if (cart.length > 0 && !window.confirm("Changing branch will clear the current sale so no batch from the previous branch is submitted. Continue?")) return;
    productRequestId.current += 1;
    sessionRequestId.current += 1;
    setBranchId(nextBranchId);
    setSession(null);
    setCart([]);
    setCustomer(null);
    setCustomerQuery("");
    setSaleDiscount(0);
    setPaymentLines([{ id: nextPaymentId(), amount: "", accountId: accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "", paymentMethod: "cash" }]);
    setError("");
    setNotice("");
  }

  function nextPaymentId() { return `payment-${paymentIdCounter.current++}`; }

  useEffect(() => {
    let live = true;
    async function init() {
      setLoading(true);
      const [branchResult, catResult, genResult, makerResult, groupResult, unitResult, accountResult, settingResult] = await Promise.allSettled([
        api.get<unknown>("/branches?page=1&limit=100"),
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
        api.get<unknown>("/pharmacy/groups?page=1&limit=100"),
        api.get<unknown>("/pharmacy/units?page=1&limit=100"),
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
      if (groupResult.status === "fulfilled") setGroups(rows<FilterOption>(groupResult.value));
      if (unitResult.status === "fulfilled") setUnits(rows<FilterOption>(unitResult.value));
      if (accountResult.status === "fulfilled") {
        const list = rows<Account>(accountResult.value).filter((item) => ["cash", "bank", "mfs"].includes(item.type));
        setAccounts(list);
        const defaultAccountId = list.find((item) => item.type === "cash")?.id ?? list[0]?.id ?? "";
        setPaymentLines((current) => current.map((line, index) => index === 0 ? { ...line, accountId: defaultAccountId } : line));
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
    const timer = window.setTimeout(() => { if (branchId) void loadProducts(1, false); }, 220);
    return () => window.clearTimeout(timer);
  }, [loadProducts, branchId]);
  useEffect(() => {
    if (!customerQuery.trim()) return;
    const timer = window.setTimeout(async () => {
      try {
        const term = customerQuery.trim();
        const phoneSearch = /^[+\d\s().-]+$/.test(term);
        const params = new URLSearchParams({ page: "1", limit: "8", [phoneSearch ? "phone" : "name"]: phoneSearch ? term.replace(/\D/g, "") : term });
        const result = await api.get<unknown>(`/customers?${params.toString()}`);
        setCustomers(rows<Customer>(result));
      } catch { setCustomers([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const visibleMedicines = useMemo(() => unitId ? medicines.filter((medicine) => medicine.medicineUnit?.id === unitId || units.find((unit) => unit.id === unitId)?.name === medicine.medicineUnit?.name || units.find((unit) => unit.id === unitId)?.name === medicine.unit) : medicines, [medicines, unitId, units]);
  const itemDiscount = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity * line.discountPercent / 100, 0), [cart]);
  const saleEligible = Math.max(0, subtotal - itemDiscount);
  const actualSaleDiscount = discountMode === "percent" ? Math.min(saleEligible, saleEligible * Math.min(100, Math.max(0, saleDiscount)) / 100) : Math.min(saleEligible, Math.max(0, saleDiscount));
  const taxPercent = taxRate;
  const taxable = Math.max(0, saleEligible - actualSaleDiscount);
  const taxAmount = Math.round(taxable * taxPercent) / 100;
  const total = taxable + taxAmount;
  const paid = paymentLines.length === 1 && paymentLines[0].amount === "" ? total : paymentLines.reduce((sum, line) => sum + Math.max(0, numeric(line.amount)), 0);
  const due = Math.max(0, total - paid);
  const totalUnits = cart.reduce((sum, line) => sum + line.quantity, 0);
  const activeFilterCount = [categoryId, genericId, manufacturerId, groupId, unitId, formulation.trim(), strength.trim(), inStockOnly ? "stock" : ""].filter(Boolean).length;

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
  async function scanBarcode(barcode: string) {
    const value = barcode.trim();
    if (!value || !branchId) return;
    try {
      const params = new URLSearchParams({ barcode: value, branchId, hasStock: "true", isActive: "true", page: "1", limit: "10" });
      const matches = rows<Medicine>(await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`));
      const exactMatch = matches.find((item) => item.barcode?.trim().toLowerCase() === value.toLowerCase());
      if (!exactMatch) {
        setNotice(`No in-stock medicine found for barcode ${value}.`);
        return;
      }
      addMedicine(exactMatch);
      setQuery("");
    } catch (cause) { setError(getError(cause)); }
  }
  function updatePaymentLine(id: string, patch: Partial<PaymentLine>) {
    setPaymentLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }
  function addPaymentLine() {
    const id = nextPaymentId();
    const accountId = accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "";
    setPaymentLines((current) => {
      const next = current.map((line, index) => index === 0 && line.amount === "" ? { ...line, amount: total.toFixed(2) } : line);
      return [...next, { id, amount: "", accountId, paymentMethod: "cash" }];
    });
  }
  function removePaymentLine(id: string) {
    setPaymentLines((current) => current.filter((line) => line.id !== id));
  }
  function changeLine(stockId: string, change: Partial<Pick<CartLine, "quantity" | "price" | "discountPercent">>) {
    setCart((current) => current.map((line) => line.stock.id === stockId ? { ...line, ...change } : line).filter((line) => line.quantity > 0));
  }
  async function openRegister() {
    if (!canCreateSales) { setError("Your role cannot open a cash register."); return; }
    setError(""); setSaving(true);
    try {
      const created = await api.post<unknown>("/pharmacy/cash-register/open", { branchId, openingBalance: Math.max(0, numeric(openingBalance)) });
      setSession(created as Row); setOpening(false); setNotice("Register opened. You can now complete sales.");
      await loadSession(branchId);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }
  async function closeRegister() {
    if (!canCreateSales) { setError("Your role cannot close a cash register."); return; }
    const sessionId = String(session?.id ?? session?.sessionId ?? "");
    if (!sessionId) { setError("The active register session has no usable ID. Refresh the page and try again."); return; }
    const amount = Number(actualBalance);
    if (!Number.isFinite(amount) || amount < 0) { setError("Enter a valid actual cash balance of zero or more."); return; }
    setError(""); setSaving(true);
    try {
      await api.post<unknown>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}/close`, {
        actualBalance: amount,
        ...(closingNote.trim() ? { closingNote: closingNote.trim() } : {}),
      });
      setClosing(false); setActualBalance(""); setClosingNote("");
      await loadSession(branchId);
      setNotice("Register closed. The cash difference has been recorded.");
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }
  async function loadRegisterHistory(page = historyPage, status = historyStatus) {
    if (!branchId) return;
    setHistoryLoading(true); setHistoryError("");
    const params = new URLSearchParams({ branchId, page: String(page), limit: "10" });
    if (status) params.set("status", status);
    try {
      const result = await api.get<unknown>(`/pharmacy/cash-register?${params.toString()}`);
      setHistorySessions(rows<Row>(result)); setHistoryPage(page);
    } catch (cause) { setHistoryError(getError(cause)); }
    finally { setHistoryLoading(false); }
  }
  async function openRegisterSession(sessionId: string) {
    setHistoryLoading(true); setHistoryError("");
    try {
      const detail = await api.get<unknown>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}`);
      setSelectedHistory(detail && typeof detail === "object" ? detail as Row : null);
    } catch (cause) { setHistoryError(getError(cause)); }
    finally { setHistoryLoading(false); }
  }
  async function submitSale(status: "pending" | "completed") {
    if (!canCreateSales) { setError("Your role cannot create sales."); return; }
    setError(""); setNotice("");
    if (!branchId || cart.length === 0) { setError("Select a branch and add at least one medicine."); return; }
    if (!customer) { setError("Select a customer before saving. This avoids the backend’s unresolved walk-in customer behavior."); return; }
    if (status === "completed" && !session) { setOpening(true); setError("Open the cash register before completing a sale."); return; }
    if (paid > total) { setError("Collected amount cannot exceed the sale total. Change is not supported by this backend flow."); return; }
    if (paymentLines.some((line) => !line.accountId && (numeric(line.amount) > 0 || (paymentLines.length === 1 && line.amount === "" && paid > 0)))) { setError("Choose an account for each payment method with an amount."); return; }
    if (cart.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.stock.quantity)) { setError("Each quantity must be a whole number within the selected batch stock."); return; }
    setSaving(true);
    const saleDiscountPercent = saleEligible > 0 ? actualSaleDiscount / saleEligible * 100 : 0;
    const paymentPayload = paymentLines.length === 1 && paymentLines[0].amount === ""
      ? [{ accountId: paymentLines[0].accountId, amount: paid, paymentMethod: paymentLines[0].paymentMethod }]
      : paymentLines.filter((line) => numeric(line.amount) > 0).map((line) => ({ accountId: line.accountId, amount: numeric(line.amount), paymentMethod: line.paymentMethod }));
    const payload = {
      customerId: customer.id, branchId, type: "pos", status,
      paymentMethod: paymentLines[0]?.paymentMethod ?? "cash", discountPercentage: saleDiscountPercent, discountAmount: actualSaleDiscount,
      taxPercentage: taxPercent, taxAmount, paidAmount: paid, dueAmount: due,
      paymentStatus: due <= 0 ? "paid" : paid > 0 ? "partial" : "due",
      note: session && (session.id || session.sessionId) ? `Register: ${String(session.id ?? session.sessionId)}` : undefined,
      ...(paid > 0 ? { payments: paymentPayload } : {}),
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
      setReceipt({
        invoice: invoice || "Pending assignment",
        date: String(result.createdAt ?? new Date().toISOString()),
        status,
        branch: branches.find((item) => item.id === branchId)?.name ?? "Pharmacy branch",
        cashier: user?.fullName ?? "Pharmacy cashier",
        customer,
        items: cart.map((line) => {
          const discount = Math.round(line.price * line.quantity * line.discountPercent) / 100;
          return { name: line.medicine.name, description: [line.medicine.strength, line.medicine.genericName].filter(Boolean).join(" · "), quantity: line.quantity, unit: line.stock.unit || line.medicine.unit || "Pcs", price: line.price, discount, total: line.price * line.quantity - discount, batch: line.stock.batchNumber };
        }),
        subtotal,
        itemDiscount,
        saleDiscount: actualSaleDiscount,
        taxPercent,
        taxAmount,
        total,
        paid,
        due,
        payments: paymentPayload.map((payment) => ({ method: payment.paymentMethod, account: accounts.find((account) => account.id === payment.accountId)?.name ?? "Account", amount: payment.amount })),
      });
      setCart([]); setCustomer(null); setCustomerQuery(""); setSaleDiscount(0); setPaymentLines([{ id: nextPaymentId(), amount: "", accountId: accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "", paymentMethod: "cash" }]); setCartOpen(false);
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
      <div className="pos-discount-row"><span>Sale discount</span><div className="pos-discount-input"><input type="number" min="0" max={discountMode === "percent" ? 100 : saleEligible} value={saleDiscount} onChange={(event) => setSaleDiscount(Math.min(discountMode === "percent" ? 100 : saleEligible, Math.max(0, numeric(event.target.value))))} /><select aria-label="Discount type" value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">BDT</option></select></div></div>
      <div className="pos-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="pos-total-row"><span>Item discount</span><span>−{money(itemDiscount)}</span></div><div className="pos-total-row"><span>Sale discount</span><span>−{money(actualSaleDiscount)}</span></div><div className="pos-total-row"><span>Tax · exclusive {taxPercent}%</span><span>{money(taxAmount)}</span></div>
      <div className="pos-grand-total"><span>Total due</span><strong>{money(total)}</strong></div>
      <div className="pos-tender-heading"><span>Collected now</span><strong>{money(paid)}</strong></div>
      <div className="pos-tender-lines">{paymentLines.map((line, index) => <div className="pos-tender-line" key={line.id}><label><span>Method</span><select value={line.paymentMethod} onChange={(event) => updatePaymentLine(line.id, { paymentMethod: event.target.value as (typeof methods)[number] })}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label><span>Account</span><select value={line.accountId} onChange={(event) => updatePaymentLine(line.id, { accountId: event.target.value })}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></label><label><span>Amount</span><span className="pos-currency-input"><b>৳</b><input type="number" min="0" step="0.01" inputMode="decimal" placeholder={paymentLines.length === 1 && index === 0 ? total.toFixed(2) : "0.00"} value={line.amount} onChange={(event) => updatePaymentLine(line.id, { amount: event.target.value })} /></span></label>{paymentLines.length > 1 && <button type="button" className="pos-icon-action pos-tender-remove" aria-label={`Remove payment ${index + 1}`} onClick={() => removePaymentLine(line.id)}><X size={14}/></button>}</div>)}</div>
      <button type="button" className="pos-add-tender" onClick={addPaymentLine} disabled={saving || paymentLines.length >= 8}><Plus size={14}/> Add payment method</button>
      <div className="pos-due-row"><span>Remaining due</span><strong>{money(due)}</strong></div>
      {canCreateSales&&<><button className="pos-complete-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("completed")}><Check size={17} />{saving ? "Saving sale…" : "Complete sale"}</button>
      <button className="pos-pending-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("pending")}>Save as pending</button>
      <small className="pos-checkout-note">Stock is deducted by the server only after a completed sale.</small></>}
    </div>
  </>;

  return <section className="pos-page">
    <div className="pos-page-heading"><div><p className="eyebrow">PHARMACY · SALES</p><h1>Point of sale</h1><p className="page-subtitle">Find medicines, build a basket and check out securely.</p></div><div className="pos-context"><label><span>Branch</span><select value={branchId} onChange={(event) => selectBranch(event.target.value)}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><div className={`pos-register-state ${session ? "is-open" : "is-closed"}`}><span className="pos-state-dot"/><span><strong>{session ? "Register open" : "Register closed"}</strong><small>{session ? `Session ${String(session.sessionNumber ?? session.id ?? "active").slice(0, 12)}` : "Required to complete sales"}</small></span>{canCreateSales&&(session ? <button type="button" onClick={() => { setError(""); setActualBalance(String(numeric(session.closingBalance))); setClosing(true); }}>Close</button> : <button type="button" onClick={() => setOpening(true)}>Open</button>)}</div>{canReadSales&&<button className="pos-history-button" type="button" disabled={!branchId} onClick={() => { setHistoryOpen(true); setSelectedHistory(null); setHistoryPage(1); setHistoryStatus(""); void loadRegisterHistory(1, ""); }}><Clock3 size={14}/> History</button>}</div></div>
    {(error || notice) && <div className={`pos-alert ${error ? "pos-alert-error" : "pos-alert-success"}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X size={15}/></button></div>}
    <div className="pos-workspace">
      <div className="pos-catalog panel">
        <div className="pos-catalog-top"><div><h2>Medicine catalog</h2><p>Search by name, generic or barcode</p></div><span className="pos-catalog-branch">{branches.find((branch) => branch.id === branchId)?.name ?? "Select a branch"}</span></div>
        <div className="pos-search-row"><div className="pos-search-box"><Search size={18}/><input autoFocus placeholder="Search medicine or scan barcode…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) { event.preventDefault(); void scanBarcode(query); } }} /><kbd>Enter</kbd>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={16}/></button>}</div><button type="button" className="pos-scan-button" onClick={() => document.querySelector<HTMLInputElement>(".pos-search-box input")?.focus()}><Barcode size={17}/><span>Barcode</span></button></div>
        <div className="pos-filter-toolbar"><button className={`pos-filter-button ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> Filters{activeFilterCount > 0 && <span className="pos-filter-count">{activeFilterCount}</span>}<ChevronDown size={14}/></button>{activeFilterCount > 0 && <button className="pos-clear-filters" onClick={() => { setCategoryId(""); setGenericId(""); setManufacturerId(""); setGroupId(""); setUnitId(""); setFormulation(""); setStrength(""); setInStockOnly(false); }}>Clear filters</button>}</div>
        {filtersOpen && <div className="pos-filter-drawer"><label><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Generic</span><select value={genericId} onChange={(event) => setGenericId(event.target.value)}><option value="">All generics</option>{generics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Manufacturer</span><select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)}><option value="">All manufacturers</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Group</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">All groups</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Unit</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">All units</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Dosage form</span><input placeholder="e.g. Tablet" value={formulation} onChange={(event) => setFormulation(event.target.value)}/></label><label><span>Strength</span><input placeholder="e.g. 500 mg" value={strength} onChange={(event) => setStrength(event.target.value)}/></label><label className="pos-stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)}/> In stock only</label></div>}
        <div className="pos-results-meta"><span>{loading ? "Loading catalog…" : `${visibleMedicines.length} ${unitId ? "matching" : "shown"}${!unitId && totalProducts > medicines.length ? ` of ${totalProducts}` : ""} medicines`}</span><span><span className="pos-dot-green"/> Batch stock · selected branch</span></div>
        <div className="pos-product-grid">{visibleMedicines.map((medicine) => {
          const available = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).reduce((sum, stock) => sum + stock.quantity, 0);
          const earliest = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).sort((a,b) => a.expiryDate.localeCompare(b.expiryDate))[0];
          return <button type="button" key={medicine.id} className={`pos-product-card ${available === 0 ? "out-of-stock" : ""}`} onClick={() => addMedicine(medicine)} disabled={available === 0 || !canCreateSales}>
            <span className="pos-product-icon"><Package size={19}/></span><span className="pos-product-copy"><strong>{medicine.name}</strong><small>{[medicine.strength, medicine.dosageForm || medicine.genericName].filter(Boolean).join(" · ") || "Pharmacy medicine"}</small><small className="pos-product-brand">{medicine.medicineManufacturer?.name || medicine.category?.name || "Catalog item"}</small></span><span className={`pos-stock-badge ${available > 0 ? "" : "empty"}`}>{available > 0 ? `${available} ${medicine.unit || "pcs"}` : "Out of stock"}</span><span className="pos-product-bottom"><span><strong>{money(numeric(medicine.salePrice) || numeric(earliest?.mrp) || numeric(medicine.mrp))}</strong><small>{earliest ? `Batch ${earliest.batchNumber}` : medicine.barcode || "No batch"}</small></span><span className="pos-add-icon"><Plus size={17}/></span></span>
          </button>;
        })}{!loading && visibleMedicines.length === 0 && <div className="pos-no-products"><Package size={22}/><strong>No matching medicines</strong><span>{unitId && hasMoreProducts ? "Load more results to find medicines in this unit." : "Try another name or clear some filters."}</span></div>}</div>
        {hasMoreProducts && <button type="button" className="pos-load-more" disabled={loading} onClick={() => void loadProducts(productPage + 1, true)}>{loading ? "Loading more…" : `Load more medicines${!unitId && totalProducts > medicines.length ? ` · ${totalProducts - medicines.length} remaining` : ""}`}</button>}
        <div className="pos-catalog-footer"><span><Activity size={14}/> Prices and batch availability come from current stock.</span><span>Whole-unit quantities only</span></div>
      </div>
      <aside className="pos-cart-panel panel">{cartContent}</aside>
    </div>
    <button className="pos-mobile-cart-bar" onClick={() => setCartOpen(true)}><span className="pos-mobile-cart-icon"><ShoppingCart size={18}/><i>{totalUnits}</i></span><span><strong>{totalUnits} item{totalUnits === 1 ? "" : "s"}</strong><small>Tap to review order</small></span><strong className="pos-mobile-cart-total">{money(total)}</strong><ChevronRight size={17}/></button>
    {cartOpen && <div className="pos-cart-modal-backdrop" role="presentation" onClick={() => setCartOpen(false)}><div className="pos-cart-modal" role="dialog" aria-modal="true" aria-label="Current sale" onClick={(event) => event.stopPropagation()}>{cartContent}</div></div>}
    {receipt && <div className="pos-receipt-backdrop" role="presentation"><section className="pos-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title"><div className="pos-receipt-actions"><button type="button" className="pos-dialog-cancel" onClick={() => setReceipt(null)}>Close</button><button type="button" className="pos-complete-button" onClick={() => window.print()}><Check size={15}/> Print receipt</button></div><div className="pos-receipt-paper"><header><span className="pos-receipt-mark"><Pill size={17}/></span><h2 id="pos-receipt-title">{receipt.status === "pending" ? "Sale slip" : "Sales receipt"}</h2><strong>{receipt.branch}</strong><small>Pharmacy POS</small></header><div className="pos-receipt-meta"><span>Invoice <strong>{receipt.invoice}</strong></span><span>Status <strong>{receipt.status.toUpperCase()}</strong></span><span>Date <strong>{new Date(receipt.date).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</strong></span><span>Cashier <strong>{receipt.cashier}</strong></span></div><div className="pos-receipt-customer"><small>Customer</small><strong>{receipt.customer.name}</strong><span>{receipt.customer.phone}</span></div><div className="pos-receipt-items"><div className="pos-receipt-table-head"><span>Item</span><span>Qty</span><span>Total</span></div>{receipt.items.map((item, index) => <div className="pos-receipt-item" key={`${item.name}-${item.batch}-${index}`}><span><strong>{item.name}</strong><small>{item.description || item.unit} · Batch {item.batch}</small><small>{money(item.price)} × {item.quantity}{item.discount ? ` · Discount ${money(item.discount)}` : ""}</small></span><b>{item.quantity}</b><strong>{money(item.total)}</strong></div>)}</div><div className="pos-receipt-totals"><span>Subtotal<strong>{money(receipt.subtotal)}</strong></span><span>Item discount<strong>−{money(receipt.itemDiscount)}</strong></span><span>Sale discount<strong>−{money(receipt.saleDiscount)}</strong></span><span>Tax (exclusive {receipt.taxPercent}%)<strong>{money(receipt.taxAmount)}</strong></span><span className="pos-receipt-grand">Total<strong>{money(receipt.total)}</strong></span><span>Paid<strong>{money(receipt.paid)}</strong></span><span>Due<strong>{money(receipt.due)}</strong></span></div>{receipt.payments.length > 0 && <div className="pos-receipt-payments"><small>Payment breakdown</small>{receipt.payments.map((payment, index) => <span key={`${payment.method}-${index}`}>{payment.method} · {payment.account}<strong>{money(payment.amount)}</strong></span>)}</div>}<footer>Thank you. Please keep this receipt for your records.</footer></div></section></div>}
    {opening && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => setOpening(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-dialog-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setOpening(false)} aria-label="Close"><X size={17}/></button><h2 id="register-dialog-title">Open cash register</h2><p>Record the opening float for {branches.find((branch) => branch.id === branchId)?.name || "this branch"}. This starts your cashier session.</p><label><span>Opening cash balance</span><span className="pos-currency-input"><b>৳</b><input autoFocus inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></span></label>{accounts.length === 0 && <div className="pos-dialog-warning">No active cash or payment accounts were found. A sale with collected payment needs an active account.</div>}{error && <div className="pos-dialog-error">{error}</div>}<button className="pos-complete-button" disabled={saving || !branchId} onClick={() => void openRegister()}>{saving ? "Opening…" : "Open register"}</button><button className="pos-dialog-cancel" onClick={() => { setOpening(false); setError(""); }}>Cancel</button></div></div>}
    {closing && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setClosing(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-close-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setClosing(false)} aria-label="Close" disabled={saving}><X size={17}/></button><h2 id="register-close-title">Close cash register</h2><p>Count the cash in the drawer and record any difference before ending this cashier session.</p><div className="pos-register-expected"><span>Expected cash balance</span><strong>{money(numeric(session?.closingBalance))}</strong></div><label><span>Actual cash balance</span><span className="pos-currency-input"><b>৳</b><input autoFocus inputMode="decimal" min="0" type="number" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} /></span></label><div className="pos-register-expected"><span>Difference</span><strong>{money(numeric(actualBalance) - numeric(session?.closingBalance))}</strong></div><label className="pos-register-note"><span>Closing note <small>Optional</small></span><textarea rows={3} maxLength={500} placeholder="Explain a cash shortage or overage" value={closingNote} onChange={(event) => setClosingNote(event.target.value)} /></label>{error && <div className="pos-dialog-error">{error}</div>}<button className="pos-complete-button" disabled={saving || actualBalance.trim() === ""} onClick={() => void closeRegister()}>{saving ? "Closing…" : "Close register"}</button><button className="pos-dialog-cancel" disabled={saving} onClick={() => { setClosing(false); setError(""); }}>Cancel</button></div></div>}
    {historyOpen && <div className="pos-dialog-backdrop pos-history-backdrop" role="presentation" onClick={() => setHistoryOpen(false)}><div className="pos-history-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-history-title" onClick={(event) => event.stopPropagation()}><div className="pos-history-heading"><div><p className="eyebrow">CASH MANAGEMENT</p><h2 id="pos-history-title">Register history</h2><p>Sessions for {branches.find((branch) => branch.id === branchId)?.name || "this branch"}</p></div><button className="pos-icon-action" onClick={() => setHistoryOpen(false)} aria-label="Close history"><X size={17}/></button></div>{selectedHistory ? <><button className="pos-history-back" onClick={() => setSelectedHistory(null)}>‹ Back to sessions</button><div className="pos-history-detail"><div><span>Session status</span><strong className={`pos-history-status ${String(selectedHistory.status ?? "").toLowerCase()}`}>{String(selectedHistory.status ?? "unknown")}</strong></div><div><span>Opened</span><strong>{selectedHistory.createdAt ? new Date(String(selectedHistory.createdAt)).toLocaleString() : "—"}</strong></div><div><span>Opening balance</span><strong>{money(numeric(selectedHistory.openingBalance))}</strong></div><div><span>Expected balance</span><strong>{money(numeric(selectedHistory.closingBalance))}</strong></div><div><span>Counted balance</span><strong>{selectedHistory.actualBalance == null ? "—" : money(numeric(selectedHistory.actualBalance))}</strong></div><div><span>Difference</span><strong>{selectedHistory.difference == null ? "—" : money(numeric(selectedHistory.difference))}</strong></div>{Boolean(selectedHistory.closedAt) && <div><span>Closed</span><strong>{new Date(String(selectedHistory.closedAt)).toLocaleString()}</strong></div>}{Boolean(selectedHistory.closingNote) && <p className="pos-history-note">{String(selectedHistory.closingNote)}</p>}</div><h3 className="pos-history-sales-title">Sales in this session</h3><div className="pos-history-sales">{rows<Row>(selectedHistory.sales).map((sale) => <div key={String(sale.id)}><span><strong>{String(sale.invoiceNumber ?? sale.id ?? "Sale")}</strong><small>{sale.createdAt ? new Date(String(sale.createdAt)).toLocaleString() : ""}</small></span><strong>{money(numeric(sale.netPrice))}</strong></div>)}{rows<Row>(selectedHistory.sales).length === 0 && <p className="pos-history-empty">No linked sales are recorded for this session.</p>}</div></> : <><div className="pos-history-toolbar"><label><span>Status</span><select value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value); void loadRegisterHistory(1, event.target.value); }}><option value="">All sessions</option><option value="open">Open</option><option value="closed">Closed</option></select></label><span>Page {historyPage}</span></div>{historyError && <div className="pos-dialog-error">{historyError}</div>}<div className="pos-history-list">{historySessions.map((item) => <button type="button" key={String(item.id)} onClick={() => void openRegisterSession(String(item.id))}><span className="pos-history-session-main"><strong>Session {String(item.sessionNumber ?? item.id ?? "").slice(0, 12)}</strong><small>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : "Date unavailable"}</small></span><span className={`pos-history-status ${String(item.status ?? "").toLowerCase()}`}>{String(item.status ?? "unknown")}</span><strong>{money(numeric(item.actualBalance ?? item.closingBalance))}</strong><ChevronRight size={15}/></button>)}{!historyLoading && historySessions.length === 0 && <p className="pos-history-empty">No register sessions match this branch and filter.</p>}</div>{historyLoading && <p className="pos-history-loading">Loading register sessions…</p>}<div className="pos-history-pagination"><button type="button" disabled={historyLoading || historyPage <= 1} onClick={() => void loadRegisterHistory(historyPage - 1)}>Previous</button><button type="button" disabled={historyLoading || historySessions.length < 10} onClick={() => void loadRegisterHistory(historyPage + 1)}>Next</button></div></>}</div></div>}
  </section>;
}

