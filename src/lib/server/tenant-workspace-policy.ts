export function tenantWorkspaceTarget(tenantId:string,path:string[],method:string,config={
  session:process.env.TENANT_SESSION_PREVIEW_ENABLED,workspace:process.env.TENANT_WORKSPACE_PREVIEW_ENABLED,base:process.env.TENANT_BACKEND_API_URL,
}):{url:string;tenantId:string}|null{
  if(config.session!=='true'||config.workspace!=='true'||method!=='GET'||!config.base)return null;
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId))return null;
  const allowed=path.length===2&&path[0]==='workspace'&&path[1]==='bootstrap'||
    path.length===3&&path[0]==='workspace'&&path[1]==='branches'&&/^[0-9a-f-]{36}$/i.test(path[2]);
  if(!allowed)return null;
  try{
    const base=new URL(config.base);
    if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)return null;
    return {url:`${base.toString().replace(/\/$/,'')}/${path.map(encodeURIComponent).join('/')}`,tenantId};
  }catch{return null;}
}
