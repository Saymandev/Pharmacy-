export function validCustomizationBody(value:unknown,restore=false):boolean{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 if(!Number.isInteger(v.revision)||Number(v.revision)<0||Number(v.revision)>2147483646)return false;
 if(restore)return Object.keys(v).length===1;
 if(Object.keys(v).sort().join(',')!=='revision,templates,theme')return false;
 const check=(v:unknown,choices:Record<string,string[]>)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===Object.keys(choices).sort().join(',')&&Object.entries(choices).every(([key,allowed])=>allowed.includes((v as Record<string,string>)[key]));
 return check(v.theme,{palette:['pharmacy','ocean','violet','slate'],font:['system','rounded','compact'],density:['comfortable','compact']})&&check(v.templates,{pos:['cards','list'],receipt:['standard','compact'],report:['standard','dense']});
}
