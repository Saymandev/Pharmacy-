type RecordValue = Record<string, unknown>;
export function unwrapSavedSale(value: unknown): RecordValue | null {
  for (let depth = 0; depth < 6; depth++) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as RecordValue;
    if (typeof record.id === 'string' && record.id) return record;
    if ('sale' in record) value = record.sale;
    else if ('data' in record) value = record.data;
    else return null;
  }
  return null;
}

/** Prisma Decimal fields serialize as strings; a saved zero must stay zero. */
export function savedAmount(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
