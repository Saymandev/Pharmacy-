import { backendApiBase } from "@/lib/server/backend-url";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/server/request-security";

const ACCESS_COOKIE = "pharmacy_access";
const REFRESH_COOKIE = "pharmacy_refresh";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "A valid JSON body is required." }, { status: 400 });
  }

  const backendOrigin = backendApiBase();
  let upstream: Response;
  try {
    upstream = await fetch(`${backendOrigin}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    return NextResponse.json({ success: false, message: "The pharmacy server is unavailable." }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(payload ?? { success: false, message: "Sign-in failed." }, { status: upstream.status });
  }

  const accessToken = payload?.data?.accessToken;
  const refreshToken = payload?.data?.refreshToken;
  const user = payload?.data?.user;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !user) {
    return NextResponse.json({ success: false, message: "The server returned an invalid sign-in response." }, { status: 502 });
  }

  const response = NextResponse.json({ success: true, message: payload.message, data: { user } });
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/backend" };
  response.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions);
  response.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions);
  return response;
}
