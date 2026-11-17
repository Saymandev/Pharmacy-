export function memberInvitationTarget(path:string[],method:string,config:{enabled?:string;base?:string;registration?:string}={enabled:process.env.MEMBER_INVITATION_PREVIEW_ENABLED,base:process.env.MEMBER_INVITATION_BACKEND_API_URL,registration:process.env.MEMBER_REGISTRATION_PREVIEW_ENABLED}):string|null{
 const registration=config.registration==='true'&&path.length===2&&path[0]==='registration'&&['start','review','complete'].includes(path[1]);
 if(config.enabled!=='true'||!config.base||method!=='POST'||!(registration||path.length===1&&['preview','accept'].includes(path[0])))return null;
 try{const base=new URL(config.base);if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/member-invitations'))return null;return `${base.toString().replace(/\/$/,'')}/${path.join('/')}`;}catch{return null;}
}
