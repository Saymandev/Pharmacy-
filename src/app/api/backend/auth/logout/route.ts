import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {backendApiBase} from '@/lib/server/backend-url';
import {isSameOriginRequest} from '@/lib/server/request-security';
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return NextResponse.json({success:false,message:'Request origin could not be verified.'},{status:403});
 if(process.env.SAAS_RUNTIME_ENABLED!=='true')return NextResponse.json({success:false,message:'SaaS runtime unavailable.'},{status:404});
 const token=(await cookies()).get('pharmacy_access')?.value;
 if(token){try{const upstream=await fetch(`${backendApiBase()}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(!upstream.ok&&upstream.status!==401)throw new Error();}catch{return NextResponse.json({success:false,message:'Sign out could not be confirmed. Retry sign out.'},{status:502});}}
 const response=NextResponse.json({success:true,message:'Signed out.'},{headers:{'Cache-Control':'no-store'}});for(const name of ['pharmacy_access','pharmacy_refresh'])response.cookies.set(name,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/backend',maxAge:0});return response;
}
