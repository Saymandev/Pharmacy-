export const medicineReferences=[
 {key:'categoryId',kind:'categories',label:'Category',permission:'medicine-category:read',relation:'category'},
 {key:'genericId',kind:'generics',label:'Generic',permission:'medicine-generic:read',relation:'generic'},
 {key:'groupId',kind:'groups',label:'Group',permission:'medicine-group:read',relation:'group'},
 {key:'medicineManufacturerId',kind:'manufacturers',label:'Manufacturer',permission:'medicine-manufacturer:read',relation:'medicineManufacturer'},
 {key:'medicineUnitId',kind:'units',label:'Medicine unit',permission:'medicine-unit:read',relation:'medicineUnit'},
] as const;
export type ReferenceOption={id:string;tenantId:string;name:string};
export function validReference(value:unknown,tenantId:string):value is ReferenceOption{return !!value&&typeof value==='object'&&'id'in value&&typeof value.id==='string'&&/^[0-9a-f-]{36}$/i.test(value.id)&&'tenantId'in value&&value.tenantId===tenantId&&'name'in value&&typeof value.name==='string';}
export type MedicineDraft=Record<string,string>&{name:string;unit:string;purchasePrice:string;salePrice:string;mrp:string;reorderLevel:string;isActive:string};
export const emptyMedicine:MedicineDraft={name:'',unit:'Pcs',purchasePrice:'0',salePrice:'0',mrp:'0',reorderLevel:'10',isActive:'true'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function medicinePayload(draft:MedicineDraft):Record<string,unknown>{
 const result:Record<string,unknown>={};
 if(!draft.name.trim()||draft.name.trim().length>200)throw new Error('Enter a medicine name up to 200 characters.');
 if(!draft.unit.trim()||draft.unit.trim().length>50)throw new Error('Enter a unit up to 50 characters.');
 result.name=draft.name.trim();result.unit=draft.unit.trim();
 for(const [key,max]of [['nameBangla',300],['genericName',200],['genericNameBangla',300],['barcode',100],['dosageForm',200],['strength',200]] as const){const value=(draft[key]??'').trim();if(value.length>max)throw new Error(`${key}: maximum ${max} characters.`);result[key]=value||null;}
 for(const key of ['purchasePrice','salePrice','mrp']){const value=draft[key].trim();if(!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)>99999999.99)throw new Error('Prices must be non-negative amounts with at most two decimals.');result[key]=Number(value);}
 if(!/^\d+$/.test(draft.reorderLevel)||Number(draft.reorderLevel)>2147483647)throw new Error('Reorder level must be a whole non-negative number.');
 result.reorderLevel=Number(draft.reorderLevel);if(!['true','false'].includes(draft.isActive))throw new Error('Choose a valid medicine status.');result.isActive=draft.isActive==='true';
 for(const ref of medicineReferences){const value=draft[ref.key]??'';if(value&&!uuid.test(value))throw new Error('Choose a valid medicine reference.');result[ref.key]=value||null;}
 return result;
}
export function editMedicineDraft(value:unknown,tenantId:string):{id:string;updatedAt:string;draft:MedicineDraft;labels:Record<string,string>}{
 if(!value||typeof value!=='object')throw new Error('Invalid medicine response.');const row=value as Record<string,unknown>;
 if(row.tenantId!==tenantId||typeof row.id!=='string'||!uuid.test(row.id)||typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt)))throw new Error('Invalid medicine response.');
 const draft={...emptyMedicine};const labels:Record<string,string>={};
 for(const key of ['name','nameBangla','genericName','genericNameBangla','barcode','unit','dosageForm','strength','purchasePrice','salePrice','mrp','reorderLevel','isActive']){
  const field=row[key];if(field!==null&&!['string','number','boolean'].includes(typeof field))throw new Error('Invalid medicine response.');draft[key]=field===null?'':String(field);
 }
 for(const ref of medicineReferences){if(row[ref.key]!==null&&typeof row[ref.key]!=='string')throw new Error('Invalid medicine reference.');draft[ref.key]=row[ref.key] as string??'';
  if(row[ref.relation]!=null){if(!validReference(row[ref.relation],tenantId)||(row[ref.relation]as ReferenceOption).id!==draft[ref.key])throw new Error('Invalid medicine reference.');labels[ref.key]=(row[ref.relation]as ReferenceOption).name;}
 }
 medicinePayload(draft);return {id:row.id,updatedAt:row.updatedAt,draft,labels};
}
