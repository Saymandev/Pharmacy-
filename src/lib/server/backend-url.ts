/** Accept a backend origin or its /api/v1 base without appending the prefix twice. */
export function backendApiBase(configured = process.env.BACKEND_API_URL ?? "http://localhost:3001"): string {
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("BACKEND_API_URL must use HTTP or HTTPS.");
  url.search = ""; url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/api/v1") ? path : `${path}/api/v1`;
  return url.toString().replace(/\/$/, "");
}
