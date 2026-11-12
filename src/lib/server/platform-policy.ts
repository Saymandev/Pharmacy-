export function platformTarget(path:string[],method:string,config={enabled:process.env.PLATFORM_ADMIN_PREVIEW_ENABLED,writes:process.env.PLATFORM_ADMIN_WRITES_ENABLED,base:process.env.PLATFORM_BACKEND_API_URL}):string|null{
 if(config.enabled!=='true'||!config.base)return null;const id=(s:string)=>/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s);
 const read=method==='GET'&&(path.length===1&&['session','shops','audit'].includes(path[0])||path.length===2&&path[0]==='shops'&&id(path[1])||path.length===3&&path[0]==='shops'&&id(path[1])&&path[2]==='onboarding');
 const write=config.writes==='true'&&(method==='PATCH'&&path.length===3&&path[0]==='shops'&&id(path[1])&&path[2]==='status'||method==='POST'&&path.length===1&&path[0]==='shops');
 if(!read&&!write)return null;try{const base=new URL(config.base);if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.hash||base.search||!base.pathname.replace(/\/$/,'').endsWith('/platform'))return null;return `${base.toString().replace(/\/$/,'')}/${path.map(encodeURIComponent).join('/')}`;}catch{return null;}
}
