const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function hrDateInput(value?: string, now = new Date()) {
  if (value && validDate(value)) return value;
  const date = value ? new Date(value) : now;
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function hrCalendarDays(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start) return 0;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
