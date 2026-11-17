import {validEntitlementBody} from "@/features/platform/entitlement-policy";
import {validBillingReview} from '@/features/shops/billing-portal-policy';
import {privateRequestProofResponse} from '@/lib/server/billing-request-proof-proxy';
import { cookies } from "next/headers";
import { platformTarget } from "@/lib/server/platform-policy";
import { isSameOriginRequest } from "@/lib/server/request-security";
import {
  validPlatformCommand,
  validShopIntake,
} from "@/features/platform/platform-policy";
import { validIssueOwnerInvite } from "@/features/platform/owner-invitation-policy";
import { validCommercialBody } from "@/features/platform/commercial-policy";
import { validBillingBody } from "@/features/platform/billing-policy";
import { validActivationCommand } from "@/features/platform/activation-policy";
const validProvision = (value: unknown) =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  "reason" in value &&
  typeof value.reason === "string" &&
  value.reason.trim().length >= 5 &&
  value.reason.trim().length <= 1000;
type Context = { params: Promise<{ path?: string[] }> };
const noStore = { "Cache-Control": "no-store" };
async function readProof(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1048576) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  if (!size) return null;
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
async function proxy(request: Request, context: Context) {
  const { path = [] } = await context.params,
    target = platformTarget(path, request.method),
    mutating = request.method !== "GET";
  if (!target)
    return Response.json(
      { success: false, message: "Platform preview unavailable" },
      { status: 404, headers: noStore },
    );
  if (mutating && !isSameOriginRequest(request))
    return Response.json(
      { success: false, message: "Request origin could not be verified." },
      { status: 403, headers: noStore },
    );
  const token = (await cookies()).get("pharmacy_access")?.value;
  if (!token)
    return Response.json(
      { success: false, message: "Sign in to continue." },
      { status: 401, headers: noStore },
    );
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  const requestProofDownload=path[2]==='billing-request-proofs';
  if((requestProofDownload||path[2]==='billing-requests'&&path[4]==='proofs')&&new URL(request.url).search)return Response.json({success:false,message:'Invalid proof query.'},{status:422,headers:noStore});
  let body: string | ArrayBuffer | undefined;
  const proof =
    path[2] === "billing" && path[3] === "payments" && path[5] === "proofs";
  if (mutating && proof) {
    const key = request.headers.get("idempotency-key"),
      mime = request.headers.get("content-type"),
      name = request.headers.get("x-proof-name"),
      reason = request.headers.get("x-billing-reason");
    if (
      !key ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(key) ||
      new URL(request.url).search ||
      !mime ||
      !["application/pdf", "image/png", "image/jpeg"].includes(mime) ||
      !name ||
      name.length > 500 ||
      !reason ||
      reason.length > 4000
    )
      return Response.json(
        {
          success: false,
          message: "Check proof type, name, reason and save key.",
        },
        { status: 422, headers: noStore },
      );
    const proofBody = await readProof(request);
    if (!proofBody)
      return Response.json(
        { success: false, message: "Proof must be at most 1 MB." },
        { status: 422, headers: noStore },
      );
    body = proofBody;
    headers["Content-Type"] = mime;
    headers["Idempotency-Key"] = key;
    headers["X-Proof-Name"] = name;
    headers["X-Billing-Reason"] = reason;
  }
  if (mutating && !proof) {
    const key = request.headers.get("idempotency-key");
    if (
      !key ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(key) ||
      new URL(request.url).search ||
      request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
    )
      return Response.json(
        {
          success: false,
          message: "A JSON body and valid save key are required.",
        },
        { status: 422, headers: noStore },
      );
    try {
      body = await request.text();
      const value = JSON.parse(body);
      if (
        new TextEncoder().encode(body).byteLength > 8192 ||
        !(path[2]==='billing-requests'?validBillingReview(value):path[0] === "addons" || path[2] === "addons" ? validEntitlementBody(path,value) : path[2] === "billing"
          ? validBillingBody(path, value)
          : path[0] === "plans" || path[2] === "subscription"
            ? validCommercialBody(path, value)
            : path[2] === "activate"
              ? validActivationCommand(value)
              : path[2] === "provision"
                ? validProvision(value)
                : path[2] === "owner-invitations"
                  ? validIssueOwnerInvite(value)
                  : request.method === "POST"
                    ? validShopIntake(value)
                    : validPlatformCommand(value))
      )
        throw new Error("Invalid command");
    } catch {
      return Response.json(
        { success: false, message: "Check the shop details and reason." },
        { status: 422, headers: noStore },
      );
    }
    headers["Content-Type"] = "application/json";
    headers["Idempotency-Key"] = key;
  }
  try {
    const upstream = await fetch(target + new URL(request.url).search, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if(requestProofDownload&&upstream.ok)return await privateRequestProofResponse(upstream)??Response.json({success:false,message:'Private proof could not be verified.'},{status:502,headers:noStore});
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...noStore,
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        ...(upstream.headers.get("content-disposition")
          ? {
              "Content-Disposition": upstream.headers.get(
                "content-disposition",
              )!,
              "X-Content-Type-Options": "nosniff",
            }
          : {}),
      },
    });
  } catch {
    return Response.json(
      { success: false, message: "Platform server is unavailable." },
      { status: 502, headers: noStore },
    );
  }
}
export const GET = proxy;
export const PATCH = proxy;
export const POST = proxy;
export const DELETE = proxy;
