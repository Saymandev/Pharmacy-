import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendApiBase } from "@/lib/server/backend-url";
import { isSameOriginRequest } from "@/lib/server/request-security";

export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({success:false,message:"Request origin could not be verified."},{status:403});
 const token=(await cookies()).get("pharmacy_access")?.value;
 if(!token)return NextResponse.json({success:false,message:"Sign in to connect notifications."},{status:401});
 try{
  const base=backendApiBase();
  const upstream=await fetch(`${base}/auth/socket-ticket`,{method:"POST",headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!upstream.ok)return NextResponse.json({success:false,message:"Realtime connection is unavailable."},{status:upstream.status});
  const payload=await upstream.json();
  if(typeof payload?.data?.ticket!=="string")throw new Error("Invalid socket ticket");
  const url=new URL(process.env.BACKEND_SOCKET_URL||new URL(base).origin);
  if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw new Error("Invalid socket origin");
  return NextResponse.json({success:true,data:{ticket:payload.data.ticket,socketUrl:url.origin}},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({success:false,message:"Realtime connection is unavailable."},{status:502});}
}
