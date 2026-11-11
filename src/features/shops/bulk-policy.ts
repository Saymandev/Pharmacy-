export const importColumns=['name','nameBangla','genericName','genericNameBangla','barcode','unit','dosageForm','strength','purchasePrice','salePrice','mrp','reorderLevel','isActive','categoryId','genericId','groupId','medicineManufacturerId','medicineUnitId'] as const;
export type ImportRow=Record<string,string|number|boolean>;
const prices=['purchasePrice','salePrice','mrp'];
export function priceNumber(value:unknown):number{
 if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value))||Number(value)>99999999.99)throw new Error('Enter a price from 0 to 99999999.99 with up to two decimals.');
 return Number(value);
}
export function validateImportRows(value:unknown):value is ImportRow[]{
 if(!Array.isArray(value)||!value.length||value.length>100)return false;
 const codes=new Set<string>();
 try{for(const row of value){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!importColumns.includes(key as typeof importColumns[number])))return false;
  if(typeof row.name!=='string'||!row.name.trim()||row.name.length>200)return false;
  for(const [key,item]of Object.entries(row)){
   if(prices.includes(key)){if(typeof item!=='number')return false;priceNumber(item);}
   else if(key==='reorderLevel'){if(!Number.isInteger(item)||Number(item)<0||Number(item)>2147483647)return false;}
   else if(key==='isActive'){if(typeof item!=='boolean')return false;}
   else if(['categoryId','genericId','groupId','medicineManufacturerId','medicineUnitId'].includes(key)){if(typeof item!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item))return false;}
   else {const max=key==='nameBangla'||key==='genericNameBangla'?300:key==='barcode'?100:key==='unit'?50:200;if(typeof item!=='string'||!item.trim()||item.length>max||/^[=+@\-\t\r]/.test(item))return false;}
  }
  if(typeof row.barcode==='string'){if(codes.has(row.barcode))return false;codes.add(row.barcode);}
 }}catch{return false;}return true;
}
/** Bounded RFC-style CSV scanner: quoted delimiters/newlines, escaped quotes and UTF-8 BOM. */
export function parseImportCsv(text:string):ImportRow[]{
 if(new TextEncoder().encode(text).length>131072)throw new Error('CSV must be 128 KB or smaller.');
 const grid:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const field=()=>{row.push(cell);cell='';closed=false;if(row.length>importColumns.length)throw new Error('Too many CSV columns.');};
 const line=()=>{field();if(row.some(value=>value.trim()))grid.push(row);row=[];if(grid.length>101)throw new Error('Import at most 100 medicines.');};
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const char=text[i];if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;}
  else if(char===',')field();else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;line();}
  else if(char==='"'&&!cell&&!closed)quoted=true;else{if(closed||char==='"')throw new Error('Invalid CSV quoting.');cell+=char;}
  if(cell.length>1000)throw new Error('CSV field is too long.');
 }
 if(quoted)throw new Error('Unclosed CSV quote.');if(cell||row.length||closed)line();
 const headers=grid.shift()?.map(value=>value.trim());
 if(!headers?.includes('name')||new Set(headers).size!==headers.length||headers.some(value=>!importColumns.includes(value as typeof importColumns[number])))throw new Error('Use the sample CSV column names. Name is required.');
 const rows=grid.map((cells,index)=>{
  if(cells.length!==headers.length)throw new Error(`CSV row ${index+2}: column count does not match.`);
  const item:ImportRow={};for(let j=0;j<headers.length;j++){const key=headers[j],value=cells[j].trim();if(!value)continue;
   if(prices.includes(key))item[key]=priceNumber(value);
   else if(key==='reorderLevel'){if(!/^\d+$/.test(value))throw new Error(`CSV row ${index+2}: invalid reorder level.`);item[key]=Number(value);}
   else if(key==='isActive'){if(!['true','false'].includes(value))throw new Error(`CSV row ${index+2}: use true or false.`);item[key]=value==='true';}
   else item[key]=value;
  }if(!validateImportRows([item]))throw new Error(`CSV row ${index+2}: check required name, text lengths and prices.`);return item;
 });if(!validateImportRows(rows))throw new Error('Import needs 1–100 valid medicines with unique barcodes.');return rows;
}
export type PriceRow={medicineId:string;sku:string;unitPrice:number;mrp:number;expectedUnitPrice:number;expectedMrp:number};
export function validPriceRows(value:unknown):value is PriceRow[]{
 if(!Array.isArray(value)||!value.length||value.length>100)return false;
 const seen=new Set<string>();try{for(const row of value){if(!row||typeof row!=='object'||Object.keys(row).sort().join(',')!==['medicineId','sku','unitPrice','mrp','expectedUnitPrice','expectedMrp'].sort().join(',')||!['medicineId','sku'].every(key=>typeof row[key]==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row[key]))||seen.has(row.sku))return false;seen.add(row.sku);for(const key of ['unitPrice','mrp','expectedUnitPrice','expectedMrp']){if(typeof row[key]!=='number')return false;priceNumber(row[key]);}}}catch{return false;}return true;
}
