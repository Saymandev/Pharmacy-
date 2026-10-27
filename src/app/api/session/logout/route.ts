import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, message: "Request origin could not be verified." }, { status: 403 });
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
