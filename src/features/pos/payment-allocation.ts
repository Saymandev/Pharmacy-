export type Tender = { accountId: string; amount: string; paymentMethod: string };
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);

/** Cash change is returned to the customer, never posted as sale revenue. */
export function allocatePayments(total: number, tenders: Tender[]) {
  const totalCents = cents(total);
  if (!Number.isFinite(total) || totalCents < 0 || !Number.isSafeInteger(totalCents)) throw new Error('Invalid sale total.');
  const amounts = tenders.map((line) => {
    const value = tenders.length === 1 && line.amount === '' ? total : line.amount.trim() === '' ? 0 : Number(line.amount);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents(value))) throw new Error('Enter a valid payment amount of zero or more.');
    return cents(value);
  });
  const nonCash = amounts.reduce((sum, amount, index) => sum + (tenders[index].paymentMethod === 'cash' ? 0 : amount), 0);
  if (nonCash > totalCents) throw new Error('Non-cash payments cannot exceed the sale total.');
  let remainingCash = Math.max(0, totalCents - nonCash);
  const payments = tenders.flatMap((line, index) => {
    const amount = line.paymentMethod === 'cash' ? Math.min(amounts[index], remainingCash) : amounts[index];
    if (line.paymentMethod === 'cash') remainingCash -= amount;
    return amount > 0 ? [{ accountId: line.accountId, paymentMethod: line.paymentMethod, amount: amount / 100 }] : [];
  });
  const tenderedCents = amounts.reduce((sum, amount) => sum + amount, 0);
  const paidCents = Math.min(totalCents, tenderedCents);
  return { payments, tendered: tenderedCents / 100, paid: paidCents / 100,
    due: Math.max(0, totalCents - paidCents) / 100, change: Math.max(0, tenderedCents - totalCents) / 100 };
}
