import { backendApiBase } from "@/lib/server/backend-url";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/server/request-security";
import { tenantSessionRouteAllowed } from "@/lib/server/tenant-session-gate";

type RouteContext = { params: Promise<{ path: string[] }> };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function proxy(request: Request, context: RouteContext) {
  if (MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  const { path } = await context.params;
  if(path[0]==='tenant-workspace')return NextResponse.json({success:false,message:'Shop workspace is not available.'},{status:404,headers:{'Cache-Control':'no-store'}});
  if (path[0] === "tenant-session" && !tenantSessionRouteAllowed(path,request.method)) {
    return NextResponse.json({ success:false,message:"Shop selection is not available." },{status:404,headers:{"Cache-Control":"no-store"}});
  }
  const safePath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(request.url);
  const backendOrigin = backendApiBase();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pharmacy_access")?.value;
  const headers = new Headers({ Accept: request.headers.get("accept") ?? "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${backendOrigin}/${safePath}${url.search}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ success: false, message: "The pharmacy server is unavailable." }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) responseHeaders.set("Content-Type", upstreamContentType);
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
