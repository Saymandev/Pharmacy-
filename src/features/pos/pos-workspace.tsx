"use client";

import { useBrowserPreference } from "@/lib/browser/use-browser-preference";
import { QuantityInput } from "./quantity-input";
import { PosCalculator } from "./pos-calculator";
import { CatalogList } from "./catalog-list";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, LayoutGrid, List, Pause, Maximize2, Minimize2, Activity, Barcode, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, Filter, Minus, Package, Plus, Search, ShoppingBag, ShoppingCart, Trash2, UserRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import { sellableStocks, chooseAvailableStock } from "./stock-selection";
import { allocatePayments } from "./payment-allocation";
import { unwrapSavedSale, savedAmount } from "./sale-response";
import { registerAmount, registerExpected, registerDifference, registerCloseError } from "./register-policy";
import { ReceiptPreview } from "@/features/receipts/receipt-preview";
import { BarcodeScanner } from "./barcode-scanner";
import { exactBarcodeMatch } from "./barcode-policy";
import { useDismissiblePanel } from "@/lib/use-dismissible-panel";
import { readPagination } from "@/lib/api/pagination";

const catalogViews = ["cards", "list", "table"] as const;
type Row = Record<string, unknown>;
import type {Stock,Medicine} from "./pos-types";
type Customer = { id: string; name: string; nameBangla?: string; phone: string; balance?: number; customerNumber?: string };
type Account = { id: string; name: string; type: string; currentBalance?: number };
type CartLine = { medicine: Medicine; stock: Stock; quantity: number; price: number; discountPercent: number };
type FilterOption = { id: string; name: string };
const methods = ["cash", "card", "online", "cheque", "bKash", "Nagad", "Rocket", "Bank Transfer"] as const;
type PaymentLine = { id: string; amount: string; accountId: string; paymentMethod: (typeof methods)[number] };
type Receipt = import("@/features/receipts/receipt-model").ReceiptDocument;

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
  const { activeBranchId: branchId, activeBranch } = useActiveBranch();
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
  const [scannerOpen,setScannerOpen]=useState(false);
  const [scanPending,setScanPending]=useState(0);
  const [searchCommitting,setSearchCommitting]=useState(false);
  const searchCommitLock=useRef(false),querySnapshot=useRef("");
  const [catalogKey,setCatalogKey]=useState("");
  const [keyboardProduct, setKeyboardProduct] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanel = useDismissiblePanel(filtersOpen, useCallback(() => setFiltersOpen(false), []));
  const [expanded, setExpanded] = useState(true);
  const cartDialog = useRef<HTMLDialogElement>(null);
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
  const [savedView, setViewMode] = useBrowserPreference<"cards" | "list" | "table">("pharmacy.pos-view", "cards", catalogViews);
  const viewMode = savedView === "table" ? "list" : savedView;
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [quickStockId, setQuickStockId] = useState("");
  const [quantityFocus, requestQuantityFocus] = useState(0);
  const quickQuantity = useRef<HTMLInputElement>(null);
  const quickLine = cart.find(line => line.stock.id === quickStockId) ?? cart.at(-1);
  useEffect(() => { if (quantityFocus) { quickQuantity.current?.focus(); quickQuantity.current?.select(); } }, [quantityFocus]);
  const searchInput = useRef<HTMLInputElement>(null);
  const submissionLock = useRef(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldCarts, setHeldCarts] = useState<{ id: string; branchId: string; cart: CartLine[]; customer: Customer | null; discount: number; discountMode: "percent" | "fixed"; payments: PaymentLine[]; createdAt: string }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => {
    if (!cartOpen) return;
    const dialog = cartDialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [cartOpen]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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
  const [openingNote,setOpeningNote]=useState("");
  const [registerBranch,setRegisterBranch]=useState("");
  const currentBranch=useRef(branchId);
  const historyRequest=useRef(0);
  const [historyMeta,setHistoryMeta]=useState({total:0,totalPages:1,hasNextPage:false});
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

  useEffect(()=>{currentBranch.current=branchId;historyRequest.current++;sessionRequestId.current++;const timer=window.setTimeout(()=>{setHistoryOpen(false);setSelectedHistory(null);setClosing(false);setOpening(false);setSession(null);setScannerOpen(false);setScanPending(0);},0);return ()=>window.clearTimeout(timer);},[branchId]);

  const selectionKey=JSON.stringify([branchId,query.trim(),categoryId,genericId,manufacturerId,groupId,unitId,formulation.trim(),strength.trim(),inStockOnly]);
  const selectionKeyRef=useRef(selectionKey);
  useEffect(()=>{selectionKeyRef.current=selectionKey;},[selectionKey]);
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
      const result = await api.getWithMeta<unknown>(`/pharmacy/medicines?${params.toString()}`);
      if (requestId !== productRequestId.current) return;
      const items = rows<Medicine>(result);
      setCatalogKey(selectionKey);
      productsLoaded.current = true;
      setMedicines((current) => append ? [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))] : items);
      const summary = readPagination(result, items.length, page, limit);
      setProductPage(page);
      setTotalProducts(summary.total);
      setHasMoreProducts(summary.hasNextPage);
      setError("");
    } catch (cause) {
      if (requestId === productRequestId.current) {
        productsLoaded.current = true;
        setError(getError(cause));
      }
    } finally { if (requestId === productRequestId.current) { setLoading(false); setCatalogRefreshing(false); } }
  }, [branchId, categoryId, genericId, manufacturerId, groupId, unitId, formulation, strength, inStockOnly, query,selectionKey]);

  const loadSession = useCallback(async (id: string) => {
    if (!id) return;
    const requestId = ++sessionRequestId.current;
    try {
      const active = await api.get<unknown>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(id)}`);
      if (requestId === sessionRequestId.current && currentBranch.current===id) setSession(active && typeof active === "object" ? active as Row : null);
    } catch { if (requestId === sessionRequestId.current && currentBranch.current===id) setSession(null); }
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
      const reset = window.setTimeout(() => {
        setCustomers([]); setCustomerSearchLoading(false); setCustomerSearchError("");
      }, 0);
      return () => { window.clearTimeout(reset); customerRequestId.current += 1; };
    }
    const timer = window.setTimeout(async () => {
      setCustomerSearchLoading(true);
      setCustomerSearchError("");
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
  const paymentAllocation = useMemo(() => {
    try { return { ...allocatePayments(total, paymentLines), error: "" }; }
    catch (cause) { return { payments: [], tendered: 0, paid: 0, due: total, change: 0, error: cause instanceof Error ? cause.message : "Invalid payment." }; }
  }, [total, paymentLines]);
  const { paid, due, tendered, change } = paymentAllocation;
  const totalUnits = cart.reduce((sum, line) => sum + line.quantity, 0);
  const activeFilterCount = [categoryId, genericId, manufacturerId, groupId, unitId, formulation.trim(), strength.trim(), inStockOnly ? "stock" : ""].filter(Boolean).length;

  function addMedicine(medicine: Medicine, editQuantity = false) {
    if(!canCreateSales||saving||submissionLock.current)return false;
    if (cart.some((line) => line.stock.branchId !== branchId)) { setError(t("Hold the previous branch cart before adding items in this branch.")); return false; }
    const available = sellableStocks(medicine.stocks ?? [], branchId);
    if (!available.length) { setNotice(`${medicineName(medicine)} ${t(" has no sellable stock in this branch.")}`); return false; }
    const chosen = chooseAvailableStock(available, cart);
    if (!chosen) { setNotice(t("All available stock for this medicine is already in the cart.")); return false; }
    setCart((current) => {
      if(current.some(line=>line.stock.branchId!==branchId))return current;
      const chosen=chooseAvailableStock(available,current);if(!chosen)return current;
      const existing = current.find((line) => line.stock.id === chosen.id);
      if (existing) return current.map((line) => line.stock.id === chosen.id ? { ...line, quantity: Math.min(line.quantity + 1, Math.floor(chosen.quantity)) } : line);
      return [...current, { medicine, stock: chosen, quantity: 1, price: numeric(medicine.salePrice) || numeric(chosen.mrp) || numeric(medicine.mrp), discountPercent: 0 }];
    });
    setQuickStockId(chosen.id);
    if (editQuantity) requestQuantityFocus(value => value + 1);
    setNotice(available.length > 1 ? `${medicineName(medicine)}: ${t("Earliest-expiry batch selected. Change it in the cart if needed.")}` : "");
    return true;
  }
  async function commitSearch(){
    const value=query.trim();if(!value||searchCommitLock.current||!canCreateSales||saving)return;
    const capturedBranch=branchId,capturedKey=selectionKey;
    if(!capturedBranch)return;
    if(selectionKey===catalogKey&&!catalogRefreshing&&!/^\d+$/.test(value)){
      const match=exactBarcodeMatch(visibleMedicines,value)??visibleMedicines[Math.min(keyboardProduct,visibleMedicines.length-1)];
      if(match&&addMedicine(match, true)){setQuery("");querySnapshot.current="";setKeyboardProduct(0);}return;
    }
    searchCommitLock.current=true;setSearchCommitting(true);setError("");
    try{
      const params=new URLSearchParams({branchId:capturedBranch,isActive:"true",page:"1",limit:"60"});
      if(/^\d+$/.test(value))params.set("barcode",value);else params.set("search",value);
      if(inStockOnly)params.set("hasStock","true");if(categoryId)params.set("categoryId",categoryId);if(genericId)params.set("genericId",genericId);if(manufacturerId)params.set("medicineManufacturerId",manufacturerId);if(groupId)params.set("groupId",groupId);if(formulation.trim())params.set("dosageForm",formulation.trim());if(strength.trim())params.set("strength",strength.trim());
      let found=rows<Medicine>(await api.getWithMeta<unknown>(`/pharmacy/medicines?${params}`));
      if(currentBranch.current!==capturedBranch||selectionKeyRef.current!==capturedKey||querySnapshot.current.trim()!==value)return;
      if(unitId)found=found.filter(m=>m.medicineUnit?.id===unitId||units.find(u=>u.id===unitId)?.name===m.medicineUnit?.name||units.find(u=>u.id===unitId)?.name===m.unit);
      const match=exactBarcodeMatch(found,value)??(!/^\d+$/.test(value)?found[Math.min(keyboardProduct,found.length-1)]:undefined);
      if(!match){setNotice(t("No matching medicine. Check the search or use Barcode mode."));return;}
      if(addMedicine(match, true)){setQuery("");querySnapshot.current="";setKeyboardProduct(0);}
    }catch(cause){if(currentBranch.current===capturedBranch&&querySnapshot.current.trim()===value)setError(getError(cause));}finally{searchCommitLock.current=false;setSearchCommitting(false);}
  }
  const focusSearch = useCallback(() => {
    setCartOpen(false);
    window.requestAnimationFrame(() => { searchInput.current?.focus(); searchInput.current?.select(); });
  }, []);
  const openCheckout=useCallback(()=>{if(scanPending||searchCommitting){setNotice(t("Wait for pending scans or search before checkout."));return;}setError("");setCheckoutOpen(true);setCartOpen(false);},[scanPending,searchCommitting,t]);
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
    if(submissionLock.current||!canCreateSales)return;
    const amount=registerAmount(openingBalance);
    if(!branchId||registerBranch!==branchId){setError(t("The branch changed. Reopen the register dialog."));return;}
    if(amount===null){setError(t("Enter a cash balance of zero or more with at most two decimal places."));return;}
    const capturedBranch=branchId;submissionLock.current=true;setError("");setSaving(true);
    try {
      const active=await api.get<Row|null>(`/pharmacy/cash-register/active?branchId=${encodeURIComponent(capturedBranch)}`);
      if(currentBranch.current!==capturedBranch)return;
      if(active?.id){setSession(active);setError(t("A register is already open. Close this dialog and use the active session."));return;}
      const created=await api.post<Row>("/pharmacy/cash-register/open",{branchId:capturedBranch,openingBalance:amount,...(openingNote.trim()?{openingNote:openingNote.trim()}:{})});
      if(currentBranch.current!==capturedBranch)return;
      setSession(created);setOpening(false);setOpeningNote("");setNotice(t("Register opened. You can now complete sales."));await loadSession(capturedBranch);
    }catch(cause){if(currentBranch.current===capturedBranch)setError(getError(cause));}finally{submissionLock.current=false;setSaving(false);}
  }
  async function closeRegister() {
    if(submissionLock.current||!canCreateSales)return;
    const problem=registerCloseError(session,branchId,registerBranch,actualBalance);
    if(problem){setError(t(problem));return;}
    const capturedBranch=branchId,sessionId=String(session!.id),reviewedBalance=registerExpected(session!.closingBalance);
    submissionLock.current=true;setError("");setSaving(true);
    try {
      const fresh=await api.get<Row>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}`);
      if(currentBranch.current!==capturedBranch)return;
      setSession(fresh.status==="open"?fresh:null);
      const changed=registerCloseError(fresh,currentBranch.current,capturedBranch,actualBalance);
      if(changed){setError(t(changed));return;}
      if(registerExpected(fresh.closingBalance)!==reviewedBalance){setError(t("Expected balance changed. Review the updated difference, then close again."));return;}
      const result=await api.post<Row>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}/close`,{actualBalance:registerAmount(actualBalance),...(closingNote.trim()?{closingNote:closingNote.trim()}:{})});
      if(currentBranch.current!==capturedBranch)return;
      setClosing(false);setActualBalance("");setClosingNote("");setSession(null);
      setNotice(`${t("Register closed. Recorded difference")}: ${registerExpected(result.difference)===null?t("Unavailable"):money(Number(result.difference))}.`);
      await loadSession(capturedBranch);
    }catch(cause){if(currentBranch.current===capturedBranch)setError(getError(cause));}finally{submissionLock.current=false;setSaving(false);}
  }
  async function loadRegisterHistory(page=historyPage,status=historyStatus){
    if(!branchId||!canReadSales)return;
    const request=++historyRequest.current,capturedBranch=branchId;
    setHistoryLoading(true);setHistoryError("");setSelectedHistory(null);
    const params=new URLSearchParams({branchId,page:String(page),limit:"10"});if(status)params.set("status",status);
    try{const result=await api.getWithMeta<unknown>(`/pharmacy/cash-register?${params}`);if(request!==historyRequest.current||capturedBranch!==currentBranch.current)return;const items=rows<Row>(result);setHistorySessions(items);setHistoryPage(page);setHistoryMeta(readPagination(result,items.length,page,10));}
    catch(cause){if(request===historyRequest.current){setHistoryError(getError(cause));setHistorySessions([]);setHistoryMeta({total:0,totalPages:1,hasNextPage:false});}}
    finally{if(request===historyRequest.current)setHistoryLoading(false);}
  }
  async function openRegisterSession(sessionId:string){
    if(!canReadSales)return;
    const request=++historyRequest.current,capturedBranch=branchId;setHistoryLoading(true);setHistoryError("");
    try{const detail=await api.get<Row>(`/pharmacy/cash-register/${encodeURIComponent(sessionId)}`);if(request===historyRequest.current&&capturedBranch===currentBranch.current){if(detail.branchId!==capturedBranch){setHistoryError(t("This register session belongs to a different branch."));return;}setSelectedHistory(detail);}}
    catch(cause){if(request===historyRequest.current)setHistoryError(getError(cause));}finally{if(request===historyRequest.current)setHistoryLoading(false);}
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
    if (submissionLock.current) return;
    if (!canCreateSales) { setError(t("Your role cannot create sales.")); return; }
    setError(""); setNotice("");
    if (!branchId || cart.length === 0) { setError(t("Select a branch and add at least one medicine.")); return; }
    if (status === "completed" && !session) { setRegisterBranch(branchId);setOpening(true); setError(t("Open the cash register before completing a sale.")); return; }
    if (paymentAllocation.error) { setError(t(paymentAllocation.error)); return; }
    if (paymentLines.some((line) => !line.accountId && (numeric(line.amount) > 0 || (paymentLines.length === 1 && line.amount === "" && paid > 0)))) { setError(t("Choose an account for each payment method with an amount.")); return; }
    if (new Set(cart.map((line) => line.stock.id)).size !== cart.length || cart.some((line) => !sellableStocks([line.stock], branchId).length)) { setError(t("A selected batch is expired, unavailable or duplicated. Review the cart before checkout.")); return; }
    if (cart.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.stock.quantity)) { setError(t("Each quantity must be a whole number within the selected batch stock.")); return; }
    submissionLock.current = true;
    setSaving(true);
    const saleCustomer = customer ?? await resolveOpdCustomer();
    const saleDiscountPercent = saleEligible > 0 ? actualSaleDiscount / saleEligible * 100 : 0;
    const paymentPayload = paymentAllocation.payments;
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
      const saved = await api.post<unknown>("/sales", payload);
      const result = unwrapSavedSale(saved) ?? {};
      const invoice = String(result.invoiceNumber ?? result.id ?? "");
      const savedItems = rows<Row>(result.saleItems);
      const receiptItems = savedItems.length ? savedItems.map((item) => ({
        name: String(item.itemName ?? "Medicine"), description: String(item.itemDescription ?? ""),
        quantity: numeric(item.quantity), unit: String(item.unit ?? "Pcs"), price: numeric(item.price),
        discount: numeric(item.discountAmount), total: savedAmount(item.totalPrice, numeric(item.price) * numeric(item.quantity) - numeric(item.discountAmount)),
        batch: String(item.batchNumber ?? ""),
      })) : cart.map((line) => {
        const discount = Math.round(line.price * line.quantity * line.discountPercent) / 100;
        return { name: line.medicine.name, description: [line.medicine.strength, line.medicine.genericName].filter(Boolean).join(" · "), quantity: line.quantity, unit: line.stock.unit || line.medicine.unit || "Pcs", price: line.price, discount, total: line.price * line.quantity - discount, batch: line.stock.batchNumber };
      });
      setReceipt({
        invoice: invoice || t("Saved sale — verify invoice in sales history"),
        date: String(result.createdAt ?? new Date().toISOString()),
        status: result.status === "pending" || result.status === "completed" ? result.status : status,
        branch: activeBranch?.name ?? "Pharmacy branch",
        cashier: user?.fullName ?? "Pharmacy cashier",
        customer: result.customer && typeof result.customer === "object" ? result.customer as Customer : saleCustomer ?? { id: "opd-customer", name: t("OPD patient"), phone: "" },
        items: receiptItems,
        subtotal: savedAmount(result.totalPrice, subtotal),
        itemDiscount: receiptItems.reduce((sum, item) => sum + item.discount, 0),
        saleDiscount: savedAmount(result.discountAmount, actualSaleDiscount),
        taxPercent: savedAmount(result.taxPercentage, taxPercent),
        taxAmount: savedAmount(result.taxAmount, taxAmount),
        total: savedAmount(result.netPrice, total),
        paid: savedAmount(result.paidAmount, paid),
        due: savedAmount(result.dueAmount, due),
        tendered,
        change,
        payments: paymentPayload.map((payment) => ({ method: payment.paymentMethod, account: accounts.find((account) => account.id === payment.accountId)?.name ?? "Account", amount: payment.amount })),
      });
      setCart([]); setCustomer(null); setCustomerQuery(""); setSaleDiscount(0); setPaymentLines([{ id: nextPaymentId(), amount: "", accountId: accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "", paymentMethod: "cash" }]); setCartOpen(false); setCheckoutOpen(false);
      await loadProducts(); await loadSession(branchId);
      setNotice(invoice ? `${t(status === "completed" ? "Sale completed" : "Sale saved as pending")} · ${t("Invoice")} ${invoice}.` : t("Sale was accepted. Verify its invoice in sales history before taking another payment."));
    } catch (cause) { setError(getError(cause)); }
    finally { submissionLock.current = false; setSaving(false); }
  }

  function holdCart() {
    if (!cart.length || saving || !branchId) return;
    setHeldCarts((current) => [...current, { id: crypto.randomUUID(), branchId: cart[0].stock.branchId, cart, customer,
      discount: saleDiscount, discountMode, payments: paymentLines, createdAt: new Date().toISOString() }]);
    setCart([]); setCustomer(null); setCustomerQuery(""); setSaleDiscount(0);
    setPaymentLines([{ id: nextPaymentId(), amount: "", accountId: accounts.find((item) => item.type === "cash")?.id ?? accounts[0]?.id ?? "", paymentMethod: "cash" }]);
    setCheckoutOpen(false); setCartOpen(false);
    setNotice(t("Cart held in this tab. Resume it before leaving or refreshing this page."));
    searchInput.current?.focus();
  }
  function resumeCart(id: string) {
    if (cart.length || saving) return;
    const held = heldCarts.find((entry) => entry.id === id && entry.branchId === branchId);
    if (!held) return;
    setCart(held.cart); setCustomer(held.customer); setSaleDiscount(held.discount);
    setDiscountMode(held.discountMode); setPaymentLines(held.payments);
    setHeldCarts((current) => current.filter((entry) => entry.id !== id)); setHeldOpen(false); setCartOpen(true);
    setNotice(t("Cart resumed. Review stock and payment before completing the sale."));
  }
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const modal = document.querySelector("dialog[open]");
      if (saving || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || (modal && modal !== cartDialog.current) || calculatorOpen || opening || closing || historyOpen || customerQuickOpen || accountQuickOpen || document.querySelector(".ui-select-popup:popover-open")) return;
      if ((event.key === "F2" || event.key === "F1") && !checkoutOpen && !heldOpen && !receipt) { event.preventDefault(); focusSearch(); }
      if (event.key === "F6" && quickLine && !checkoutOpen && !heldOpen && !receipt) { event.preventDefault(); setCartOpen(false); requestQuantityFocus(value => value + 1); }
      if (event.key === "F9" && !checkoutOpen && !heldOpen && !receipt) { event.preventDefault(); setCalculatorOpen(true); }
      if (event.key === "/" && !checkoutOpen && !heldOpen && !receipt && !(event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) { event.preventDefault(); focusSearch(); }
      if(event.key==="F3"&&!checkoutOpen&&!heldOpen&&!receipt&&canCreateSales){event.preventDefault();setScannerOpen(true);window.setTimeout(()=>document.querySelector<HTMLInputElement>(".pos-barcode-input")?.focus(),0);}
      if (event.key === "F4" && !receipt && !heldOpen && canCreateSales && cart.length) {
        event.preventDefault(); openCheckout();
      }
      if (event.key === "Escape") {
        if (heldOpen) setHeldOpen(false);
        else if (checkoutOpen) setCheckoutOpen(false);
        else if(scannerOpen){setScannerOpen(false);setScanPending(0);searchInput.current?.focus();}
        else setCartOpen(false);
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [calculatorOpen, quickLine, focusSearch, saving, checkoutOpen, heldOpen, receipt, canCreateSales, cart.length,scannerOpen,scanPending,searchCommitting,opening,closing,historyOpen,customerQuickOpen,accountQuickOpen,openCheckout]);

  const customerPicker = <div className="pos-customer-wrap">
        {customer ? <div className="pos-selected-customer"><span className="pos-customer-icon"><UserRound size={16} /></span><span><strong>{language === "bn" ? customer.nameBangla || customer.name : customer.name}</strong><small>{customer.phone} · {t("Due")} {money(numeric(customer.balance))}</small></span><button className="pos-icon-action" onClick={() => { setCustomer(null); setCustomerQuery(""); setCustomerOpen(true); }} aria-label={t("Change customer")} title={t("Change customer")}><X size={15} /></button></div> : <><label className="pos-field-caption" htmlFor="customer-search">{t("Customer")} <span>{t("optional")}</span></label><div className="pos-input-with-icon"><UserRound size={16} /><input id="customer-search" value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerOpen(true); }} onFocus={() => setCustomerOpen(true)} placeholder={t("Search name or phone")} autoComplete="off" onKeyDown={(event) => { if (event.key === "Escape") setCustomerOpen(false); if (event.key === "Enter" && customers[0]) { event.preventDefault(); setCustomer(customers[0]); setCustomerQuery(""); setCustomerOpen(false); } }} /></div><small className="pos-opd-hint">{t("No customer selected. This will be a walk-in sale.")}</small>{customerOpen && customerQuery.trim() && <div className="pos-customer-options">{customerSearchLoading ? <div className="pos-customer-search-state">{t("Searching customers…")}</div> : customerSearchError ? <div className="pos-customer-search-state is-error">{t(customerSearchError)}</div> : customers.length > 0 ? customers.map((item) => <button key={item.id} type="button" onClick={() => { setCustomer(item); setCustomerQuery(""); setCustomerOpen(false); }}><strong>{language === "bn" ? item.nameBangla || item.name : item.name}</strong><small>{item.phone} · {t("Balance")} {money(numeric(item.balance))}</small></button>) : <div className="pos-customer-search-state">{t("No matching customer found.")}</div>}</div>}</>}
      </div>

  const cartContent = <>
    <div className="pos-cart-heading"><div><h2>{t("Current sale")}</h2><p>{totalUnits} {t(totalUnits === 1 ? "item" : "items")}</p></div><button className="pos-icon-action pos-cart-close" onClick={() => setCartOpen(false)} aria-label={t("Close cart")}><X size={18} /></button></div>
    <div className="pos-cart-lines">
      {cart.length === 0 ? <div className="pos-empty-cart"><span><ShoppingBag size={21} /></span><strong>{t("Your cart is empty")}</strong><small>{t("Search or scan a medicine to begin.")}</small></div> : cart.map((line) => <div className="pos-cart-line" key={line.stock.id}>
        <div className="pos-line-main"><div><strong>{medicineName(line.medicine)}</strong><small>{line.medicine.strength || line.medicine.genericName || t("Medicine")}</small><Select className="pos-batch-select" aria-label={`${t("Batch for")} ${medicineName(line.medicine)}`} value={line.stock.id} onChange={(event) => { const nextStock = (line.medicine.stocks ?? []).find((stock) => stock.id === event.target.value); if (nextStock) setCart((current) => current.some((entry) => entry.stock.id === nextStock.id && entry.stock.id !== line.stock.id) ? current : current.map((entry) => entry.stock.id === line.stock.id ? { ...entry, stock: nextStock, quantity: Math.min(entry.quantity, Math.floor(nextStock.quantity)), price: numeric(entry.medicine.salePrice) || numeric(nextStock.mrp) || entry.price } : entry)); }}>{sellableStocks(line.medicine.stocks ?? [], branchId).map((stock) => <option key={stock.id} value={stock.id} disabled={stock.id !== line.stock.id && cart.some((entry) => entry.stock.id === stock.id)}>{t("Batch")} {stock.batchNumber} · {t("exp")} {new Date(stock.expiryDate).toLocaleDateString(locale)} · {stock.quantity} {t("available")}</option>)}</Select></div><button className="pos-icon-action pos-remove" onClick={() => setCart((current) => current.filter((item) => item.stock.id !== line.stock.id))} aria-label={`${t("Remove")} ${medicineName(line.medicine)}`}><Trash2 size={15} /></button></div>
        <div className="pos-line-controls"><div className="pos-quantity-stepper"><button onClick={() => changeLine(line.stock.id, { quantity: line.quantity - 1 })} disabled={line.quantity <= 1} aria-label={t("Decrease quantity")}><Minus size={13} /></button><QuantityInput quantity={line.quantity} max={line.stock.quantity} onChange={quantity => changeLine(line.stock.id, { quantity })} onDone={focusSearch}/><button onClick={() => changeLine(line.stock.id, { quantity: Math.min(line.stock.quantity, line.quantity + 1) })} aria-label={t("Increase quantity")} disabled={line.quantity >= line.stock.quantity}><Plus size={13} /></button></div><span className="pos-stock-hint">{line.stock.quantity} {line.stock.unit} {t("available")}</span><strong className="pos-line-total">{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>
      </div>)}
    </div>
    <div className="pos-cart-summary"><span>{t("Cart subtotal")}<small>{totalUnits} {t(totalUnits === 1 ? "unit" : "units")} · {t("discounts at checkout")}</small></span><strong>{money(subtotal)}</strong></div>
    <div className="pos-cart-footer">{canCreateSales ? <><button className="pos-proceed-button" type="button" disabled={cart.length === 0} onClick={openCheckout}><span>{t("Proceed to checkout")}</span><span>{money(subtotal)} <ChevronRight size={16}/></span></button></> : <small>{t("Your role can view this cart but cannot create sales.")}</small>}</div>
  </>;

  const checkoutContent = <>
    <div className="pos-checkout-heading"><div><p className="eyebrow">{t("STEP 2 OF 2 · CHECKOUT")}</p><h2 id="pos-checkout-title">{t("Review & pay")}</h2><p>{totalUnits} {t(totalUnits === 1 ? "unit" : "units")} · {customer ? language === "bn" ? customer.nameBangla || customer.name : customer.name : t("Walk-in customer")}</p></div><button type="button" disabled={saving} className="pos-checkout-back" onClick={() => { setCheckoutOpen(false); setCartOpen(true); }}><ChevronRight size={15}/> {t("Back to cart")}</button><button type="button" className="purchase-close pos-checkout-close" disabled={saving} aria-label={t("Close checkout")} onClick={() => setCheckoutOpen(false)}><X size={18}/></button></div>
    {error && <div className="pos-alert pos-alert-error pos-checkout-error" role="alert"><CircleAlert size={16}/><span>{t(error)}</span></div>}
    <div className="pos-checkout-body"><div className="pos-checkout-main">
      <section className="pos-checkout-customer" aria-label={t("Customer optional")}>
        <div className="pos-checkout-section-top"><div><h3>{t("Customer details")}</h3><small>{t("Choose a customer or continue as a walk-in sale.")}</small></div>{canCreateCustomers && <button type="button" className="pos-checkout-add-button" aria-expanded={customerQuickOpen} onClick={() => { setError(""); setCustomerQuickOpen((open) => !open); }}><Plus size={15}/>{t("Add customer")}</button>}</div>
        {customerPicker}
        {customerQuickOpen && canCreateCustomers && <div className="pos-checkout-quick-form"><div className="pos-checkout-quick-grid">
          <label>{t("Full name")}<input autoComplete="name" value={customerQuickForm.name} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, name: event.target.value }))}/></label>
          <label>{t("Phone")}<input autoComplete="tel" type="tel" value={customerQuickForm.phone} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, phone: event.target.value }))}/></label>
          <label>{t("Age")}<input type="number" step="1" min="0" value={customerQuickForm.age} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, age: event.target.value }))}/></label>
          <label>{t("Gender")}<Select value={customerQuickForm.gender} onChange={(event) => setCustomerQuickForm((form) => ({ ...form, gender: event.target.value }))}><option value="male">{t("Male")}</option><option value="female">{t("Female")}</option><option value="other">{t("Other")}</option></Select></label>
        </div><div className="pos-checkout-quick-actions"><button type="button" disabled={customerQuickSaving} onClick={() => setCustomerQuickOpen(false)}>{t("Cancel")}</button><button type="button" disabled={customerQuickSaving} className="pos-checkout-save" onClick={() => void createCheckoutCustomer()}>{customerQuickSaving ? t("Saving…") : t("Save & select customer")}</button></div></div>}
      </section>
      <details open className="pos-checkout-items" aria-label={t("Sale items")}><summary><h3>{t("Items & item discounts")}</h3><span>{cart.length} {t("items")}</span><ChevronDown size={16}/></summary>{cart.map((line) => <div className="pos-checkout-item" key={line.stock.id}><span><strong>{medicineName(line.medicine)}</strong><small>{line.quantity} {line.stock.unit} · {line.stock.batchNumber}</small></span><label><span>{t("Discount")}</span><div className="pos-item-discount-input"><input type="number" min="0" max="100" value={line.discountPercent} onChange={(event) => changeLine(line.stock.id, { discountPercent: Math.min(100, Math.max(0, numeric(event.target.value))) })}/><b>%</b></div></label><strong>{money(line.price * line.quantity * (1 - line.discountPercent / 100))}</strong></div>)}</details>
      <details className="pos-checkout-adjustments"><summary><span>{t("Discount & VAT")}</span><small>{money(actualSaleDiscount)} · {taxPercent}% {t("Tax")}</small><ChevronDown size={16}/></summary><p className="form-hint">{t("VAT rate comes from pharmacy settings.")}</p><div className="pos-discount-row"><span>{t("Sale discount")}</span><div className="pos-discount-input"><input type="number" min="0" max={discountMode === "percent" ? 100 : saleEligible} value={saleDiscount} onChange={(event) => setSaleDiscount(Math.min(discountMode === "percent" ? 100 : saleEligible, Math.max(0, numeric(event.target.value))))} /><Select aria-label={t("Discount type")} value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "percent" | "fixed")}><option value="percent">%</option><option value="fixed">BDT</option></Select></div></div>
      <div className="pos-total-row"><span>{t("Subtotal")}</span><span>{money(subtotal)}</span></div><div className="pos-total-row"><span>{t("Item discount")}</span><span>−{money(itemDiscount)}</span></div><div className="pos-total-row"><span>{t("Sale discount")}</span><span>−{money(actualSaleDiscount)}</span></div><div className="pos-total-row"><span>{t("Tax · exclusive")} {taxPercent}%</span><span>{money(taxAmount)}</span></div>
      </details></div><aside className="pos-checkout-payment"><div className="pos-grand-total"><span>{t("Total due")}</span><strong>{money(total)}</strong></div>
      <div className="pos-checkout-section-top pos-checkout-payment-heading"><div><h3>{t("Payment details")}</h3><small>{t("Choose payment methods and accounts.")}</small></div>{canCreateAccounts && <button type="button" className="pos-checkout-add-button" aria-expanded={accountQuickOpen} onClick={() => { setError(""); setAccountQuickOpen((open) => !open); }}><Plus size={15}/>{t("Add account")}</button>}</div>
      {accountQuickOpen && canCreateAccounts && <div className="pos-checkout-quick-form"><div className="pos-checkout-quick-grid"><label>{t("Account name")}<input value={accountQuickForm.name} onChange={(event) => setAccountQuickForm((form) => ({ ...form, name: event.target.value }))}/></label><label>{t("Account type")}<Select value={accountQuickForm.type} onChange={(event) => setAccountQuickForm((form) => ({ ...form, type: event.target.value }))}><option value="cash">{t("Cash")}</option><option value="bank">{t("Bank")}</option><option value="mfs">{t("Mobile financial service")}</option></Select></label></div><p>{t("New pharmacy accounts start with zero opening balance.")}</p><div className="pos-checkout-quick-actions"><button type="button" disabled={accountQuickSaving} onClick={() => setAccountQuickOpen(false)}>{t("Cancel")}</button><button type="button" disabled={accountQuickSaving} className="pos-checkout-save" onClick={() => void createCheckoutAccount()}>{accountQuickSaving ? t("Saving…") : t("Save account")}</button></div></div>}
      <div className="pos-tender-heading"><span>{t("Tendered")}</span><strong>{money(tendered)}</strong></div>
      {change > 0 && <div className="pos-total-row"><span>{t("Change to return")}</span><strong>{money(change)}</strong></div>}
      {paymentAllocation.error && <div className="pos-dialog-error" role="alert">{t(paymentAllocation.error)}</div>}
      <div className="pos-tender-lines">{paymentLines.map((line, index) => <div className="pos-tender-line" key={line.id}><label><span>{t("Method")}</span><Select value={line.paymentMethod} onChange={(event) => updatePaymentLine(line.id, { paymentMethod: event.target.value as (typeof methods)[number] })}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</Select></label><label><span>{t("Account")}</span><Select value={line.accountId} onChange={(event) => updatePaymentLine(line.id, { accountId: event.target.value })}><option value="">{t("Select account")}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</Select></label><label><span>{t("Amount")}</span><span className="pos-currency-input"><b>৳</b><input type="number" min="0" step="0.01" inputMode="decimal" placeholder={paymentLines.length === 1 && index === 0 ? total.toFixed(2) : "0.00"} value={line.amount} onChange={(event) => updatePaymentLine(line.id, { amount: event.target.value })} /></span></label>{paymentLines.length === 1 && <small className="pos-full-payment-hint">{t("Leave the amount blank to pay the full total.")}</small>}{paymentLines.length > 1 && <button type="button" className="pos-icon-action pos-tender-remove" aria-label={`${t("Remove payment")} ${index + 1}`} onClick={() => removePaymentLine(line.id)}><X size={14}/></button>}</div>)}</div>
      <button type="button" className="pos-add-tender" onClick={addPaymentLine} disabled={saving || paymentLines.length >= 8}><Plus size={14}/> {t("Add payment method")}</button>
      <div className="pos-due-row"><span>{t("Remaining due")}</span><strong>{money(due)}</strong></div></aside>
    </div>
    {canCreateSales&&<div className="pos-checkout-actions"><div className="pos-checkout-footer-summary"><span>{t("Total due")}</span><strong>{money(total)}</strong><small>{t("Paid")}: {money(paid)} · {t("Remaining due")}: {money(due)}</small></div><div className="pos-checkout-footer-buttons"><button className="pos-pending-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("pending")}>{t("Save as pending")}</button><button className="pos-complete-button" type="button" disabled={saving || cart.length === 0} onClick={() => void submitSale("completed")}><Check size={17} />{saving ? t("Saving sale…") : t("Complete sale")}</button></div><small className="pos-checkout-note">{t("Stock is deducted only after a completed sale.")}</small></div>}
  </>;

  return <section className={`pos-page${expanded ? " pos-focus-mode" : ""}`}>
    {(error || notice) && <div className={`pos-alert ${error ? "pos-alert-error" : "pos-alert-success"}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{t(error || notice)}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label={t("Dismiss message")}><X size={15}/></button></div>}
    <div className="pos-draft-toolbar pos-compact-top" aria-label={t("Cart tools")}>
      <h2>{t("Medicine catalog")}</h2><span className="pos-header-branch" title={activeBranch?.name}>{activeBranch?.name ?? t("Select a branch")}</span>
      <div className="pos-header-actions"><details className="pos-utility-menu"><summary><span>{session ? t("Register open") : t("Register closed")}</span><ChevronDown size={14}/></summary><div className="pos-utility-popover"><p>{activeBranch?.name ?? t("No branch selected")}{session && <small>{t("Session")} {String(session.sessionNumber ?? session.id ?? "active").slice(0, 12)}</small>}</p>{canCreateSales&&(session ? <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setError(""); setRegisterBranch(branchId);setActualBalance("");setClosingNote(""); setClosing(true); }}>{t("Close register")}</button> : <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setRegisterBranch(branchId);setOpening(true); }}>{t("Open register")}</button>)}{canReadSales&&<button type="button" disabled={!branchId} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setHistoryOpen(true); setSelectedHistory(null); setHistoryPage(1); setHistoryStatus(""); void loadRegisterHistory(1, ""); }}><Clock3 size={14}/>{t("Register history")}</button>}</div></details><button type="button" className="pos-pending-button" aria-label={t(expanded ? "Exit full screen" : "Full screen")} title={t(expanded ? "Exit full screen" : "Full screen")} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<span>{t(expanded ? "Exit full screen" : "Full screen")}</span></button>
      {canCreateSales && <button type="button" className="pos-pending-button" aria-label={t("Hold cart")} title={t("Hold cart")} disabled={!cart.length || saving} onClick={holdCart}><Pause size={15}/><span>{t("Hold cart")}</span></button>}
      <button type="button" className="pos-pending-button" disabled={saving} aria-label={`${t("Held carts")} (${heldCarts.filter(entry => entry.branchId === branchId).length})`} title={t("Held carts")} onClick={() => { setCartOpen(false); setHeldOpen(true); }}><Clock3 size={15}/><span>{t("Held carts")}</span> ({heldCarts.filter((entry) => entry.branchId === branchId).length})</button>
      <button type="button" className="pos-pending-button" aria-label={t("Calculator")} title={t("Calculator")} onClick={() => setCalculatorOpen(true)}><Calculator size={16}/><span>{t("Calculator")}</span></button></div>
    </div>
    {calculatorOpen && <PosCalculator onClose={() => setCalculatorOpen(false)}/>}
    {heldOpen && <div className="pos-dialog-backdrop" role="presentation" onClick={() => setHeldOpen(false)}><section className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="held-carts-title" onClick={(event) => event.stopPropagation()}>
      <h2 id="held-carts-title">{t("Held carts")}</h2><p>{t("Held carts stay in this tab until you leave or refresh. They do not reserve stock.")}</p>
      {cart.length > 0 && <p role="status">{t("Hold or finish the current cart before resuming another.")}</p>}
      {heldCarts.filter((entry) => entry.branchId === branchId).map((entry) => <div className="pos-held-cart" key={entry.id}><span><strong>{entry.customer?.name ?? t("Walk-in customer")}</strong><small>{entry.cart.reduce((sum, line) => sum + line.quantity, 0)} {t("units")} · {new Date(entry.createdAt).toLocaleTimeString(locale)}</small></span><button type="button" disabled={cart.length > 0 || saving} className="pos-pending-button" onClick={() => resumeCart(entry.id)}>{t("Resume cart")}</button></div>)}
      {!heldCarts.some((entry) => entry.branchId === branchId) && <p>{t("No held carts in this branch.")}</p>}
      <button type="button" className="pos-dialog-cancel" onClick={() => setHeldOpen(false)}>{t("Close")}</button>
    </section></div>}
    <div className="pos-workspace">
      <div className="pos-catalog panel">

        <div className="pos-search-row"><div className="pos-search-box"><Search size={18}/><input ref={searchInput} autoFocus aria-label={t("Search medicine or scan barcode…")} placeholder={t("Search medicine or scan barcode…")} value={query} onChange={(event) => { setQuery(event.target.value);querySnapshot.current=event.target.value; setKeyboardProduct(0); }} onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setKeyboardProduct((index) => { const next = Math.max(0, Math.min(visibleMedicines.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))); window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-pos-result="${next}"]`)?.scrollIntoView({block:"nearest"})); return next; });
          }
          if(event.key==="Enter"&&query.trim()&&!event.nativeEvent.isComposing&&!event.repeat){event.preventDefault();void commitSearch();}
        }} /><kbd>{t("Enter")}</kbd>{query && <button type="button" aria-label={t("Clear search")} onClick={() => {setQuery("");querySnapshot.current="";}}><X size={16}/></button>}</div><button type="button" className="pos-scan-button" aria-label={t("Barcode")} aria-expanded={scannerOpen} aria-controls="pos-barcode-panel" disabled={!canCreateSales||!branchId} onClick={() => setScannerOpen(open=>!open)}><Barcode size={17}/><span>{t("Barcode")}</span></button><div className="pos-filter-popover-wrap" ref={filterPanel}><div className="pos-filter-toolbar"><button aria-expanded={filtersOpen} aria-controls="pos-filter-popover" className={`pos-filter-button ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={15}/> {t("Filters")}{activeFilterCount > 0 && <span className="pos-filter-count">{activeFilterCount}</span>}<ChevronDown size={14}/></button>{activeFilterCount > 0 && <button className="pos-clear-filters" aria-label={t("Clear filters")} title={t("Clear filters")} onClick={() => { setCategoryId(""); setGenericId(""); setManufacturerId(""); setGroupId(""); setUnitId(""); setFormulation(""); setStrength(""); setInStockOnly(false); }}><X size={14}/></button>}</div>
        {filtersOpen && <FilterPopover id="pos-filter-popover" className="pos-filter-drawer" onClose={() => setFiltersOpen(false)}><label><span>{t("Category")}</span><Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{t("All categories")}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Generic")}</span><Select value={genericId} onChange={(event) => setGenericId(event.target.value)}><option value="">{t("All generics")}</option>{generics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Manufacturer")}</span><Select value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)}><option value="">{t("All manufacturers")}</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Group")}</span><Select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{t("All groups")}</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Unit")}</span><Select value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="">{t("All units")}</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><span>{t("Dosage form")}</span><input placeholder={t("e.g. Tablet")} value={formulation} onChange={(event) => setFormulation(event.target.value)}/></label><label><span>{t("Strength")}</span><input placeholder={t("e.g. 500 mg")} value={strength} onChange={(event) => setStrength(event.target.value)}/></label><label className="pos-stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)}/> {t("In stock only")}</label></FilterPopover>}</div><div className="pos-view-switch" role="group" aria-label={t("Catalog view")}><button type="button" aria-label={t("Card mode")} title={t("Card mode")} aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")}><LayoutGrid size={16}/><span>{t("Card mode")}</span></button><button type="button" aria-label={t("List mode")} title={t("List mode")} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><List size={16}/><span>{t("List mode")}</span></button></div></div>
        {quickLine && canCreateSales && <div className="pos-quick-quantity" role="region" aria-label={t("Quick quantity")}>
          <div><small>{t("Last added item")}</small><strong>{medicineName(quickLine.medicine)}</strong><small>{quickLine.stock.batchNumber} · {quickLine.stock.quantity} {quickLine.stock.unit} {t("available")}</small></div>
          <div className="pos-quantity-stepper"><button type="button" disabled={quickLine.quantity <= 1} aria-label={t("Decrease quantity")} onClick={() => changeLine(quickLine.stock.id, {quantity:quickLine.quantity - 1})}><Minus size={14}/></button><QuantityInput inputRef={quickQuantity} quantity={quickLine.quantity} max={quickLine.stock.quantity} onChange={quantity => changeLine(quickLine.stock.id, {quantity})} onDone={focusSearch}/><button type="button" disabled={quickLine.quantity >= quickLine.stock.quantity} aria-label={t("Increase quantity")} onClick={() => changeLine(quickLine.stock.id, {quantity:quickLine.quantity + 1})}><Plus size={14}/></button></div>
          <button type="button" className="pos-quick-done" title={t("Done · Enter")} onClick={focusSearch}>{t("Done · Enter")}<Search size={14}/></button><small>{t("↑/↓ or +/− quantity · Enter back to search")}</small>
        </div>}
        {scannerOpen&&canCreateSales&&branchId&&!checkoutOpen&&!heldOpen&&!receipt&&!opening&&!closing&&!historyOpen&&<BarcodeScanner key={branchId} branchId={branchId} onMedicine={addMedicine} onPendingChange={setScanPending} onClose={()=>{setScannerOpen(false);setScanPending(0);searchInput.current?.focus();}}/>}
        <div className="pos-results-meta"><span>{loading ? t("Loading catalog…") : searchCommitting ? t("Finding your selection…") : catalogRefreshing ? t("Updating results…") : `${visibleMedicines.length} ${t(unitId ? "matching" : "shown")}${!unitId && totalProducts > medicines.length ? ` ${t("of")} ${totalProducts}` : ""} ${t("medicines")}`}</span><span><span className="pos-dot-green"/> {t("Batch stock · selected branch")}</span></div>
        {viewMode === "list" ? <><CatalogList medicines={visibleMedicines} branchId={branchId} selected={query.trim() ? keyboardProduct : -1} canAdd={canCreateSales} onAdd={addMedicine} money={money}/>{!loading && !visibleMedicines.length && <p className="pos-list-empty">{t("No matching medicines")}</p>}</> : <div className="pos-product-grid">{visibleMedicines.map((medicine, index) => {
          const available = sellableStocks(medicine.stocks ?? [], branchId).reduce((sum, stock) => sum + stock.quantity, 0);
          const earliest = sellableStocks(medicine.stocks ?? [], branchId).sort((a,b) => a.expiryDate.localeCompare(b.expiryDate))[0];
          return <button type="button" key={medicine.id} style={{ "--medicine-hue": Math.round(index * 360 / Math.max(visibleMedicines.length, 1)) } as React.CSSProperties} data-keyboard-active={query.trim() && index === keyboardProduct ? "true" : undefined} data-pos-result={index} className={`pos-product-card ${available === 0 ? "out-of-stock" : ""}`} onClick={event => addMedicine(medicine, event.detail === 0)} disabled={available === 0 || !canCreateSales}>
            <span className="pos-product-icon"><Package size={19}/></span><span className="pos-product-copy"><strong>{medicineName(medicine)}</strong><small>{[medicine.strength, medicine.dosageForm || medicine.genericName].filter(Boolean).join(" · ") || t("Pharmacy medicine")}</small><small className="pos-product-brand">{medicine.medicineManufacturer?.name || medicine.category?.name || t("Catalog item")}</small></span><span className={`pos-stock-badge ${available > 0 ? "" : "empty"}`}>{available > 0 ? `${available} ${medicine.unit || t("pcs")}` : t("Out of stock")}</span><span className="pos-product-bottom"><span><strong>{money(numeric(medicine.salePrice) || numeric(earliest?.mrp) || numeric(medicine.mrp))}</strong><small>{earliest ? `${t("Batch")} ${earliest.batchNumber}` : medicine.barcode || t("No batch")}</small></span><span className="pos-add-icon"><Plus size={17}/></span></span>
          </button>;
        })}{!loading && visibleMedicines.length === 0 && <div className="pos-no-products"><Package size={22}/><strong>{t("No matching medicines")}</strong><span>{unitId && hasMoreProducts ? t("Load more results to find medicines in this unit.") : t("Try another name or clear some filters.")}</span></div>}</div>}
        {hasMoreProducts && <button type="button" className="pos-load-more" disabled={loading} onClick={() => void loadProducts(productPage + 1, true)}>{loading ? t("Loading more…") : `${t("Load more medicines")}${!unitId && totalProducts > medicines.length ? ` · ${totalProducts - medicines.length} ${t("remaining")}` : ""}`}</button>}
        <div className="pos-catalog-footer"><span><Activity size={14}/> {t("Prices and batch availability come from current stock.")}</span><span>{t("Whole-unit quantities only")}</span></div>
      </div>

    </div>
    <button className="pos-mobile-cart-bar" onClick={() => setCartOpen(true)} aria-label={t("Open current sale")}><span className="pos-mobile-cart-icon"><ShoppingCart size={18}/><i>{totalUnits}</i></span><span><strong>{totalUnits} {t(totalUnits === 1 ? "item" : "items")}</strong><small>{t("Tap to review order")}</small></span><strong className="pos-mobile-cart-total">{money(total)}</strong><ChevronRight size={17}/></button>
    {cartOpen && <dialog ref={cartDialog} className="pos-cart-modal" aria-label={t("Current sale")} onCancel={() => setCartOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setCartOpen(false); } }}>{cartContent}</dialog>}
    {checkoutOpen && <div className="pos-checkout-backdrop" role="presentation" onClick={(event) => { if (!saving && event.target === event.currentTarget) setCheckoutOpen(false); }}><section className="pos-checkout-dialog pos-review-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-checkout-title" onClick={(event) => event.stopPropagation()}>{checkoutContent}</section></div>}
    {receipt && <ReceiptPreview receipt={receipt} onClose={() => setReceipt(null)}/>}
    {opening && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setOpening(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-dialog-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" disabled={saving} onClick={() => setOpening(false)} aria-label={t("Close")}><X size={17}/></button><h2 id="register-dialog-title">{t("Open cash register")}</h2><p>{t("Record the opening float for ")}{activeBranch?.name || t("this branch")}. {t("This starts your cashier session.")}</p><label><span>{t("Opening cash balance")}</span><span className="pos-currency-input"><b>৳</b><input disabled={saving} autoFocus inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></span></label><label className="pos-register-note"><span>{t("Opening note")} <small>{t("Optional")}</small></span><textarea disabled={saving} rows={2} maxLength={500} value={openingNote} onChange={event=>setOpeningNote(event.target.value)}/></label>{accounts.length === 0 && <div className="pos-dialog-warning">{t("No active cash or payment accounts were found. A sale with collected payment needs an active account.")}</div>}{error && <div className="pos-dialog-error">{t(error)}</div>}<button className="pos-complete-button" disabled={saving || !branchId} onClick={() => void openRegister()}>{saving ? t("Opening…") : t("Open register")}</button><button className="pos-dialog-cancel" disabled={saving} onClick={() => { setOpening(false); setError(""); }}>{t("Cancel")}</button></div></div>}
    {closing && canCreateSales && <div className="pos-dialog-backdrop" role="presentation" onClick={() => !saving && setClosing(false)}><div className="pos-register-dialog" role="dialog" aria-modal="true" aria-labelledby="register-close-title" onClick={(event) => event.stopPropagation()}><div className="pos-dialog-icon"><Clock3 size={19}/></div><button className="pos-icon-action pos-dialog-close" onClick={() => setClosing(false)} aria-label={t("Close")} disabled={saving}><X size={17}/></button><h2 id="register-close-title">{t("Close cash register")}</h2><p>{t("Count the cash in the drawer and record any difference before ending this cashier session.")}</p><div className="pos-history-detail">{[["Opening balance",session?.openingBalance],["Recorded sales",session?.salesAmount],["Recorded expenses",session?.expensesAmount]].map(([label,value])=><div key={String(label)}><span>{t(String(label))}</span><strong>{registerExpected(value)===null?"—":money(Number(value))}</strong></div>)}</div><p>{t("Expected balance is supplied by the server. Count the cash in your drawer separately.")}</p><div className="pos-register-expected"><span>{t("Expected cash balance")}</span><strong>{registerExpected(session?.closingBalance)===null?"—":money(Number(session?.closingBalance))}</strong></div><label><span>{t("Actual cash balance")}</span><span className="pos-currency-input"><b>৳</b><input disabled={saving} autoFocus inputMode="decimal" min="0" step="0.01" type="number" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} /></span></label><div className="pos-register-expected"><span>{t("Difference")}</span><strong>{registerDifference(actualBalance,session?.closingBalance)===null?"—":money(registerDifference(actualBalance,session?.closingBalance)!)}</strong></div><label className="pos-register-note"><span>{t("Closing note")} <small>{t("Optional")}</small></span><textarea disabled={saving} rows={3} maxLength={500} placeholder={t("Explain a cash shortage or overage")} value={closingNote} onChange={(event) => setClosingNote(event.target.value)} /></label>{error && <div className="pos-dialog-error">{t(error)}</div>}<button className="pos-complete-button" disabled={saving || actualBalance.trim() === ""} onClick={() => void closeRegister()}>{saving ? t("Closing…") : t("Close register")}</button><button className="pos-dialog-cancel" disabled={saving} onClick={() => { setClosing(false); setError(""); }}>{t("Cancel")}</button></div></div>}
    {historyOpen && <div className="pos-dialog-backdrop pos-history-backdrop" role="presentation" onClick={() => {historyRequest.current++;setHistoryOpen(false);}}><div className="pos-history-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-history-title" onClick={(event) => event.stopPropagation()}><div className="pos-history-heading"><div><p className="eyebrow">{t("CASH MANAGEMENT")}</p><h2 id="pos-history-title">{t("Register history")}</h2><p>{t("Sessions for ")}{activeBranch?.name || t("this branch")}</p></div><button className="pos-icon-action" onClick={() => {historyRequest.current++;setHistoryOpen(false);}} aria-label={t("Close history")}><X size={17}/></button></div>{selectedHistory ? <><button className="pos-history-back" onClick={() => {historyRequest.current++;setSelectedHistory(null);setHistoryLoading(false);}}>‹ {t("Back to sessions")}</button><div className="pos-history-detail"><div><span>{t("Session status")}</span><strong className={`pos-history-status ${String(selectedHistory.status ?? "").toLowerCase()}`}>{t(String(selectedHistory.status ?? "unknown"))}</strong></div><div><span>{t("Opened")}</span><strong>{selectedHistory.createdAt ? new Date(String(selectedHistory.createdAt)).toLocaleString(locale,{timeZone:"Asia/Dhaka"}) : "—"}</strong></div><div><span>{t("Opening balance")}</span><strong>{money(numeric(selectedHistory.openingBalance))}</strong></div><div><span>{t("Expected balance")}</span><strong>{money(numeric(selectedHistory.closingBalance))}</strong></div><div><span>{t("Counted balance")}</span><strong>{selectedHistory.actualBalance == null ? "—" : money(numeric(selectedHistory.actualBalance))}</strong></div><div><span>{t("Difference")}</span><strong>{selectedHistory.difference == null ? "—" : money(numeric(selectedHistory.difference))}</strong></div>{Boolean(selectedHistory.closedAt) && <div><span>{t("Closed")}</span><strong>{new Date(String(selectedHistory.closedAt)).toLocaleString(locale,{timeZone:"Asia/Dhaka"})}</strong></div>}{Boolean(selectedHistory.openingNote)&&<p className="pos-history-note">{t("Opening note")}: {String(selectedHistory.openingNote)}</p>}{Boolean(selectedHistory.closingNote) && <p className="pos-history-note">{String(selectedHistory.closingNote)}</p>}</div><h3 className="pos-history-sales-title">{t("Sales in this session")}</h3><div className="pos-history-sales">{rows<Row>(selectedHistory.sales).map((sale) => <div key={String(sale.id)}><span><strong>{String(sale.invoiceNumber ?? sale.id ?? t("Sale"))}</strong><small>{sale.createdAt ? new Date(String(sale.createdAt)).toLocaleString(locale,{timeZone:"Asia/Dhaka"}) : ""}</small></span><strong>{money(numeric(sale.netPrice))}</strong></div>)}{rows<Row>(selectedHistory.sales).length === 0 && <p className="pos-history-empty">{t("No linked sales are recorded for this session.")}</p>}</div></> : <><div className="pos-history-toolbar"><label><span>{t("Status")}</span><Select disabled={historyLoading} value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value); void loadRegisterHistory(1, event.target.value); }}><option value="">{t("All sessions")}</option><option value="open">{t("open")}</option><option value="closed">{t("closed")}</option></Select></label><span>{t("Page")} {historyPage} / {historyMeta.totalPages} · {historyMeta.total} {t("sessions")}</span></div>{historyError && <div className="pos-dialog-error">{t(historyError)}</div>}<div className="pos-history-list">{historySessions.map((item) => <button type="button" key={String(item.id)} onClick={() => void openRegisterSession(String(item.id))}><span className="pos-history-session-main"><strong>{t("Session")} {String(item.sessionNumber ?? item.id ?? "").slice(0, 12)}</strong><small>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString(locale,{timeZone:"Asia/Dhaka"}) : t("Date unavailable")}</small></span><span className={`pos-history-status ${String(item.status ?? "").toLowerCase()}`}>{t(String(item.status ?? "unknown"))}</span><strong>{money(numeric(item.actualBalance ?? item.closingBalance))}</strong><ChevronRight size={15}/></button>)}{!historyLoading && historySessions.length === 0 && <p className="pos-history-empty">{t("No register sessions match this branch and filter.")}</p>}</div>{historyLoading && <p className="pos-history-loading">{t("Loading register sessions…")}</p>}<div className="pos-history-pagination"><button type="button" disabled={historyLoading || historyPage <= 1} onClick={() => void loadRegisterHistory(historyPage - 1)}>{t("Previous")}</button><button type="button" disabled={historyLoading || !historyMeta.hasNextPage} onClick={() => void loadRegisterHistory(historyPage + 1)}>{t("Next")}</button></div></>}</div></div>}
  </section>;
}
