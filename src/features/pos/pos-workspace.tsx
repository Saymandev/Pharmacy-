"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Barcode, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, Filter, Minus, Package, Pill, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Row = Record<string, unknown>;
type Stock = { id: string; branchId: string; batchNumber: string; expiryDate: string; quantity: number; mrp: number; unit: string };
type Medicine = { id: string; name: string; nameBangla?: string; genericName?: string; dosageForm?: string; strength?: string; unit?: string; salePrice?: number; mrp?: number; barcode?: string; category?: { id: string; name: string }; group?: { id: string; name: string }; medicineUnit?: { id: string; name: string }; medicineManufacturer?: { name: string }; stocks?: Stock[] };
type Customer = { id: string; name: string; nameBangla?: string; phone: string; balance?: number; customerNumber?: string };
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
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function getError(error: unknown) { return error instanceof ApiClientError ? error.message : "Something went wrong. Please try again."; }
function asciiDigits(value: string) { return value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))); }
async function fetchCustomers(params: URLSearchParams) {
  const query = params.toString();
  try {
    return await api.get<unknown>(`/pharmacy/customers?${query}`);
  } catch (cause) {
    if (!(cause instanceof ApiClientError) || cause.status !== 404) throw cause;
    return api.get<unknown>(`/customers?${query}`);
  }
}

export function PosWorkspace() {
  const { hasPermission, user } = useAuth();
  const { branches, activeBranchId: branchId, activeBranch } = useActiveBranch();
  const { language, t } = useLanguage();
  const locale = language === "bn" ? "bn-BD" : "en-BD";
  function money(value: number) { return new Intl.NumberFormat(locale, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(value || 0); }
  function medicineName(medicine: Medicine) { return language === "bn" ? medicine.nameBangla || medicine.name : medicine.name; }
  const canCreateSales = hasPermission("sale:create");
  const canCreateCustomers = hasPermission("customer:create");
  const canCreateAccounts = hasPermission("account:create");
  const canReadSales = hasPermission("sale:read");
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
  const productsLoaded = useRef(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const sessionRequestId = useRef(0);
  const paymentIdCounter = useRef(2);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"pending" | "completed" | null>(null);
  const [customerQuickOpen, setCustomerQuickOpen] = useState(false);
  const [customerQuickSaving, setCustomerQuickSaving] = useState(false);
  const [customerQuickForm, setCustomerQuickForm] = useState({ name: "", phone: "", age: "", gender: "other" });
  const [accountQuickOpen, setAccountQuickOpen] = useState(false);
  const [accountQuickSaving, setAccountQuickSaving] = useState(false);
  const [accountQuickForm, setAccountQuickForm] = useState({ name: "", type: "cash" });
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const customerRequestId = useRef(0);
  const opdCustomerRequest = useRef<Promise<Customer | null> | null>(null);
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
    if (!productsLoaded.current) setLoading(true);
    setCatalogRefreshing(productsLoaded.current);
    try {
      const result = await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`);
      if (requestId !== productRequestId.current) return;
      const items = rows<Medicine>(result);
      productsLoaded.current = true;
      setMedicines((current) => append ? [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))] : items);
      const summary = pageSummary(result);
      setProductPage(page);
      setTotalProducts(summary?.total ?? items.length);
      setHasMoreProducts(summary ? page < summary.totalPages : items.length === limit);
      setError("");
    } catch (cause) {
      if (requestId === productRequestId.current) {
        productsLoaded.current = true;
        setError(getError(cause));
      }
    } finally { if (requestId === productRequestId.current) { setLoading(false); setCatalogRefreshing(false); } }
  }, [branchId, categoryId, genericId, manufacturerId, groupId, unitId, formulation, strength, inStockOnly, query]);

  const loadSession = useCallback(async (id: string) => {
    if (!id) return;
    const requestId = ++sessionRequestId.current;
    try {
      const active = await api.get<unknown>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(id)}`);
      if (requestId === sessionRequestId.current) setSession(active && typeof active === "object" ? active as Row : null);
    } catch { if (requestId === sessionRequestId.current) setSession(null); }
  }, []);

  const resolveOpdCustomer = useCallback(async () => {
    if (!opdCustomerRequest.current) {
      opdCustomerRequest.current = fetchCustomers(new URLSearchParams({ name: "OPD customer", page: "1", limit: "10" }))
        .then((result) => {
          const candidates = rows<Customer>(result);
          return candidates.find((item) => item.name.trim().toLowerCase() === "opd customer")
            ?? candidates.find((item) => item.name.toLowerCase().includes("opd"))
            ?? null;
        })
        .catch(() => null);
    }
    return opdCustomerRequest.current;
  }, []);

  function nextPaymentId() { return `payment-${paymentIdCounter.current++}`; }

  useEffect(() => {
    let live = true;
    async function init() {
      setLoading(true);
      const [catResult, genResult, makerResult, groupResult, unitResult, accountResult, settingResult] = await Promise.allSettled([
        api.get<unknown>("/pharmacy/categories?page=1&limit=100"),
        api.get<unknown>("/pharmacy/generics?page=1&limit=100"),
        api.get<unknown>("/pharmacy/manufacturers?page=1&limit=100"),
        api.get<unknown>("/pharmacy/groups?page=1&limit=100"),
        api.get<unknown>("/pharmacy/units?page=1&limit=100"),
        api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true"),
        api.get<unknown>("/settings/tax"),
      ]);
      if (!live) return;
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
      setLoading(false);
    }
    void init();
    return () => { live = false; };
  }, [t]);

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
    const requestId = ++customerRequestId.current;
    if (!customerQuery.trim()) {
      setCustomers([]);
      setCustomerSearchLoading(false);
      setCustomerSearchError("");
      return;
    }
    setCustomerSearchLoading(true);
    setCustomerSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        const term = customerQuery.trim();
        const numericTerm = asciiDigits(term);
        const phoneSearch = /^[+\d\s().-]+$/.test(numericTerm);
        const params = new URLSearchParams({ page: "1", limit: "10", [phoneSearch ? "phone" : "name"]: phoneSearch ? numericTerm.replace(/\D/g, "") : term });
        const result = await fetchCustomers(params);
        if (requestId === customerRequestId.current) setCustomers(rows<Customer>(result));
      } catch (cause) {
        if (requestId === customerRequestId.current) {
          setCustomers([]);
          setCustomerSearchError(getError(cause));
        }
      } finally {
        if (requestId === customerRequestId.current) setCustomerSearchLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); customerRequestId.current += 1; };
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
    if (!available.length) { setNotice(`${medicineName(medicine)} ${t(" has no sellable stock in this branch.")}`); return; }
    const chosen = [...available].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
    setCart((current) => {
      const existing = current.find((line) => line.stock.id === chosen.id);
      if (existing) return current.map((line) => line.stock.id === chosen.id ? { ...line, quantity: Math.min(line.quantity + 1, chosen.quantity) } : line);
      return [...current, { medicine, stock: chosen, quantity: 1, price: numeric(medicine.salePrice) || numeric(chosen.mrp) || numeric(medicine.mrp), discountPercent: 0 }];
    });
    setNotice(available.length > 1 ? `${medicineName(medicine)}: ${t("Earliest-expiry batch selected. Change it in the cart if needed.")}` : "");
  }
  async function scanBarcode(barcode: string) {
    const value = barcode.trim();
    if (!value || !branchId) return;
    try {
      const params = new URLSearchParams({ barcode: value, branchId, hasStock: "true", isActive: "true", page: "1", limit: "10" });
      const matches = rows<Medicine>(await api.get<unknown>(`/pharmacy/medicines?${params.toString()}`));
      const exactMatch = matches.find((item) => item.barcode?.trim().toLowerCase() === value.toLowerCase());
      if (!exactMatch) {
        setNotice(`${t("No in-stock medicine found for barcode")} ${value}.`);
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
    if (!canCreateSales) { setError(t("Your role cannot open a cash register.")); return; }
    setError(""); setSaving(true);
    try {
      const created = await api.post<unknown>("/pharmacy/cash-register/open", { branchId, openingBalance: Math.max(0, numeric(openingBalance)) });
      setSession(created as Row); setOpening(false); setNotice(t("Register opened. You can now complete sales."));
      await loadSession(branchId);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }
  async function closeRegister() {
    if (!canCreateSales) { setError(t("Your role cannot close a cash register.")); return; }
    const sessionId = String(session?.id ?? session?.sessionId ?? "");
    if (!sessionId) { setError(t("The active register session has no usable ID. Refresh the page and try again.")); return; }
    const amount = Number(actualBalance);
    if (!Number.isFinite(amount) || amount < 0) { setError(t("Enter a valid actual cash balance of zero or more.")); return; }
    setError(""); setSaving(true);
    try {
      await api.post<unknown>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}/close`, {
        actualBalance: amount,
        ...(closingNote.trim() ? { closingNote: closingNote.trim() } : {}),
      });
      setClosing(false); setActualBalance(""); setClosingNote("");
      await loadSession(branchId);
      setNotice(t("Register closed. The cash difference has been recorded."));
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
  async function createCheckoutCustomer() {
    if (!canCreateCustomers || !checkoutOpen) return;
    const { name, phone, age: ageInput, gender } = customerQuickForm;
    const age = Number(ageInput);
    if (!name.trim() || !phone.trim() || !ageInput.trim() || !Number.isInteger(age) || age < 0) {
      setError(t("Customer name, phone and a valid whole-number age are required."));
      return;
    }
    setCustomerQuickSaving(true);
    setError("");
    try {
      const created = await api.post<Customer>("/customers", {
        name: name.trim(), phone: phone.trim(), age, gender, visitType: "opd",
      });
      let selected: Customer | null = created?.id ? created : null;
      if (!selected) {
        const found = rows<Customer>(await fetchCustomers(new URLSearchParams({
          phone: asciiDigits(phone).replace(/\D/g, ""), page: "1", limit: "10",
        })));
        const normalized = asciiDigits(phone).replace(/\D/g, "");
        selected = found.find((entry) => asciiDigits(entry.phone).replace(/\D/g, "") === normalized) ?? null;
      }
      if (selected) {
        setCustomer(selected);
        setCustomerQuery("");
        setCustomerOpen(false);
        setNotice(t("Customer created and selected for checkout."));
      } else {
        setError(t("Customer was created. Search for the phone number to select the new customer."));
      }
      setCustomerQuickOpen(false);
      setCustomerQuickForm({ name: "", phone: "", age: "", gender: "other" });
    } catch (cause) { setError(getError(cause)); }
    finally { setCustomerQuickSaving(false); }
  }

  async function createCheckoutAccount() {
    if (!canCreateAccounts || !checkoutOpen) return;
    const { name, type } = accountQuickForm;
    if (!name.trim()) { setError(t("Enter a payment account name.")); return; }
    setAccountQuickSaving(true);
    setError("");
    try {
      const created = await api.post<Account>("/finance/accounts", {
        name: name.trim(), type, group: "pharmacy", openingBalance: 0, description: "", isActive: true,
      });
      const current = rows<Account>(await api.get<unknown>("/finance/accounts?page=1&limit=100&isActive=true"))
        .filter((entry) => ["cash", "bank", "mfs"].includes(entry.type));
      setAccounts(current);
      const selected = current.find((entry) => entry.id === created?.id) ?? current.find((entry) => entry.name === name.trim() && entry.type === type);
      if (selected && paymentLines.length === 1) updatePaymentLine(paymentLines[0].id, { accountId: selected.id });
      setAccountQuickOpen(false);
      setAccountQuickForm({ name: "", type: "cash" });
      setNotice(t("Payment account created. Select it for the relevant payment."));
    } catch (cause) { setError(getError(cause)); }
    finally { setAccountQuickSaving(false); }
  }

  async function submitSale(status: "pending" | "completed") {
    if (!canCreateSales) { setError(t("Your role cannot create sales.")); return; }
    setError(""); setNotice("");
    if (!branchId || cart.length === 0) { setError(t("Select a branch and add at least one medicine.")); return; }
    if (status === "completed" && !session) { setOpening(true); setError(t("Open the cash register before completing a sale.")); return; }
    if (paid > total) { setError(t("Collected amount cannot exceed the sale total. Change is not supported by this backend flow.")); return; }
    if (paymentLines.some((line) => !line.accountId && (numeric(line.amount) > 0 || (paymentLines.length === 1 && line.amount === "" && paid > 0)))) { setError(t("Choose an account for each payment method with an amount.")); return; }
    if (cart.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.stock.quantity)) { setError(t("Each quantity must be a whole number within the selected batch stock.")); return; }
    setSaving(true);
    const saleCustomer = customer ?? await resolveOpdCustomer();
    const saleDiscountPercent = saleEligible > 0 ? actualSaleDiscount / saleEligible * 100 : 0;
    const paymentPayload = paymentLines.length === 1 && paymentLines[0].amount === ""
      ? [{ accountId: paymentLines[0].accountId, amount: paid, paymentMethod: paymentLines[0].paymentMethod }]
      : paymentLines.filter((line) => numeric(line.amount) > 0).map((line) => ({ accountId: line.accountId, amount: numeric(line.amount), paymentMethod: line.paymentMethod }));
    const payload = {
      ...(saleCustomer ? { customerId: saleCustomer.id } : {}), branchId, type: "pos", status,
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
        branch: activeBranch?.name ?? "Pharmacy branch",
        cashier: user?.fullName ?? "Pharmacy cashier",
        customer: saleCustomer ?? { id: "opd-customer", name: t("OPD patient"), phone: "" },
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
      setCart([]); setCustomer(null); setCustomerQuery(""); setSaleDiscount(0); setPaymentLines([{ id: nextPaymentId(), amount: "", accountId: accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "", paymentMethod: "cash" }]); setCartOpen(false); setCheckoutOpen(false);
      await loadProducts(); await loadSession(branchId);
      setNotice(`${t(status === "completed" ? "Sale completed" : "Sale saved as pending")}${invoice ? ` · ${t("Invoice")} ${invoice}` : ""}.`);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  }

  const customerPicker = <div className="pos-customer-wrap">
        {customer ? <div className="pos-selected-customer"><span className="pos-customer-icon"><UserRound size={16} /></span><span><strong>{language === "bn" ? customer.nameBangla || customer.name : customer.name}</strong><small>{customer.phone} · {t("Due")} {money(numeric(customer.balance))}</small></span><button className="pos-icon-action" onClick={() => { setCustomer(null); setCustomerQuery(""); setCustomerOpen(true); }} aria-label={t("Change customer")} title={t("Change customer")}><X size={15} /></button></div> : <><label className="pos-field-caption" htmlFor="customer-search">{t("Customer")} <span>{t("optional")}</span></label><div className="pos-input-with-icon"><UserRound size={16} /><input id="customer-search" value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerOpen(true); }} onFocus={() => setCustomerOpen(true)} placeholder={t("Search name or phone")} autoComplete="off" onKeyDown={(event) => { if (event.key === "Escape") setCustomerOpen(false); if (event.key === "Enter" && customers[0]) { event.preventDefault(); setCustomer(customers[0]); setCustomerQuery(""); setCustomerOpen(false); } }} /></div><small className="pos-opd-hint">{t("If you leave this blank, the sale will use the default OPD patient.")}</small>{customerOpen && customerQuery.trim() && <div className="pos-customer-options">{customerSearchLoading ? <div className="pos-customer-search-state">{t("Searching customers…")}</div> : customerSearchError ? <div className="pos-customer-search-state is-error">{t(customerSearchError)}</div> : customers.length > 0 ? customers.map((item) => <button key={item.id} type="button" onClick={() => { setCustomer(item); setCustomerQuery(""); setCustomerOpen(false); }}><strong>{language === "bn" ? item.nameBangla || item.name : item.name}</strong><small>{item.phone} · {t("Balance")} {money(numeric(item.balance))}</small></button>) : <div className="pos-customer-search-state">{t("No matching customer found.")}</div>}</div>}</>}
      </div>

  const cartContent = <>
    <div className="pos-cart-heading"><div><h2>{t("Current sale")}</h2><p>{totalUnits} {t(totalUnits === 1 ? "item" : "items")}</p></div><button className="pos-icon-action pos-cart-close" onClick={() => setCartOpen(false)} aria-label={t("Close cart")}><X size={18} /></button></div>
    <div className="pos-cart-lines">
      {cart.length === 0 ? <div className="pos-empty-cart"><span><ShoppingBag size={21} /></span><strong>{t("Your cart is empty")}</strong><small>{t("Search or scan a medicine to begin.")}</small></div> : cart.map((line) => <div className="pos-cart-line" key={line.stock.id}>
        <div className="pos-line-main"><div><strong>{medicineName(line.medicine)}</strong><small>{line.medicine.strength || line.medicine.genericName || t("Medicine")}</small><select className="pos-batch-select" aria-label={`${t("Batch for")} ${medicineName(line.medicine)}`} value={line.stock.id} onChange={(event) => { const nextStock = (line.medicine.stocks ?? []).find((stock) => stock.id === event.target.value); if (nextStock) setCart((current) => current.map((entry) => entry.stock.id === line.stock.id ? { ...entry, stock: nextStock, quantity: Math.min(entry.quantity, nextStock.quantity), price: numeric(entry.medicine.salePrice) || numeric(nextStock.mrp) || entry.price } : entry)); }}>{(line.medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).map((stock) => <option key={stock.id} value={stock.id}>{t("Batch")} {stock.batchNumber} · {t("exp")} {new Date(stock.expiryDate).toLocaleDateString(locale)} · {stock.quantity} {t("available")}</option>)}</select></div><button className="pos-icon-action pos-remove" onClick={() => setCart((current) => current.filter((item) => item.stock.id !== line.stock.id))} aria-label={`${t("Remove")} ${medicineName(line.medicine)}`}><Trash2 size={15} /></button></div>
        <div className="pos-line-controls"><div className="pos-quantity-stepper"><button onClick={() => changeLine(line.stock.id, { quantity: line.quantity - 1 })} aria-label={t("Decrease quantity")}><Minus size={13} /></button><input aria-label={t("Quantity")} inputMode="numeric" value={line.quantity} onChange={(event) => { const next = Math.floor(numeric(event.target.value)) || 1; changeLine(line.stock.id, { quantity: Math.max(1, Math.min(line.stock.quantity, next)) }); }} /><button onClick={() => changeLine(line.stock.id, { quantity: Math.min(line.stock.quantity, line.quantity + 1) })} aria-label={t("Increase quantity")} disabled={line.quantity >= line.stock.quantity}><Plus size={13} /></button></div><span className="pos-stock-hint">{line.stock.quantity} {line.stock.unit} {t("available")}</span><strong className="pos-line-total">{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>
      </div>)}
    </div>
    <div className="pos-cart-summary"><span>{t("Cart subtotal")}<small>{totalUnits} {t(totalUnits === 1 ? "unit" : "units")} · {t("discounts at checkout")}</small></span><strong>{money(subtotal)}</strong></div>
    <div className="pos-cart-footer">{canCreateSales ? <><button className="pos-proceed-button" type="button" disabled={cart.length === 0} onClick={() => { setError(""); setCheckoutOpen(true); setCartOpen(false); }}><span>{t("Proceed to checkout")}</span><span>{money(subtotal)} <ChevronRight size={16}/></span></button></> : <small>{t("Your role can view this cart but cannot create sales.")}</small>}</div>
  </>;

  const checkoutContent = <>
    <div className="pos-checkout-heading"><div><p className="eyebrow">{t("STEP 2 OF 2 · CHECKOUT")}</p><h2 id="pos-checkout-title">{t("Review & pay")}</h2><p>{totalUnits} {t(totalUnits === 1 ? "unit" : "units")} · {customer ? language === "bn" ? customer.nameBangla || customer.name : customer.name : t("OPD patient (default)")}</p></div><button type="button" className="pos-checkout-back" onClick={() => { setCheckoutOpen(false); if (window.matchMedia("(max-width: 1050px)").matches) setCartOpen(true); }}><ChevronRight size={15}/> {t("Back to cart")}</button></div>
    {error && <div className="pos-alert pos-alert-error pos-checkout-error" role="alert"><CircleAlert size={16}/><span>{error}</span></div>}
    <div className="pos-checkout-body">
      <section className="pos-checkout-customer" aria-label={t("Customer optional")}>
        <div className="pos-checkout-section-top"><div><h3>{t("Customer details")}</h3><small>{t("Select a customer or continue as an OPD patient.")}</small></div>{canCreateCustomers && <button type="button" className="pos-checkout-add-button" aria-expanded={customerQuickOpen} onClick={() => { setError(""); setCustomerQuickOpen((open) => !open); }}><Plus size={15}/>{t("Add customer")}</button>}</div>
        {customerPicker}
        {customerQuickOpen && canCreateCustomers && <div className="pos-checkout-quick-form"><div className="pos-checkout-quick-grid">
          <label>{t("Full name")}<input autoComplete="name" value={customerQuickForm.name} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, name: event.target.value }))}/></label>
          <label>{t("Phone")}<input autoComplete="tel" type="tel" value={customerQuickForm.phone} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, phone: event.target.value }))}/></label>
          <label>{t("Age")}<input type="number" step="1" min="0" value={customerQuickForm.age} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, age: event.target.value }))}/></label>
          <label>{t("Gender")}<select value={customerQuickForm.gender} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, gender: event.target.value }))}><option value="male">{t("Male")}</option><option value="female">{t("Female")}</option><option value="other">{t("Other")}</option></select></label>
        </div><div className="pos-checkout-quick-actions"><button type="button" disabled={customerQuickSaving} onClick={() => setCustomerQuickOpen(false)}>{t("Cancel")}</button><button type="button" disabled={customerQuickSaving} className="pos-checkout-save" onClick={() => void createCheckoutCustomer()}>{customerQuickSaving ? t("Saving…") : t("Save & select customer")}</button></div></div>}
      </section>
      <section className="pos-checkout-items" aria-label={t("Sale items")}><h3>{t("Items & item discounts")}</h3>{cart.map((line) => <div className="pos-checkout-item" key={line.stock.id}><span><strong>{medicineName(line.medicine)}</strong><small>{line.quantity} {line.stock.unit} · {line.stock.batchNumber}</small></span><label><span>{t("Discount")}</span><div className="pos-item-discount-input"><input type="number" min="0" max="100" value={line.discountPercent} onChange={(event) => changeLine(line.stock.id, { discountPercent: Math.min(100, Math.max(0, numeric(event.target.value))) })}/><b>%</b></div></label><strong>{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>)}</section>
      <div className="pos-checkout-section-top pos-checkout-discount-heading"><div><h3>{t("Discount & VAT")}</h3><small>{t("VAT rate comes from pharmacy settings.")}</small></div></div><div className="pos-discount-row"><span>{t("Sale discount")}</span><div className="pos-discount-input"><input type="number" min="0" max={discountMode === "percent" ? 100 : saleEligible} value={saleDiscount} onChange={(event) => setSaleDiscount(Math.min(discountMode === "percent" ? 100 : saleEligible, Math.max(0, numeric(event.target.value))))} /><select aria-label={t("Discount type")} value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">BDT</option></select></div></div>
      <div className="pos-total-row"><span>{t("Subtotal")}</span><span>{money(subtotal)}</span></div><div className="pos-total-row"><span>{t("Item discount")}</span><span>−{money(itemDiscount)}</span></div><div className="pos-total-row"><span>{t("Sale discount")}</span><span>−{money(actualSaleDiscount)}</span></div><div className="pos-total-row"><span>{t("Tax · exclusive")} {taxPercent}%</span><span>{money(taxAmount)}</span></div>
      <div className="pos-grand-total"><span>{t("Total due")}</span><strong>{money(total)}</strong></div>
      <div className="pos-checkout-section-top pos-checkout-payment-heading"><div><h3>{t("Payment details")}</h3><small>{t("Choose payment methods and accounts.")}</small></div>{canCreateAccounts && <button type="button" className="pos-checkout-add-button" aria-expanded={accountQuickOpen} onClick={() => { setError(""); setAccountQuickOpen((open) => !open); }}><Plus size={15}/>{t("Add account")}</button>}</div>
      {accountQuickOpen && canCreateAccounts && <div className="pos-checkout-quick-form"><div className="pos-checkout-quick-grid"><label>{t("Account name")}<input value={accountQuickForm.name} onChange={(event) => setAccountQuickForm((form) => ({ ...form, name: event.target.value }))}/></label><label>{t("Account type")}<select value={accountQuickForm.type} onChange={(event) => setAccountQuickForm((form) => ({ ...form, type: event.target.value }))}><option value="cash">{t("Cash")}</option><option value="bank">{t("Bank")}</option><option value="mfs">{t("Mobile financial service")}</option></select></label></div><p>{t("New pharmacy accounts start with zero opening balance.")}</p><div className="pos-checkout-quick-actions"><button type="button" disabled={accountQuickSaving} onClick={() => setAccountQuickOpen(false)}>{t("Cancel")}</button><button type="button" disabled={accountQuickSaving} className="pos-checkout-save" onClick={() => void createCheckoutAccount()}>{accountQuickSaving ? t("Saving…") : t("Save account")}</button></div></div>}
      <div className="pos-tender-heading"><span>{t("Collected now")}</span><strong>{money(paid)}</strong></div>
      <div className="pos-tender-lines">{paymentLines.map((line, index) => <div className="pos-tender-line" key={line.id}><label><span>{t("Method")}</span><select value={line.paymentMethod} onChange={(event) => updatePaymentLine(line.id, { paymentMethod: event.target.value as (typeof methods)[number] })}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label><span>{t("Account")}</span><select value={line.accountId} onChange={(event) => updatePaymentLine(line.id, { accountId: event.target.value })}><option value="">{t("Select account")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></label><label><span>{t("Amount")}</span><span className="pos-currency-input"><b>৳</b><input type="number" min="0" step="0.01" inputMode="decimal" placeholder={paymentLines.length === 1 && index === 0 ? total.toFixed(2) : "0.00"} value={line.amount} onChange={(event) => updatePaymentLine(line.id, { amount: event.target.value })} /></span></label>{paymentLines.length > 1 && <button type="button" className="pos-icon-action pos-tender-remove" aria-label={`${t("Remove payment")} ${index + 1}`} onClick={() => removePaymentLine(line.id)}><X size={14}/></button>}</div>)}</div>
      <button type="button" className="pos-add-tender" onClick={addPaymentLine} disabled={saving || paymentLines.length >= 8}><Plus size={14}/> {t("Add payment method")}</button>
      <div className="pos-due-row"><span>{t("Remaining due")}</span><strong>{money(due)}</strong></div>
    </div>
    {canCreateSales&&<div className="pos-checkout-actions"><button className="pos-complete-button" type="button" disabled={saving || cart.length === 0} onClick={() => setConfirmStatus("completed")}><Check size={17} />{saving ? t("Saving sale…") : t("Review & confirm sale")}</button><button className="pos-pending-button" type="button" disabled={saving || cart.length === 0} onClick={() => setConfirmStatus("pending")}>{t("Save as pending")}</button><small className="pos-checkout-note">{t("Stock is deducted only after a completed sale.")}</small></div>}
  </>;

  return <section className="pos-page">
    {(error || notice) && <div className={`pos-alert ${error ? "pos-alert-error" : "pos-alert-success"}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{t(error || notice)}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label={t("Dismiss message")}><X size={15}/></button></div>}
    <div className="pos-workspace">
      <div className="pos-catalog panel">
        <div className="pos-catalog-top"><div><h2>{t("Medicine catalog")}</h2><p>{t("Search by name, generic or barcode")}</p></div><span className="pos-catalog-branch">{activeBranch?.name ?? t("Select a branch")}</span><details className="pos-utility-menu"><summary><span>{session ? t("Register open") : t("Register closed")}</span><ChevronDown size={14}/></summary><div className="pos-utility-popover"><p>{activeBranch?.name ?? t("No branch selected")}{session && <small>{t("Session")} {String(session.sessionNumber ?? session.id ?? "active").slice(0, 12)}</small>}</p>{canCreateSales&&(session ? <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setError(""); setActualBalance(String(numeric(session.closingBalance))); setClosing(true); }}>{t("Close register")}</button> : <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setOpening(true); }}>{t("Open register")}</button>)}{canReadSales&&<button type="button" disabled={!branchId} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setHistoryOpen(true); setSelectedHistory(null); setHistoryPage(1); setHistoryStatus(""); void loadRegisterHistory(1, ""); }}><Clock3 size={14}/>{t("Register history")}</button>}</div></details></div>
        <div className="pos-search-row"><div className="pos-search-box"><Search size={18}/><input autoFocus placeholder={t("Search medicine or scan barcode…")} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) { event.preventDefault(); void scanBarcode(query); } }} /><kbd>Enter</kbd>{query && <button type="button" aria-label={t("Clear search")} onClick={() => setQuery("")}><X size={16}/></button>}</div><button type="button" className="pos-scan-button" onClick={() => document.querySelector<HTMLInputElement>(".pos-search-box input")?.focus()}><Barcode size={17}/><span>{t("Barcode")}</span></button></div>
        <div className="pos-filter-popover-wrap"><div className="pos-filter-toolbar"><button aria-expanded={filtersOpen} aria-controls="pos-filter-popover" className={`pos-filter-button ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}{activeFilterCount > 0 && <span className="pos-filter-count">{activeFilterCount}</span>}<ChevronDown size={14}/></button>{activeFilterCount > 0 && <button className="pos-clear-filters" onClick={() => { setCategoryId(""); setGenericId(""); setManufacturerId(""); setGroupId(""); setUnitId(""); setFormulation(""); setStrength(""); setInStockOnly(false); }}>{t("Clear filters")}</button>}</div>
        {filtersOpen && <div id="pos-filter-popover" className="pos-filter-drawer"><label><span>{t("Category")}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{t("All categories")}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Generic")}</span><select value={genericId} onChange={(event) => setGenericId(event.target.value)}><option value="">{t("All generics")}</option>{generics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Manufacturer")}</span><select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)}><option value="">{t("All manufacturers")}</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Group")}</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{t("All groups")}</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Unit")}</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{t("All units")}</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Dosage form")}</span><input placeholder={t("e.g. Tablet")} value={formulation} onChange={(event) => setFormulation(event.target.value)}/></label><label><span>{t("Strength")}</span><input placeholder={t("e.g. 500 mg")} value={strength} onChange={(event) => setStrength(event.target.value)}/></label><label className="pos-stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)}/> {t("In stock only")}</label></div>}</div>
        <div className="pos-results-meta"><span>{loading ? t("Loading catalog…") : catalogRefreshing ? t("Updating results…") : `${visibleMedicines.length} ${t(unitId ? "matching" : "shown")}${!unitId && totalProducts > medicines.length ? ` ${t("of")} ${totalProducts - medicines.length}` : ""} ${t("medicines")}`}</span><span><span className="pos-dot-green"/> {t("Batch stock · selected branch")}</span></div>
        <div className="pos-product-grid">{visibleMedicines.map((medicine) => {
          const available = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).reduce((sum, stock) => sum + stock.quantity, 0);
          const earliest = (medicine.stocks ?? []).filter((stock) => stock.branchId === branchId && stock.quantity > 0).sort((a,b) => a.expiryDate.localeCompare(b.expiryDate))[0];
          return <button type="button" key={medicine.id} className={`pos-product-card ${available === 0 ? "out-of-stock" : ""}`} onClick={() => addMedicine(medicine)} disabled={available === 0 || !canCreateSales}>
            <span className="pos-product-icon"><Package size={19}/></span><span className="pos-product-copy"><strong>{medicineName(medicine)}</strong><small>{[medicine.strength, medicine.dosageForm || medicine.genericName].filter(Boolean).join(" · ") || t("Pharmacy medicine")}</small><small className="pos-product-brand">{medicine.medicineManufacturer?.name || medicine.category?.name || t("Catalog item")}</small></span><span className={`pos-stock-badge ${available > 0 ? "" : "empty"}`}>{available > 0 ? `${available} ${medicine.unit || t("pcs")}` : t("Out of stock")}</span><span className="pos-product-bottom"><span><strong>{money(numeric(medicine.salePrice) || numeric(earliest?.mrp) || numeric(medicine.mrp))}</strong><small>{earliest ? `${t("Batch")} ${earliest.batchNumber}` : medicine.barcode || t("No batch")}</small></span><span className="pos-add-icon"><Plus size={17}/></span></span>
          </button>;
        })}{!loading && visibleMedicines.length === 0 && <div className="pos-no-products"><Package size={22}/><strong>{t("No matching medicines")}</strong><span>{unitId && hasMoreProducts ? t("Load more results to find medicines in this unit.") : t("Try another name or clear some filters.")}</span></div>}</div>
        {hasMoreProducts && <button type="button" className="pos-load-more" disabled={loading} onClick={() => void loadProducts(productPage + 1, true)}>{loading ? t("Loading more…") : `${t("Load more medicines")}${!unitId && totalProducts > medicines.length ? ` · ${totalProducts - medicines.length} ${t("remaining")}` : ""}`}</button>}
        <div className="pos-catalog-footer"><span><Activity size={14}/> {t("Prices and batch availability come from current stock.")}</span><span>{t("Whole-unit quantities only")}</span></div>
      </div>
      <aside className="pos-cart-panel panel">{cartContent}</aside>
    </div>
    <button className="pos-mobile-cart-bar" onClick={() => setCartOpen(true)} aria-label={t("Open current sale")}><span className="pos-mobile-cart-icon"><ShoppingCart size={18}/><i>{totalUnits}</i></span><span><strong>{totalUnits} {t(totalUnits === 1 ? "item" : "items")}</strong><small>{t("Tap to review order")}</small></span><strong className="pos-mobile-cart-total">{money(total)}</strong><ChevronRight size={17}/></button>
    {cartOpen && <div className="pos-cart-modal-backdrop" role="presentation" onClick={() => setCartOpen(false)}><div className="pos-cart-modal" role="dialog" aria-modal="true" aria-label={t("Current sale")} onClick={(event) => event.stopPropagation()}>{cartContent}</div></div>}
    {checkoutOpen && <div className="pos-checkout-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="pos-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-checkout-title" onClick={(event) => event.stopPropagation()}>{checkoutContent}</section></div>}
    {confirmStatus && <div className="pos-confirm-backdrop" role="presentation" onClick={() => { if (!saving) setConfirmStatus(null); }}><section className="pos-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-confirm-title" onClick={(event) => event.stopPropagation()}><div className="pos-confirm-icon"><ShoppingBag size={21}/></div><h2 id="pos-confirm-title">{t(confirmStatus === "completed" ? "Confirm completed sale" : "Confirm pending sale")}</h2><p>{t("Review customer, discount, VAT and payment before saving.")}</p><div className="pos-confirm-items">{cart.map((line) => <div key={line.stock.id}><span><strong>{medicineName(line.medicine)}</strong><small>{t("Batch")} {line.stock.batchNumber} · {line.quantity} {line.stock.unit}</small></span><strong>{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>)}</div><dl><div><dt>{t("Branch")}</dt><dd>{activeBranch?.name ?? "—"}</dd></div><div><dt>{t("Customer")}</dt><dd>{customer?.name ?? t("OPD patient (default)")}</dd></div><div><dt>{t("Items")}</dt><dd>{totalUnits}</dd></div><div><dt>{t("Subtotal")}</dt><dd>{money(subtotal)}</dd></div><div><dt>{t("Item discount")}</dt><dd>−{money(itemDiscount)}</dd></div><div><dt>{t("Sale discount")}</dt><dd>−{money(actualSaleDiscount)}</dd></div><div><dt>{t("VAT / Tax")} ({taxPercent}%)</dt><dd>{money(taxAmount)}</dd></div><div className="pos-confirm-total"><dt>{t("Grand total")}</dt><dd>{money(total)}</dd></div><div><dt>{t("Collected now")}</dt><dd>{money(paid)}</dd></div><div><dt>{t("Remaining due")}</dt><dd>{money(due)}</dd></div></dl><div className="pos-confirm-payments">{paymentLines.filter((line) => numeric(line.amount) > 0).map((line) => <div key={line.id}><span>{line.paymentMethod} · {accounts.find((account) => account.id === line.accountId)?.name ?? t("Select account")}</span><strong>{money(numeric(line.amount))}</strong></div>)}</div><small>{t(confirmStatus === "completed" ? "Completed sales deduct stock from selected batches." : "Pending sales do not deduct stock.")}</small><div className="pos-confirm-actions"><button type="button" onClick={() => setConfirmStatus(null)} disabled={saving}>{t("Back to checkout")}</button><button type="button" className="pos-complete-button" disabled={saving} onClick={() => { if (confirmStatus) { const status = confirmStatus; setConfirmStatus(null); void submitSale(status); } }}><Check size={17}/>{t(confirmStatus === "completed" ? "Confirm & complete sale" : "Save pending sale")}</button></div></section></div>}
    {receipt && <div className="pos-receipt-backdrop" role="presentation"><section className="pos-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title"><div className="pos-receipt-actions"><button type="button" className="pos-dialog-cancel" onClick={() => setReceipt(null)}>{t("Close")}</button><button type="button" className="pos-complete-button" onClick={() => window.print()}><Check size={15}/> {t("Print receipt")}</button></div><div className="pos-receipt-paper"><header><span className="pos-receipt-mark"><Pill size={17}/></span><h2 id="pos-receipt-title">{t(receipt.status === "pending" ? "Sale slip" : "Sales receipt")}</h2><strong>{receipt.branch}</strong><small>{t("Pharmacy POS")}</small></header><div className="pos-receipt-meta"><span>{t("Invoice")} <strong>{receipt.invoice}</strong></span><span>{t("Status")} <strong>{t(receipt.status)}</strong></span><span>{t("Date")} <strong>{new Date(receipt.date).toLocaleString(locale, { timeZone: "Asia/Dhaka" })}</strong></span><span>{t("Cashier")} <strong>{receipt.cashier}</strong></span></div><div className="pos-receipt-customer"><small>{t("Customer")}</small><strong>{receipt.customer.name}</strong><span>{receipt.customer.phone}</span></div><div className="pos-receipt-items"><div className="pos-receipt-table-head"><span>{t("Item")}</span><span>{t("Qty")}</span><span>{t("Total")}</span></div>{receipt.items.map((item, index) => <div className="pos-receipt-item" key={`${item.name}-${item.batch}-${index}`}><span><strong>{item.name}</strong><small>{item.description || item.unit} · {t("Batch")} {item.batch}</small><small>{money(item.price)} × {item.quantity}{item.discount ? ` · ${t("Discount")} ${money(item.discount)}` : ""}</small></span><b>{item.quantity}</b><strong>{money(item.total)}</strong></div>)}</div><div className="pos-receipt-totals"><span>{t("Subtotal")}<strong>{money(receipt.subtotal)}</strong></span><span>{t("Item discount")}<strong>−{money(receipt.itemDiscount)}</strong></span><span>{t("Sale discount")}<strong>−{money(receipt.saleDiscount)}</strong></span><span>{t("Tax · exclusive")} {receipt.taxPercent}%<strong>{money(receipt.taxAmount)}</strong></span><span className="pos-receipt-grand">{t("Total")}<strong>{money(receipt.total)}</strong></span><span>{t("Paid")}<strong>{money(receipt.paid)}</strong></span><span>{t("Due")}<strong>{money(receipt.due)}</strong></span></div>{receipt.payments.length > 0 && <div className="pos-receipt-payments"><small>{t("Payment breakdown")}</small>{receipt.payments.map((payment, index) => <span key={`${payment.method}-${index}`}>{payment.method} · {payment.account}<strong>{money(payment.amount)}</strong></span>)}</div>}<footer>{t("Thank you. Please keep this receipt for your records.")}</footer></div></section></div>}
    {opening && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => setOpening(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-dialog-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setOpening(false)} aria-label={t("Close")}><X size={17}/></button><h2 id="register-dialog-title">{t("Open cash register")}</h2><p>{t("Record the opening float for ")}{activeBranch?.name || t("this branch")}. {t("This starts your cashier session.")}</p><label><span>{t("Opening cash balance")}</span><span className="pos-currency-input"><b>৳</b><input autoFocus inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></span></label>{accounts.length === 0 && <div className="pos-dialog-warning">{t("No active cash or payment accounts were found. A sale with collected payment needs an active account.")}</div>}{error && <div className="pos-dialog-error">{t(error)}</div>}<button className="pos-complete-button" disabled={saving || !branchId} onClick={() => void openRegister()}>{saving ? t("Opening…") : t("Open register")}</button><button className="pos-dialog-cancel" onClick={() => { setOpening(false); setError(""); }}>{t("Cancel")}</button></div></div>}
    {closing && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setClosing(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-close-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setClosing(false)} aria-label={t("Close")} disabled={saving}><X size={17}/></button><h2 id="register-close-title">{t("Close cash register")}</h2><p>{t("Count the cash in the drawer and record any difference before ending this cashier session.")}</p><div className="pos-register-expected"><span>{t("Expected cash balance")}</span><strong>{money(numeric(session?.closingBalance))}</strong></div><label><span>{t("Actual cash balance")}</span><span className="pos-currency-input"><b>৳</b><input autoFocus inputMode="decimal" min="0" type="number" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} /></span></label><div className="pos-register-expected"><span>{t("Difference")}</span><strong>{money(numeric(actualBalance) - numeric(session?.closingBalance))}</strong></div><label className="pos-register-note"><span>{t("Closing note")} <small>{t("Optional")}</small></span><textarea rows={3} maxLength={500} placeholder={t("Explain a cash shortage or overage")} value={closingNote} onChange={(event) => setClosingNote(event.target.value)} /></label>{error && <div className="pos-dialog-error">{t(error)}</div>}<button className="pos-complete-button" disabled={saving || actualBalance.trim() === ""} onClick={() => void closeRegister()}>{saving ? t("Closing…") : t("Close register")}</button><button className="pos-dialog-cancel" disabled={saving} onClick={() => { setClosing(false); setError(""); }}>{t("Cancel")}</button></div></div>}
    {historyOpen && <div className="pos-dialog-backdrop pos-history-backdrop" role="presentation" onClick={() => setHistoryOpen(false)}><div className="pos-history-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-history-title" onClick={(event) => event.stopPropagation()}><div className="pos-history-heading"><div><p className="eyebrow">{t("CASH MANAGEMENT")}</p><h2 id="pos-history-title">{t("Register history")}</h2><p>{t("Sessions for ")}{activeBranch?.name || t("this branch")}</p></div><button className="pos-icon-action" onClick={() => setHistoryOpen(false)} aria-label={t("Close history")}><X size={17}/></button></div>{selectedHistory ? <><button className="pos-history-back" onClick={() => setSelectedHistory(null)}>‹ {t("Back to sessions")}</button><div className="pos-history-detail"><div><span>{t("Session status")}</span><strong className={`pos-history-status ${String(selectedHistory.status ?? "").toLowerCase()}`}>{t(String(selectedHistory.status ?? "unknown"))}</strong></div><div><span>{t("Opened")}</span><strong>{selectedHistory.createdAt ? new Date(String(selectedHistory.createdAt)).toLocaleString(locale) : "—"}</strong></div><div><span>{t("Opening balance")}</span><strong>{money(numeric(selectedHistory.openingBalance))}</strong></div><div><span>{t("Expected balance")}</span><strong>{money(numeric(selectedHistory.closingBalance))}</strong></div><div><span>{t("Counted balance")}</span><strong>{selectedHistory.actualBalance == null ? "—" : money(numeric(selectedHistory.actualBalance))}</strong></div><div><span>{t("Difference")}</span><strong>{selectedHistory.difference == null ? "—" : money(numeric(selectedHistory.difference))}</strong></div>{Boolean(selectedHistory.closedAt) && <div><span>{t("Closed")}</span><strong>{new Date(String(selectedHistory.closedAt)).toLocaleString(locale)}</strong></div>}{Boolean(selectedHistory.closingNote) && <p className="pos-history-note">{String(selectedHistory.closingNote)}</p>}</div><h3 className="pos-history-sales-title">{t("Sales in this session")}</h3><div className="pos-history-sales">{rows<Row>(selectedHistory.sales).map((sale) => <div key={String(sale.id)}><span><strong>{String(sale.invoiceNumber ?? sale.id ?? t("Sale"))}</strong><small>{sale.createdAt ? new Date(String(sale.createdAt)).toLocaleString(locale) : ""}</small></span><strong>{money(numeric(sale.netPrice))}</strong></div>)}{rows<Row>(selectedHistory.sales).length === 0 && <p className="pos-history-empty">{t("No linked sales are recorded for this session.")}</p>}</div></> : <><div className="pos-history-toolbar"><label><span>{t("Status")}</span><select value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value); void loadRegisterHistory(1, event.target.value); }}><option value="">{t("All sessions")}</option><option value="open">{t("open")}</option><option value="closed">{t("closed")}</option></select></label><span>{t("Page")} {historyPage}</span></div>{historyError && <div className="pos-dialog-error">{t(historyError)}</div>}<div className="pos-history-list">{historySessions.map((item) => <button type="button" key={String(item.id)} onClick={() => void openRegisterSession(String(item.id))}><span className="pos-history-session-main"><strong>{t("Session")} {String(item.sessionNumber ?? item.id ?? "").slice(0, 12)}</strong><small>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString(locale) : t("Date unavailable")}</small></span><span className={`pos-history-status ${String(item.status ?? "").toLowerCase()}`}>{t(String(item.status ?? "unknown"))}</span><strong>{money(numeric(item.actualBalance ?? item.closingBalance))}</strong><ChevronRight size={15}/></button>)}{!historyLoading && historySessions.length === 0 && <p className="pos-history-empty">{t("No register sessions match this branch and filter.")}</p>}</div>{historyLoading && <p className="pos-history-loading">{t("Loading register sessions…")}</p>}<div className="pos-history-pagination"><button type="button" disabled={historyLoading || historyPage <= 1} onClick={() => void loadRegisterHistory(historyPage - 1)}>{t("Previous")}</button><button type="button" disabled={historyLoading || historySessions.length < 10} onClick={() => void loadRegisterHistory(historyPage + 1)}>{t("Next")}</button></div></>}</div></div>}
  </section>;
}
