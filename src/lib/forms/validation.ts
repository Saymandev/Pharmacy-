// Date-only values are validated before converting them to Dhaka timestamps.
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function dateRangeError(start: string, end: string) {
  if (!validDate(start) || !validDate(end)) return "Enter valid start and end dates.";
  return start > end ? "End date must be on or after start date." : "";
}
export function validEmail(value: string) { return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function wholeNumber(value: string, minimum = 0) { return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) >= minimum; }
export function validHttpUrl(value: string) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; } }
// node-cron supports five fields, with optional seconds; numeric fields and names.
export function validCron(value: string) {
  const names: Record<string, string> = { jan:"1",feb:"2",mar:"3",apr:"4",may:"5",jun:"6",jul:"7",aug:"8",sep:"9",oct:"10",nov:"11",dec:"12",sun:"0",mon:"1",tue:"2",wed:"3",thu:"4",fri:"5",sat:"6" };
  const fields=value.trim().toLowerCase().split(/\s+/);
  if(fields.length!==5&&fields.length!==6)return false;
  const bounds=fields.length===6?[[0,59],[0,59],[0,23],[1,31],[1,12],[0,7]]:[[0,59],[0,23],[1,31],[1,12],[0,7]];
  return fields.every((field,index)=>field.split(",").every(part=>{
    const named=part.replace(/[a-z]+/g,name=>{
      const monthIndex=fields.length===6?4:3,dayIndex=fields.length===6?5:4;
      return (index===monthIndex&&/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/.test(name)||index===dayIndex&&/^(sun|mon|tue|wed|thu|fri|sat)$/.test(name))?names[name]:"invalid";
    });
    const match=/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(named);if(!match||match[2]&&Number(match[2])===0)return false;
    if(match[1]==="*")return true;
    const [start,end=start]=match[1].split("-").map(Number),[min,max]=bounds[index];return start>=min&&end<=max&&start<=end;
  }));
}
export function validPassword(value: string) { return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value); }
