type Data = Record<string, unknown>;
export function readPagination(value: unknown, fallbackTotal = 0, fallbackPage = 1, fallbackLimit = 20) {
  let current = value;
  for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth++) {
    const row = current as Data;
    const candidate = row.meta ?? row.pagination;
    if (candidate && typeof candidate === 'object') {
      const meta = candidate as Data;
      const number = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
      const total = number(meta.totalItems ?? meta.total, fallbackTotal);
      const page = Math.max(1, number(meta.page, fallbackPage));
      const limit = Math.max(1, number(meta.pageSize ?? meta.limit, fallbackLimit));
      const totalPages = Math.max(1, number(meta.totalPages, Math.ceil(total / limit)));
      return { total, page, limit, totalPages, hasNextPage: typeof meta.hasNextPage === 'boolean' ? meta.hasNextPage : page < totalPages };
    }
    current = row.data;
  }
  return { total: fallbackTotal, page: fallbackPage, limit: fallbackLimit, totalPages: Math.max(1, Math.ceil(fallbackTotal / fallbackLimit)), hasNextPage: fallbackTotal >= fallbackLimit };
}
