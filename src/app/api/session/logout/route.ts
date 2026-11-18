import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/server/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
  }

  if (process.env.SAAS_RUNTIME_ENABLED === "true") {
    // Redirect so the browser attaches the /api/backend-scoped HttpOnly cookies.
    return NextResponse.redirect(new URL("/api/backend/auth/logout", request.url), 307);
  }

  const response = NextResponse.json({ success: true, message: "Signed out." });
  for (const name of ["pharmacy_access", "pharmacy_refresh"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/backend",
      maxAge: 0,
    });
  }
  return response;
}
