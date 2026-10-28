type DemoRequest = { method?: string; body?: unknown };

const branch = { id: "branch-demo-dhaka", name: "Dhanmondi Main", address: "House 18, Road 7, Dhaka", phone: "+880 1712-345678", email: "dhanmondi@pharmacy.demo", licenseNumber: "DGDA-DHK-2048" };
const branches = [branch, { id: "branch-demo-uttara", name: "Uttara Branch", address: "Sector 7, Uttara, Dhaka", phone: "+880 1812-345678" }];
const accounts = [
  { id: "account-demo-cash", name: "Main Cash Drawer", type: "cash", group: "pharmacy", currentBalance: 48250, openingBalance: 12000, isActive: true, _count: { transactions: 142 } },
  { id: "account-demo-bank", name: "City Bank", type: "bank", group: "pharmacy", currentBalance: 186400, openingBalance: 100000, isActive: true, _count: { transactions: 85 } },
  { id: "account-demo-mfs", name: "bKash Merchant", type: "mfs", group: "pharmacy", currentBalance: 22400, openingBalance: 5000, isActive: true, _count: { transactions: 54 } },
];
const categories = [{ id: "cat-demo-1", name: "Antibiotics" }, { id: "cat-demo-2", name: "Pain relief" }, { id: "cat-demo-3", name: "Gastric care" }];
const generics = [{ id: "gen-demo-1", name: "Azithromycin" }, { id: "gen-demo-2", name: "Paracetamol" }, { id: "gen-demo-3", name: "Omeprazole" }];
const manufacturers = [{ id: "maker-demo-1", name: "Square Pharmaceuticals" }, { id: "maker-demo-2", name: "Incepta Pharmaceuticals" }];
const groups = [{ id: "group-demo-1", name: "Prescription" }, { id: "group-demo-2", name: "OTC" }];
const units = [{ id: "unit-demo-1", name: "Tablet" }, { id: "unit-demo-2", name: "Bottle" }, { id: "unit-demo-3", name: "Capsule" }];
const medicines = [
  { id: "med-demo-1", name: "Azithrocin", nameBangla: "অ্যাজিথ্রোসিন", genericName: "Azithromycin", strength: "500 mg", dosageForm: "Tablet", unit: "Tablet", barcode: "8941100123456", salePrice: 35, purchasePrice: 27, mrp: 40, reorderLevel: 20, isActive: true, category: categories[0], generic: generics[0], group: groups[0], medicineUnit: units[0], medicineManufacturer: manufacturers[0], stocks: [{ id: "stock-demo-1", batchNumber: "AZ-2408", expiryDate: "2027-08-31T00:00:00.000Z", quantity: 46, mrp: 40, unitPrice: 27, unit: "Tablet" }] },
  { id: "med-demo-2", name: "Napa Extra", nameBangla: "নাপা এক্সট্রা", genericName: "Paracetamol + Caffeine", strength: "500 mg + 65 mg", dosageForm: "Tablet", unit: "Tablet", barcode: "8941100456789", salePrice: 3, purchasePrice: 2.1, mrp: 3, reorderLevel: 60, isActive: true, category: categories[1], generic: generics[1], group: groups[1], medicineUnit: units[0], medicineManufacturer: manufacturers[0], stocks: [{ id: "stock-demo-2", batchNumber: "NP-2511", expiryDate: "2027-11-30T00:00:00.000Z", quantity: 184, mrp: 3, unitPrice: 2.1, unit: "Tablet" }] },
  { id: "med-demo-3", name: "Seclo", nameBangla: "সেকলো", genericName: "Omeprazole", strength: "20 mg", dosageForm: "Capsule", unit: "Capsule", barcode: "8941100789012", salePrice: 6, purchasePrice: 4.3, mrp: 7, reorderLevel: 40, isActive: true, category: categories[2], generic: generics[2], group: groups[0], medicineUnit: units[2], medicineManufacturer: manufacturers[1], stocks: [{ id: "stock-demo-3", batchNumber: "SC-2602", expiryDate: "2028-02-29T00:00:00.000Z", quantity: 27, mrp: 7, unitPrice: 4.3, unit: "Capsule" }] },
  { id: "med-demo-4", name: "Cef-3", genericName: "Cefixime", strength: "200 mg", dosageForm: "Capsule", unit: "Capsule", barcode: "8941100112233", salePrice: 28, purchasePrice: 21, mrp: 30, reorderLevel: 25, isActive: true, category: categories[0], generic: { id: "gen-demo-4", name: "Cefixime" }, group: groups[1], medicineUnit: units[2], medicineManufacturer: manufacturers[1], stocks: [{ id: "stock-demo-4", batchNumber: "CF-2507", expiryDate: "2027-07-31T00:00:00.000Z", quantity: 12, mrp: 30, unitPrice: 21, unit: "Capsule" }] },
];
const stockRows = medicines.flatMap((medicine, index) => medicine.stocks!.map((stock, batchIndex) => ({ ...stock, medicineId: medicine.id, branchId: index === 3 ? branches[1].id : branch.id, rackNumber: `R-${index + 1} / ${batchIndex + 1}`, medicine })));
const customers = [
  { id: "customer-demo-1", customerNumber: "CUS-00428", name: "Nusrat Jahan", nameBangla: "নুসরাত জাহান", phone: "01712345678", age: 34, gender: "female", visitType: "opd", district: "Dhaka", balance: 820, createdAt: "2026-06-12T08:30:00.000Z" },
  { id: "customer-demo-2", customerNumber: "CUS-00429", name: "Rahim Uddin", phone: "01812345678", age: 52, gender: "male", visitType: "opd", district: "Dhaka", balance: 0, createdAt: "2026-06-11T10:10:00.000Z" },
  { id: "customer-demo-3", customerNumber: "CUS-00430", name: "Farzana Akter", phone: "01912345678", age: 27, gender: "female", visitType: "emergency", district: "Gazipur", balance: 1450, createdAt: "2026-06-10T12:40:00.000Z" },
];
const sales = [
  { id: "sale-demo-1", invoiceNumber: "INV-2026-00842", createdAt: "2026-10-27T09:25:00.000Z", netPrice: 740, paidAmount: 500, dueAmount: 240, paymentStatus: "partial", status: "completed", type: "pos", branchId: branch.id, customerId: customers[0].id },
  { id: "sale-demo-2", invoiceNumber: "INV-2026-00817", createdAt: "2026-10-26T14:05:00.000Z", netPrice: 580, paidAmount: 0, dueAmount: 580, paymentStatus: "due", status: "completed", type: "pos", branchId: branch.id, customerId: customers[0].id },
  { id: "sale-demo-3", invoiceNumber: "INV-2026-00798", createdAt: "2026-10-25T11:15:00.000Z", netPrice: 1450, paidAmount: 0, dueAmount: 1450, paymentStatus: "due", status: "completed", type: "pos", branchId: branches[1].id, customerId: customers[2].id },
  { id: "sale-demo-4", invoiceNumber: "INV-2026-00840", createdAt: "2026-10-27T08:10:00.000Z", netPrice: 315, paidAmount: 315, dueAmount: 0, paymentStatus: "paid", status: "completed", type: "pos", branchId: branch.id, customerId: customers[1].id },
];
const suppliers = [{ id: "supplier-demo-1", name: "Square Pharmaceuticals", phone: "02-9123456", address: "Mohakhali, Dhaka", email: "orders@square.demo" }, { id: "supplier-demo-2", name: "Incepta Pharmaceuticals", phone: "02-8876543", address: "Dhamrai, Dhaka", email: "supply@incepta.demo" }];
const purchases = [
  { id: "purchase-demo-1", poNumber: "PUR-2026-00186", branchId: branch.id, branch, supplierId: suppliers[0].id, supplier: suppliers[0], status: "pending", paymentStatus: "partial", totalPrice: 38400, paidAmount: 20000, dueAmount: 18400, discountAmount: 1200, createdAt: "2026-10-26T08:15:00.000Z", note: "October replenishment · cold-chain items ship separately", purchaseItems: [{ medicineId: medicines[0].id, itemName: "Azithrocin 500 mg", unit: "Tablet", price: 27, salePrice: 35, mrp: 40, quantity: 800, batchNumber: "AZ-2610", expiryDate: "2028-04-30T00:00:00.000Z", rackNumber: "A-02" }, { medicineId: medicines[2].id, itemName: "Seclo 20 mg", unit: "Capsule", price: 4.3, salePrice: 6, mrp: 7, quantity: 1600, batchNumber: "SC-2610", expiryDate: "2028-09-30T00:00:00.000Z", rackNumber: "B-04" }], transactions: [{ id: "txn-demo-3", txnId: "TXN-2026-01542", amount: 20000, paymentMethod: "Bank Transfer", note: "Advance against PUR-2026-00186", createdAt: "2026-10-26T08:18:00.000Z" }] },
  { id: "purchase-demo-2", poNumber: "PUR-2026-00185", branchId: branch.id, branch, supplierId: suppliers[1].id, supplier: suppliers[1], status: "completed", paymentStatus: "paid", totalPrice: 12600, paidAmount: 12600, dueAmount: 0, discountAmount: 0, createdAt: "2026-10-24T13:00:00.000Z", purchaseItems: [{ medicineId: medicines[1].id, itemName: "Napa Extra", unit: "Tablet", price: 2.1, salePrice: 3, mrp: 3, quantity: 6000, batchNumber: "NP-2610", expiryDate: "2028-10-31T00:00:00.000Z", rackNumber: "C-01" }], transactions: [{ id: "txn-demo-4", txnId: "TXN-2026-01509", amount: 12600, paymentMethod: "cash", note: "Paid on receipt", createdAt: "2026-10-24T13:05:00.000Z" }] },
];
const transactions = [
  { id: "txn-demo-1", txnId: "TXN-2026-01544", accountId: accounts[0].id, account: { id: accounts[0].id, name: accounts[0].name, type: accounts[0].type, currentBalance: accounts[0].currentBalance }, amount: 740, flowType: "in", txnType: "sale", paymentMethod: "cash", note: "POS sale · INV-2026-00842", createdAt: "2026-10-27T09:25:00.000Z", accountBalanceBefore: 47510, accountBalanceNow: 48250, sale: { invoiceNumber: "INV-2026-00842", id: sales[0].id } },
  { id: "txn-demo-2", txnId: "TXN-2026-01543", accountId: accounts[2].id, account: { id: accounts[2].id, name: accounts[2].name, type: accounts[2].type }, amount: 1250, flowType: "out", txnType: "expense", paymentMethod: "bKash", note: "Utilities · October", createdAt: "2026-10-27T08:55:00.000Z", accountBalanceBefore: 23650, accountBalanceNow: 22400, expense: { expenseNumber: "EXP-2026-00119" } },
  { id: "txn-demo-3", txnId: "TXN-2026-01542", accountId: accounts[1].id, account: { id: accounts[1].id, name: accounts[1].name, type: accounts[1].type }, amount: 20000, flowType: "out", txnType: "purchase", paymentMethod: "Bank Transfer", note: "Advance against PUR-2026-00186", createdAt: "2026-10-26T08:18:00.000Z", accountBalanceBefore: 206400, accountBalanceNow: 186400, purchase: { purchaseNumber: purchases[0].poNumber } },
  { id: "txn-demo-5", txnId: "TXN-2026-01541", accountId: accounts[0].id, account: { id: accounts[0].id, name: accounts[0].name, type: accounts[0].type }, amount: 820, flowType: "in", txnType: "income", paymentMethod: "cash", note: "Consultation fee · OPD", createdAt: "2026-10-26T16:10:00.000Z", accountBalanceBefore: 46690, accountBalanceNow: 47510, income: { incomeNumber: "INC-2026-00074" } },
];
const incomeCategories = [{ id: "inc-cat-1", name: "Consultation fees" }, { id: "inc-cat-2", name: "Service income" }];
const expenseCategories = [{ id: "exp-cat-1", name: "Utilities" }, { id: "exp-cat-2", name: "Office supplies" }];
const incomes = [{ id: "income-demo-1", incomeNumber: "INC-2026-00074", amount: 820, date: "2026-10-26T10:10:00.000Z", note: "Consultation fee · OPD", category: incomeCategories[0], subCategory: null, account: accounts[0], branch, recordedBy: { fullName: "Ayesha Rahman", username: "ayesha" }, transactions: [transactions[3]] }];
const expenses = [{ id: "expense-demo-1", expenseNumber: "EXP-2026-00119", amount: 1250, date: "2026-10-27T08:45:00.000Z", note: "October electricity and water bill", category: expenseCategories[0], subCategory: null, account: accounts[2], branch, recordedBy: { fullName: "Ayesha Rahman", username: "ayesha" }, transactions: [transactions[1]] }];
const register = { id: "register-demo-1", sessionNumber: "REG-2026-00418", branchId: branch.id, status: "open", openingBalance: 12000, closingBalance: 48250, createdAt: "2026-10-27T08:00:00.000Z", sales: [sales[0]] };

function result(data: unknown) { return data; }
export function isDemoMode() { return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1"; }

export function demoRequest<T>(path: string, request: DemoRequest = {}): Promise<T> {
  const [pathname, queryString = ""] = path.split("?");
  const query = new URLSearchParams(queryString);
  const method = (request.method || "GET").toUpperCase();
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1) || "";
  let data: unknown = [];

  if (method !== "GET") {
    if (pathname === "/sales" && method === "POST") data = { id: "sale-demo-created", invoiceNumber: "DEMO-INV-1001", createdAt: new Date().toISOString(), status: "completed" };
    else if (pathname === "/customers" && method === "POST") data = customers[0];
    else if (pathname === "/pharmacy/suppliers" && method === "POST") data = suppliers[0];
    else if (pathname.includes("/transactions/") && method === "PATCH") data = transactions[0];
    else data = { success: true, message: "Demo action simulated. No backend data was changed." };
    return Promise.resolve(result(data) as T);
  }

  if (pathname === "/branches") data = branches;
  else if (pathname === "/finance/accounts") data = accounts;
  else if (pathname.startsWith("/finance/accounts/")) data = accounts.find((item) => item.id === last) || accounts[0];
  else if (pathname === "/settings/tax") data = { name: "TAX_CONFIG", configs: { taxPercentage: 5 } };
  else if (pathname === "/pharmacy/categories") data = categories;
  else if (pathname === "/pharmacy/generics") data = generics;
  else if (pathname === "/pharmacy/manufacturers") data = manufacturers;
  else if (pathname === "/pharmacy/groups") data = groups;
  else if (pathname === "/pharmacy/units") data = units;
  else if (pathname === "/pharmacy/medicines") {
    const search = (query.get("search") || "").toLowerCase();
    const branchId = query.get("branchId");
    const matches = medicines.filter((item) => {
      const stockInBranch = item.stocks?.some((stock) => !branchId || stockRows.some((row) => row.id === stock.id && row.branchId === branchId));
      const hasSellableStock = item.stocks?.some((stock) => stock.quantity > 0 && (!branchId || stockRows.some((row) => row.id === stock.id && row.branchId === branchId)));
      const manufacturerId = String(item.medicineManufacturer?.id ?? "");
      const matchesText = !search || `${item.name} ${item.nameBangla ?? ""} ${item.genericName} ${item.barcode}`.toLowerCase().includes(search);
      return matchesText
        && (!query.get("barcode") || (item.barcode ?? "").toLowerCase().includes(query.get("barcode")!.toLowerCase()))
        && (!query.get("categoryId") || item.category?.id === query.get("categoryId"))
        && (!query.get("genericId") || item.generic?.id === query.get("genericId"))
        && (!query.get("medicineManufacturerId") || manufacturerId === query.get("medicineManufacturerId"))
        && (!query.get("groupId") || item.group?.id === query.get("groupId"))
        && (!query.get("medicineUnitId") || item.medicineUnit?.id === query.get("medicineUnitId"))
        && (!query.get("unit") || item.unit === query.get("unit"))
        && (!query.get("dosageForm") || (item.dosageForm ?? "").toLowerCase().includes(query.get("dosageForm")!.toLowerCase()))
        && (!query.get("strength") || (item.strength ?? "").toLowerCase().includes(query.get("strength")!.toLowerCase()))
        && (query.get("isActive") !== "true" || item.isActive)
        && (query.get("hasStock") === "true" ? hasSellableStock : query.get("hasStock") === "false" ? !hasSellableStock : true)
        && (!branchId || stockInBranch);
    });
    const page = Number(query.get("page") || 1);
    const limit = Number(query.get("limit") || 10);
    data = { data: matches.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: matches.length, totalPages: Math.ceil(matches.length / limit) } };
  } else if (pathname === "/pharmacy/stocks") {
    const branchId = query.get("branchId");
    data = stockRows.filter((item) => !branchId || item.branchId === branchId);
  } else if (pathname === "/pharmacy/suppliers") data = suppliers;
  else if (pathname === "/pharmacy/purchases") data = purchases.filter((item) => !query.get("branchId") || item.branchId === query.get("branchId"));
  else if (pathname.startsWith("/pharmacy/purchases/")) data = purchases.find((item) => item.id === last) || purchases[0];
  else if (pathname === "/pharmacy/cash-register/active") data = query.get("branchId") === branch.id ? register : null;
  else if (pathname === "/pharmacy/cash-register") data = { data: [register], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } };
  else if (pathname.startsWith("/pharmacy/cash-register/")) data = register;
  else if (pathname === "/customers") {
    const search = (query.get("name") || query.get("search") || "").toLowerCase();
    const phone = query.get("phone") || "";
    const filtered = customers.filter((item) => (!search || item.name.toLowerCase().includes(search)) && (!phone || item.phone.includes(phone)));
    data = { success: true, message: "Demo customers", data: filtered, meta: { page: Number(query.get("page") || 1), pageSize: 20, totalItems: filtered.length, totalPages: 1 } };
    return Promise.resolve(data as T);
  } else if (pathname.startsWith("/customers/")) data = customers.find((item) => item.id === last) || customers[0];
  else if (pathname === "/sales") {
    const customerId = query.get("customerId");
    const branchId = query.get("branchId");
    const paymentStatus = query.get("paymentStatus");
    const status = query.get("status");
    data = sales.filter((item) => (!customerId || item.customerId === customerId) && (!branchId || item.branchId === branchId) && (!paymentStatus || item.paymentStatus === paymentStatus) && (!status || item.status === status));
  } else if (pathname === "/finance/transactions") data = transactions;
  else if (pathname.startsWith("/finance/transactions/")) data = transactions.find((item) => item.id === last) || transactions[0];
  else if (pathname === "/finance/incomes/categories") data = incomeCategories;
  else if (pathname === "/finance/expenses/categories") data = expenseCategories;
  else if (pathname === "/finance/incomes") data = incomes;
  else if (pathname.startsWith("/finance/incomes/")) data = incomes.find((item) => item.id === last) || incomes[0];
  else if (pathname === "/finance/expenses") data = expenses;
  else if (pathname.startsWith("/finance/expenses/")) data = expenses.find((item) => item.id === last) || expenses[0];
  else if (pathname.startsWith("/finance/")) data = [];
  else if (pathname === "/permissions") data = [];
  else if (pathname === "/users" || pathname === "/roles") data = [];
  else if (pathname === "/hr/employees" || pathname === "/hr/attendance" || pathname === "/hr/leaves") data = [];
  else if (pathname === "/reports/pharmacy") data = { summary: { totalSales: 82450, totalPurchases: 38400, netProfit: 14820 } };
  else if (pathname === "/reports/pharmacy/stats") data = { totalSales: 82450, salesCount: 128, totalPurchases: 38400, purchasesCount: 9, totalMedicines: 326, lowStockCount: 18, outOfStockCount: 3, totalCashInHand: 48250, expiringIn30Days: 4 };
  else if (pathname === "/reports/pharmacy/graph") data = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(date),
      sales: [18600, 22400, 19750, 28100, 24300, 31500, 26800][index],
      purchases: [11200, 9400, 16500, 8300, 14200, 11800, 15400][index],
    };
  });
  else if (pathname.startsWith("/pharmacy/dashboard")) data = { totalSales: 82450, salesCount: 128, totalPurchases: 38400, purchasesCount: 9, totalMedicines: 326, lowStockCount: 18, outOfStockCount: 3, totalCashInHand: 48250, expiringIn30Days: 4 };

  return Promise.resolve(result(data) as T);
}

