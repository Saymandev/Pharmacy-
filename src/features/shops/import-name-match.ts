type Option={id:string;tenantId:string;name:string;nameBangla?:string|null};
const normalize=(name:string)=>name.trim().normalize('NFC').toLocaleLowerCase();
/** A search page is not proof of uniqueness: inspect every bounded result page. */
export async function matchImportName(tenantId:string,name:string,load:(page:number)=>Promise<unknown>):Promise<Option|null>{
 const matches=new Map<string,Option>();
 if(!name.trim()||name.length>100)throw new Error('Enter a master name up to 100 characters.');
 for(let page=1;page<=50;page++){
  const value=await load(page) as {data?:Option[];meta?:{page:number;hasNextPage:boolean}};
  if(!value||!Array.isArray(value.data)||value.data.length>20||value.meta?.page!==page||typeof value.meta.hasNextPage!=='boolean')throw new Error('Master search could not be verified.');
  for(const row of value.data){
   if(!row||row.tenantId!==tenantId||typeof row.name!=='string'||typeof row.id!=='string'||!/^[0-9a-f-]{36}$/i.test(row.id)||(row.nameBangla!=null&&typeof row.nameBangla!=='string'))throw new Error('Master search could not be verified.');
   if(normalize(row.name)===normalize(name)||row.nameBangla&&normalize(row.nameBangla)===normalize(name))matches.set(row.id,row);
  }
  if(matches.size>1)throw new Error('Multiple exact matches. Select the correct master.');
  if(!value.meta.hasNextPage)return [...matches.values()][0]??null;
 }
 throw new Error('Too many search results. Select the correct master.');
}
