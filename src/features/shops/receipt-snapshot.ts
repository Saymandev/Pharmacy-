export type ReceiptSnapshot={schemaVersion:1;tenantId:string;branchId:string;name:string;branchName:string;address:string;phone:string;footer:string;brandingRevision:number;template:'standard'|'compact';templateVersion:number;logo?:{id:string}|null};
export function receiptSnapshot(value:unknown,tenantId:string,branchId:string):ReceiptSnapshot|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as ReceiptSnapshot;
 if(v.schemaVersion!==1||v.tenantId!==tenantId||v.branchId!==branchId||!['standard','compact'].includes(v.template)||!Number.isInteger(v.templateVersion)||v.templateVersion<1||!Number.isInteger(v.brandingRevision)||v.brandingRevision<0)return null;
 for(const [key,max] of [['name',150],['branchName',200],['address',500],['phone',40],['footer',500]] as const)if(typeof v[key]!=='string'||v[key].length>max)return null;
 return v;
}
