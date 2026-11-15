export function validCustomizationBody(value:unknown,restore=false):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 if(!Number.isInteger(v.revision)||Number(v.revision)<0||Number(v.revision)>2147483646)return false;
 if(restore)return Object.keys(v).length===1;
 if(Object.keys(v).sort().join(',')!=='revision,templates,theme')return false;
 const check=(v:unknown,choices:Record<string,string[]>)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===Object.keys(choices).sort().join(',')&&Object.entries(choices).every(([key,allowed])=>allowed.includes((v as Record<string,string>)[key]));
 return check(v.theme,{palette:['pharmacy','ocean','violet','slate'],font:['system','rounded','compact'],density:['comfortable','compact']})&&check(v.templates,{pos:['cards','list'],receipt:['standard','compact'],report:['standard','dense']});
}
export function validCustomizationResponse(value:unknown):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as {revision?:unknown;configs?:{current?:unknown;history?:unknown}};
 if(!Number.isInteger(v.revision)||Number(v.revision)<0||!v.configs||!Array.isArray(v.configs.history)||v.configs.history.length>20)return false;
 const snapshot=(value:unknown)=>{if(!value||typeof value!=='object')return false;const row=value as {version?:number;publishedAt?:string;theme?:unknown;templates?:unknown};return Number.isInteger(row.version)&&Number(row.version)>0&&typeof row.publishedAt==='string'&&Number.isFinite(Date.parse(row.publishedAt))&&validCustomizationBody({revision:0,theme:row.theme,templates:row.templates});};
 if(!snapshot(v.configs.current)||!v.configs.history.every(snapshot))return false;
 const versions=[v.configs.current,...v.configs.history].map(row=>(row as {version:number}).version);return new Set(versions).size===versions.length&&versions.every((n,i)=>!i||n<versions[i-1]);
}
