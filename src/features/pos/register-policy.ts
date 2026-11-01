export function registerAmount(value:string):number|null {
 const text=value.trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const amount=Number(text);
 return Number.isFinite(amount)&&amount<=99999999.99?amount:null;
}
export function registerExpected(value:unknown):number|null {
 if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!value.trim()))return null;
 const amount=Number(value);return Number.isFinite(amount)?amount:null;
}
export function registerDifference(actual:string,expected:unknown):number|null {
 const amount=registerAmount(actual),balance=registerExpected(expected);
 return amount===null||balance===null?null:(Math.round(amount*100)-Math.round(balance*100))/100;
}
export function registerCloseError(session:{id?:unknown;status?:unknown;branchId?:unknown;closingBalance?:unknown}|null,branch:string,originalBranch:string,amount:string){
 if(!branch||branch!==originalBranch)return 'The branch changed. Reopen the register dialog.';
 if(!session?.id||session.status!=='open')return 'This register session is no longer open. Refresh the register.';
 if(session.branchId!==branch)return 'This register session belongs to a different branch.';
 if(registerAmount(amount)===null)return 'Enter a cash balance of zero or more with at most two decimal places.';
 if(registerExpected(session.closingBalance)===null)return 'The server did not return a valid expected balance. Refresh before closing.';
 return '';
}
