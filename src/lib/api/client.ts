import type { ApiEnvelope } from "@/types/api";

const API_PREFIX = "/api/backend";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  includeMeta?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, includeMeta, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isMultipart) requestHeaders.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      body: body === undefined ? undefined : isMultipart ? body as FormData : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(
      "Can’t reach the pharmacy server. Check the connection and try again.",
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message = payload?.message ?? "The request could not be completed.";
    throw new ApiClientError(message, response.status);
  }

  if (!payload) {
    throw new ApiClientError("The server returned an unexpected response.", response.status);
  }

  if (includeMeta) return payload as T;
  return ("data" in payload ? payload.data : payload) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  getWithMeta: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, includeMeta: true, method: "GET" }),
  post: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...options, body, method: "POST" }),
  patch: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...options, body, method: "PATCH" }),
  put: <T>(path: string, body: unknown, options?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...options, body, method: "PUT" }),
  upload: <T>(path: string, body: FormData, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, body, method: "POST" }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
