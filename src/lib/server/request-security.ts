export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const requestHost = host ? new URL(`${forwardedProto || requestUrl.protocol.replace(":", "")}://${host}`).host : requestUrl.host;
    const requestProtocol = forwardedProto || requestUrl.protocol.replace(":", "");

    return originUrl.host.toLowerCase() === requestHost.toLowerCase()
      && originUrl.protocol.replace(":", "").toLowerCase() === requestProtocol.toLowerCase();
  } catch {
    return false;
  }
}
