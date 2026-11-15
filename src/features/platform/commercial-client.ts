import { PlatformError } from "./platform-client";
export function createCommercialClient(signal: AbortSignal) {
  const controller = new AbortController();
  let disposed = false;
  return {
    async request<T>(
      path: string,
      method = "GET",
      body?: unknown,
      key?: string,
    ): Promise<T> {
      if (disposed || signal.aborted)
        throw new PlatformError("Session changed.", 409);
      const r = await fetch("/api/backend/platform/" + path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, controller.signal]),
        headers: {
          Accept: "application/json",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Idempotency-Key": key ?? "",
              }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const v = await r.json();
      if (disposed || signal.aborted)
        throw new PlatformError("Session changed.", 409);
      if (!r.ok || v.success !== true)
        throw new PlatformError(
          v.message ?? "Commercial request failed.",
          r.status,
        );
      return v.data as T;
    },
    dispose() {
      disposed = true;
      controller.abort();
    },
  };
}
