export const hrKinds=['employees','departments','designations','leave-types','calendars','shifts','rosters','assignments','attendance','leaves'] as const;
export type HrKind=typeof hrKinds[number];
export type HrField={key:string;label:string;type:'text'|'textarea'|'number'|'money'|'date'|'time'|'select'|'boolean'|'reference';nullable?:boolean;options?:string[];ref?:HrKind;min?:number;max?:number};
const text=(key:string,label:string,nullable=false):HrField=>({key,label,type:'text',nullable});
const ref=(key:string,label:string,kind:HrKind,nullable=false):HrField=>({key,label,type:'reference',ref:kind,nullable});
const range:HrField[]=[{key:'startDate',label:'Start date',type:'date'},{key:'endDate',label:'End date',type:'date'}];
const named:HrField[]=[text('name','Name'),text('nameBangla','Bangla name',true),{key:'description',label:'Description',type:'textarea',nullable:true}];
export const hrDefs:Record<HrKind,{label:string;cap:string;group:string;fields:HrField[]}>= {
 employees:{label:'Employees',cap:'employee',group:'Staff',fields:[text('employeeNumber','Employee number'),text('name','Full name'),text('nameBangla','Bangla name',true),{key:'age',label:'Age',type:'number',min:18,max:100},{key:'gender',label:'Gender',type:'select',options:['male','female','other']},text('phone','Phone'),text('email','Email',true),{key:'address',label:'Address',type:'textarea'},ref('departmentId','Department','departments',true),ref('designationId','Designation','designations',true),{key:'grossSalary',label:'Gross salary',type:'money',min:0,max:99999999.99},{key:'joiningDate',label:'Joining date',type:'date'},{key:'leavingDate',label:'Leaving date',type:'date',nullable:true},{key:'status',label:'Employee status',type:'select',options:['active','inactive','on_leave','terminated']}]},
 departments:{label:'Departments',cap:'department',group:'Setup',fields:named},
 designations:{label:'Designations',cap:'designation',group:'Setup',fields:[...named,ref('departmentId','Department','departments')]},
 'leave-types':{label:'Leave types',cap:'leave-type',group:'Setup',fields:[...named,{key:'maxDaysPerYear',label:'Annual allowance (0 = unlimited)',type:'number',min:0,max:366},{key:'isPaid',label:'Paid leave',type:'boolean'}]},
 calendars:{label:'Annual calendar',cap:'annual-calendar',group:'Setup',fields:[...named,{key:'type',label:'Calendar type',type:'select',options:['holiday','vacation','event']},...range]},
 shifts:{label:'Shifts',cap:'shift',group:'Schedule',fields:[...named,{key:'startTime',label:'Start time',type:'time'},{key:'endTime',label:'End time',type:'time'}]},
 rosters:{label:'Duty rosters',cap:'roster',group:'Schedule',fields:[ref('shiftId','Shift','shifts'),...range,{key:'description',label:'Description',type:'textarea',nullable:true}]},
 assignments:{label:'Roster assignments',cap:'assigned-roster',group:'Schedule',fields:[ref('employeeId','Employee','employees'),ref('rosterId','Roster','rosters'),...range,{key:'description',label:'Description',type:'textarea',nullable:true}]},
 attendance:{label:'Attendance',cap:'attendance',group:'Attendance & leave',fields:[ref('employeeId','Employee','employees'),{key:'day',label:'Attendance date',type:'date'},{key:'manualStatus',label:'Attendance status',type:'select',options:['present','absent','leave','holiday']},{key:'clockIn',label:'Clock in',type:'time',nullable:true},{key:'clockOut',label:'Clock out',type:'time',nullable:true},{key:'manualNote',label:'Correction note',type:'textarea',nullable:true}]},
 leaves:{label:'Leave requests',cap:'leave',group:'Attendance & leave',fields:[ref('employeeId','Employee','employees'),ref('leaveTypeId','Leave type','leave-types'),...range,{key:'reason',label:'Leave reason',type:'textarea'}]},
};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export const realHrDay=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time=(v:unknown)=>typeof v==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
export type HrRow={id:string;tenantId:string;branchId:string;updatedAt:string;createdAt:string;[key:string]:unknown};
export type HrPage={tenantId:string;branchId:string;kind:HrKind;items:HrRow[];page:number;pageSize:20;totalItems:number};
export type HrAction='create'|'update'|'delete'|'decision'|'membership';
export function validHrBody(v:unknown,kind:HrKind,action:HrAction):boolean{
 if(!obj(v)||!hrKinds.includes(kind)||!uuid(v.branchId)||action!=='create'&&!date(v.expectedUpdatedAt))return false;
 const keys=Object.keys(v),allowed=['branchId',...(action==='create'?[]:['expectedUpdatedAt'])];
 if(action==='delete')return keys.length===2&&keys.every(k=>allowed.includes(k));
 if(action==='decision')return kind==='leaves'&&keys.length===4&&keys.every(k=>[...allowed,'status','note'].includes(k))&&['approved','rejected'].includes(String(v.status))&&(v.note===null||typeof v.note==='string'&&v.note.length<=1000);
 if(action==='membership')return kind==='employees'&&keys.length===3&&keys.every(k=>[...allowed,'membershipId'].includes(k))&&(v.membershipId===null||uuid(v.membershipId));
 const fields=hrDefs[kind].fields;if(keys.length!==allowed.length+fields.length||!keys.every(k=>allowed.includes(k)||fields.some(f=>f.key===k)))return false;
 for(const f of fields){const value=v[f.key];if(value===null&&f.nullable)continue;if(f.type==='boolean'){if(typeof value!=='boolean')return false;}else if(f.type==='reference'){if(!uuid(value))return false;}else if(['number','money'].includes(f.type)){if(typeof value!=='number'||!Number.isFinite(value)||value<(f.min??0)||value>(f.max??99999999.99)||(f.type==='number'?!Number.isInteger(value):Math.abs(value*100-Math.round(value*100))>0.00001))return false;}else if(f.type==='date'){if(!realHrDay(value))return false;}else if(f.type==='time'){if(!time(value))return false;}else if(f.type==='select'){if(!f.options?.includes(String(value)))return false;}else if(typeof value!=='string'||!value.trim()&&!f.nullable||value.length>(f.type==='textarea'?1000:f.key==='nameBangla'?200:f.key==='employeeNumber'||f.key==='phone'?40:f.key==='email'?254:150))return false;}
 if(v.email!==null&&typeof v.email==='string'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return false;
 if('startDate'in v&&(String(v.endDate)<String(v.startDate)||(Date.parse(String(v.endDate))-Date.parse(String(v.startDate)))/86400000>=366))return false;
 if(kind==='leaves'&&String(v.startDate).slice(0,4)!==String(v.endDate).slice(0,4))return false;
 if(kind==='shifts'&&v.startTime===v.endTime)return false;
 if(kind==='employees'&&v.leavingDate&&String(v.leavingDate)<String(v.joiningDate))return false;
 if(kind==='attendance'&&(v.manualStatus==='present'?!v.clockIn:!!v.clockIn||!!v.clockOut))return false;
 return true;
}
export function hrFormValues(kind:HrKind,row?:HrRow):Record<string,string|boolean>{return Object.fromEntries(hrDefs[kind].fields.map(f=>{let value=row?.[f.key];if(f.key==='day')value=row?.isoDate;if(f.type==='date'&&typeof value==='string')value=value.slice(0,10);if(f.type==='time'&&typeof value==='string'&&value.includes('T'))value=value.slice(11,16);return [f.key,f.type==='boolean'?(typeof value==='boolean'?value:true):value==null?(f.type==='select'&&f.key!=='gender'?f.options?.[0]??'':''):String(value)];}));}
export function hrFormBody(kind:HrKind,branchId:string,values:Record<string,string|boolean>,row?:HrRow){return {branchId,...Object.fromEntries(hrDefs[kind].fields.map(f=>[f.key,values[f.key]===''&&f.nullable?null:['number','money'].includes(f.type)?values[f.key]===''?null:Number(values[f.key]):f.type==='boolean'?values[f.key]:String(values[f.key]??'').trim()])),...(row?{expectedUpdatedAt:row.updatedAt}:{})};}
const extra:Record<HrKind,string[]>={employees:['employeeType','department','designation'],departments:[],designations:['department'],'leave-types':[],calendars:['dayCount'],shifts:['totalHours'],rosters:['totalDays','shift'],assignments:['totalDays','employee'],attendance:['employeeName','isoDate'],leaves:['totalDays','status','note','employee','leaveType']};
export function validHrRow(v:unknown,tenantId:string,branchId:string,kind:HrKind):v is HrRow{
 if(!obj(v)||!uuid(v.id)||v.tenantId!==tenantId||v.branchId!==branchId||!date(v.createdAt)||!date(v.updatedAt)||!Object.keys(v).every(k=>['id','tenantId','branchId','createdAt','updatedAt',...hrDefs[kind].fields.map(f=>f.key),...extra[kind]].includes(k)))return false;
 for(const k of ['department','designation','shift','employee','leaveType'])if(v[k]!=null){const ref=v[k];if(!obj(ref)||!uuid(ref.id)||ref.tenantId!==tenantId||ref.branchId!==branchId||typeof ref.name!=='string'||Object.keys(ref).some(k=>!['id','tenantId','branchId','name'].includes(k)))return false;}
 if(kind==='employees'&&v.employeeType!=='staff')return false;
 if(kind==='attendance'&&v.manualStatus===null)return typeof v.employeeName==='string'&&(v.employeeId===null||uuid(v.employeeId));
 for(const f of hrDefs[kind].fields){const key=f.key==='day'?'isoDate':f.key,value=v[key];if(!(key in v))return false;if(value===null&&f.nullable)continue;if(f.type==='boolean'&&typeof value!=='boolean'||f.type==='number'&&typeof value!=='number'||f.type==='money'&&!['number','string'].includes(typeof value)||!['boolean','number','money'].includes(f.type)&&typeof value!=='string')return false;}
 for(const key of ['totalDays','dayCount'])if(key in v&&(!Number.isInteger(v[key])||Number(v[key])<1||Number(v[key])>366))return false;
 if(kind==='shifts'&&(!Number.isFinite(Number(v.totalHours))||Number(v.totalHours)<=0||Number(v.totalHours)>=24))return false;
 const body=hrFormBody(kind,branchId,hrFormValues(kind,v as HrRow));return validHrBody(body,kind,'create')&&(kind!=='leaves'||['pending','approved','rejected'].includes(String(v.status)));
}
export function validHrPage(v:unknown,tenant:string,branch:string,kind:HrKind,page:number):v is HrPage{return obj(v)&&v.tenantId===tenant&&v.branchId===branch&&v.kind===kind&&v.page===page&&v.pageSize===20&&Number.isSafeInteger(v.totalItems)&&Number(v.totalItems)>=0&&Array.isArray(v.items)&&v.items.length<=20&&new Set(v.items.map(r=>obj(r)?r.id:null)).size===v.items.length&&v.items.every(r=>validHrRow(r,tenant,branch,kind));}
export function hrName(kind:HrKind,row:HrRow){return String(row.name??row.employeeName??(obj(row.employee)?row.employee.name:null)??(kind==='rosters'&&obj(row.shift)?row.shift.name:null)??hrDefs[kind].label);}
export function validHrReceipt(v:unknown,tenant:string,branch:string,kind:HrKind,action:HrAction,expectedId:string|null):v is HrRow{
 if(action==='create'||action==='update'||action==='decision')return validHrRow(v,tenant,branch,kind)&&(!expectedId||v.id===expectedId);
 return obj(v)&&v.id===expectedId&&v.tenantId===tenant&&v.branchId===branch&&Object.keys(v).every(k=>['id','tenantId','branchId',...(action==='delete'?['deleted']:['updatedAt','membershipId'])].includes(k))&&(action==='delete'?v.deleted===true:date(v.updatedAt)&&(v.membershipId===null||uuid(v.membershipId)));
}
