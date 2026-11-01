import {api} from '@/lib/api/client';
import {readPagination} from '@/lib/api/pagination';
export function customerRows<T>(value:unknown):T[]{if(Array.isArray(value))return value as T[];if(value&&typeof value==='object'){const row=value as Record<string,unknown>;for(const key of ['data','sales','returns','customers'])if(key in row)return customerRows<T>(row[key]);}return [];}
export async function fetchCustomerPages<T>(path:string,filters:Record<string,string>,signal?:AbortSignal):Promise<T[]>{
 const output:T[]=[];
 for(let page=1;page<=1000;page++){
  if(signal?.aborted)throw new Error('Request cancelled.');
  const query=new URLSearchParams({...filters,page:String(page),limit:'100'});
  const result=await api.getWithMeta<unknown>(`${path}?${query}`,{signal});const rows=customerRows<T>(result);const meta=readPagination(result,rows.length,page,100);
  output.push(...rows);
  if(!meta.hasNextPage)return output;
  if(!rows.length)throw new Error('History is incomplete. Refresh before collecting or exporting.');
 }
 throw new Error('History exceeds the supported export size. Contact support for a full statement.');
}
