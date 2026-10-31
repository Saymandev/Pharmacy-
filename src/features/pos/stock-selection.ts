type Batch = { id: string; branchId: string; expiryDate: string; quantity: number };

/** Expiry dates are inclusive calendar days in the pharmacy's Dhaka timezone. */
export function sellableStocks<T extends Batch>(stocks: T[], branchId: string, now = new Date()): T[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return stocks.filter((stock) => {
    const date = stock.expiryDate?.slice(0, 10);
    return stock.branchId === branchId && Number.isFinite(stock.quantity) && stock.quantity >= 1
      && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(stock.expiryDate)) && date >= today;
  }).sort((a, b) => a.expiryDate.slice(0, 10).localeCompare(b.expiryDate.slice(0, 10)) || a.id.localeCompare(b.id));
}

/** Continue with the next FEFO batch once the earlier batch is fully reserved. */
export function chooseAvailableStock<T extends Batch>(stocks: T[], cart: { stock: { id: string }; quantity: number }[]): T | undefined {
  return stocks.find((stock) => {
    const reserved = cart.filter((line) => line.stock.id === stock.id).reduce((sum, line) => sum + line.quantity, 0);
    return reserved < Math.floor(stock.quantity);
  });
}
