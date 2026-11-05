"use client";
import { DataSkeleton } from "@/components/ui/skeleton";
import { OperationsDialog } from "@/components/ui/operations-dialog";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Select } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { hrPermission } from "./hr-policy";
import { dateRangeError, validDate, validEmail, wholeNumber } from "@/lib/forms/validation";
import { financeAmount } from "@/features/finance/finance-policy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarCheck2, Check, Clock3, Edit3, Filter, Plus, Search, Trash2, Upload, UsersRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

type Data = {
  id: string; data?: unknown; name?: string; fullName?: string; employeeNumber?: string; employeeType?: string; employeeId?: string; status?: string; phone?: string; age?: number; gender?: string; email?: string; address?: string; branchId?: string; grossSalary?: number;
  joiningDate?: string; branch?: { id?: string; name?: string }; designation?: { name?: string }; department?: { name?: string };
  employee?: { id?: string; name?: string; employeeNumber?: string }; employeeName?: string; isoDate?: string; date?: string; createdAt?: string;
  shift?: string; clockIn?: string; clockOut?: string; workTime?: string; exception?: string; leaveType?: { name?: string };
  startDate?: string; endDate?: string; reason?: string; note?: string;
};
type Tab = "employees" | "attendance" | "leaves";
const sections: { id: Tab; label: string }[] = [{ id: "employees", label: "Employees" }, { id: "attendance", label: "Attendance" }, { id: "leaves", label: "Leave requests" }];
function records(value: unknown): Data[] { if (Array.isArray(value)) return value as Data[]; if (value && typeof value === "object") { const o = value as Data; if (Array.isArray(o.data)) return o.data; } return []; }
function errorText(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not complete the HR request."; }
function formatDate(value?: string,locale="en-GB") { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(locale, { timeZone:"Asia/Dhaka", day: "2-digit", month: "short", year: "numeric" }); }

export function HrWorkspace() {
 const {t,language}=useLanguage();
 const dateText=(value:string | undefined)=>formatDate(value,language==="bn"?"bn-BD":"en-GB");
  const { hasPermission } = useAuth();
  const { branches, activeBranchId: branchId } = useActiveBranch();
  const [selectedTab, setTab] = useState<Tab>("employees");
 const permitted=useMemo(()=>sections.filter(item => hasPermission(hrPermission(item.id, "read"))),[hasPermission]);
 const tab = permitted.find(item => item.id === selectedTab)?.id ?? permitted[0]?.id ?? sections[0].id;
 const canRead = hasPermission(hrPermission(tab, "read"));
 const mutationLock = useRef(false), listRequest = useRef(0);
  const [rows, setRows] = useState<Data[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Data[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<Data[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("");
  const [attendanceShift, setAttendanceShift] = useState("");
  const [attendanceDepartment, setAttendanceDepartment] = useState("");
  const [attendanceStartDate, setAttendanceStartDate] = useState("");
  const [attendanceEndDate, setAttendanceEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingAttendance, setImportingAttendance] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [employee, setEmployee] = useState({ name: "", branchId: "", employeeType: "staff", age: "18", gender: "", phone: "", email: "", address: "", grossSalary: "0", joiningDate: new Date().toISOString().slice(0, 10), status: "active" });
  const [attendance, setAttendance] = useState({ employeeId: "", branchId: "", date: new Date().toISOString().slice(0, 10), clockIn: "", clockOut: "", shift: "" });
  const [leave, setLeave] = useState({ employeeId: "", branchId: "", leaveTypeId: "", startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: "" });

  const load = useCallback(async () => {
    const request=++listRequest.current;
    if(!canRead){setRows([]);setLoading(false);return;}
    setRows([]);setLoading(true);
    if(tab==="attendance"&&((attendanceStartDate&&!validDate(attendanceStartDate))||(attendanceEndDate&&!validDate(attendanceEndDate))||(attendanceStartDate&&attendanceEndDate&&attendanceStartDate>attendanceEndDate))){setError("Enter a valid attendance date range.");setLoading(false);return;}
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set(tab === "employees" ? "search" : "searchTerm", search.trim());
      if (branchId) params.set("branchId", branchId);
      if ((tab === "employees" || tab === "leaves") && status) params.set("status", status);
      if (tab === "employees" && employeeTypeFilter) params.set("employeeType", employeeTypeFilter);
      if (tab === "attendance") {
        if (attendanceShift.trim()) params.set("shift", attendanceShift.trim());
        if (attendanceDepartment.trim()) params.set("department", attendanceDepartment.trim());
        if (attendanceStartDate) params.set("startDate", attendanceStartDate);
        if (attendanceEndDate) params.set("endDate", attendanceEndDate);
      }
      if (tab !== "leaves") { params.set("page", String(page)); params.set("limit", "20"); }
      const result = await api.getWithMeta<unknown>(`/hr/${tab}?${params}`);
      if(request!==listRequest.current)return;
      const resultRows = records(result);
      setRows(resultRows);
      const meta = result && typeof result === "object" ? (result as { meta?: Record<string, unknown> }).meta : undefined;
      setPageInfo({ total: Number(meta?.totalItems ?? meta?.total ?? resultRows.length) || 0, totalPages: Number(meta?.totalPages) || 1, limit: Number(meta?.pageSize ?? meta?.limit) || 20 });
      setError("");
    } catch (cause) { if(request===listRequest.current){setRows([]);setError(errorText(cause));} }
    finally { if(request===listRequest.current)setLoading(false); }
  }, [canRead, attendanceDepartment, attendanceEndDate, attendanceShift, attendanceStartDate, branchId, employeeTypeFilter, page, search, status, tab]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 120); const counter=listRequest;return () => {counter.current++;window.clearTimeout(timer);}; }, [load]);
  useEffect(() => {
    let active=true;
    const needsEmployees=dialog && tab!=="employees" && hasPermission("employee:read");
    const needsLeaveTypes=dialog && tab==="leaves" && hasPermission("leave-type:read");
    const q=branchId?`&branchId=${encodeURIComponent(branchId)}`:"";
    Promise.allSettled([needsEmployees?api.get<unknown>(`/hr/employees?page=1&limit=100&status=active${q}`):Promise.resolve([]),needsLeaveTypes?api.get<unknown>(`/hr/leave-types?${new URLSearchParams(branchId?{branchId}:{})}`):Promise.resolve([])]).then(([e,l])=>{if(!active)return;setEmployeeOptions(e.status==="fulfilled"?records(e.value):[]);setLeaveTypes(l.status==="fulfilled"?records(l.value):[]);if(e.status==="rejected"||l.status==="rejected")setError("Could not load form options. Close and reopen the form to retry.");});
    return()=>{active=false;};
  },[branchId,dialog,hasPermission,tab]);
  function openEmployeeEditor(item?: Data) {
    setError(""); setEditingEmployeeId(item?.id || null);
    setEmployee({ name: item?.name || item?.fullName || "", branchId: item?.branchId || item?.branch?.id || "", employeeType: item?.employeeType || "staff", age: item?.age == null ? "18" : String(item.age), gender: item?.gender || "", phone: item?.phone || "", email: item?.email || "", address: item?.address || "", grossSalary: item?.grossSalary == null ? "0" : String(item.grossSalary), joiningDate: item?.joiningDate ? item.joiningDate.slice(0, 10) : new Date().toISOString().slice(0, 10), status: item?.status || "active" });
    setDialog(true);
  }
  async function saveEmployee() {if(mutationLock.current || !hasPermission(editingEmployeeId ? "employee:update" : "employee:create")) return;
    if (!employee.name.trim() || !(employee.branchId || branchId) || !wholeNumber(employee.age,18) || !employee.gender.trim() || !employee.phone.trim() || !employee.address.trim()) { setError("Name, a branch, age 18 or older, gender, phone and address are required."); return; }
    if(financeAmount(employee.grossSalary,true)===null || !validDate(employee.joiningDate) || !validEmail(employee.email)){setError("Enter a valid joining date, email and non-negative salary with at most two decimal places.");return;}
    mutationLock.current=true;setSaving(true); setError("");
    try {
      const payload = { ...employee, branchId: employee.branchId || branchId, age: Number(employee.age), grossSalary: Number(employee.grossSalary), joiningDate: new Date(`${employee.joiningDate}T00:00:00.000+06:00`).toISOString(), email: employee.email || undefined };
      if (editingEmployeeId) await api.patch(`/hr/employees/${editingEmployeeId}`, payload); else await api.post("/hr/employees", payload);
      setDialog(false); setEditingEmployeeId(null); await load(); setNotice(editingEmployeeId ? "Employee details updated." : "Employee added to the directory.");
    } catch (cause) { setError(errorText(cause)); } finally { mutationLock.current=false;setSaving(false); }
  }
  async function deleteEmployee(item: Data) {if(mutationLock.current || !hasPermission("employee:delete")) return;
    if (!hasPermission("employee:delete") || !window.confirm(t("Delete {name}? The server may block deletion when HR or sales records are linked.",{name:item.name||item.fullName||t("Employee")}))) return;
    mutationLock.current=true;setSaving(true); setError("");
    try { await api.delete(`/hr/employees/${item.id}`); await load(); setNotice("Employee removed from the directory."); }
    catch (cause) { setError(errorText(cause)); }
    finally { mutationLock.current=false;setSaving(false); }
  }
  function openAttendanceEditor(item?: Data) {
    setError(""); setEditingAttendanceId(item?.id || null);
    const date = item?.isoDate || item?.date || item?.createdAt || new Date().toISOString();
    setAttendance({ employeeId: item?.employee?.id || item?.employeeId || "", branchId: item?.branchId || "", date: date.slice(0, 10), clockIn: item?.clockIn || "", clockOut: item?.clockOut || "", shift: item?.shift || "" });
    setDialog(true);
  }
  async function saveAttendance() {if(mutationLock.current || !hasPermission(editingAttendanceId ? "attendance:update" : "attendance:create")) return;
    if(!validDate(attendance.date)){setError("Enter a valid attendance date.");return;}
    const chosen = employeeOptions.find((item) => item.id === attendance.employeeId);
    if (!chosen || !(attendance.branchId || branchId)) { setError("Select an employee and branch first."); return; }
    mutationLock.current=true;setSaving(true); setError("");
    try {
      const payload = { employeeId: chosen.id, employeeName: chosen.name || chosen.fullName, branchId: attendance.branchId || branchId || "", date: attendance.date, isoDate: new Date(`${attendance.date}T00:00:00.000+06:00`).toISOString(), clockIn: attendance.clockIn || undefined, clockOut: attendance.clockOut || undefined, shift: attendance.shift || undefined };
      if (editingAttendanceId) await api.patch(`/hr/attendance/${editingAttendanceId}`, payload); else await api.post("/hr/attendance", payload);
      setDialog(false); setEditingAttendanceId(null); await load(); setNotice(editingAttendanceId ? "Attendance record updated." : "Attendance record saved.");
    } catch (cause) { setError(errorText(cause)); } finally { mutationLock.current=false;setSaving(false); }
  }
  async function deleteAttendance(item: Data) {if(mutationLock.current || !hasPermission("attendance:delete")) return;
    if (!hasPermission("attendance:delete") || !window.confirm(t("Delete this attendance record? This action cannot be undone."))) return;
    mutationLock.current=true;setSaving(true); setError("");
    try { await api.delete(`/hr/attendance/${item.id}`); await load(); setNotice("Attendance record deleted."); }
    catch (cause) { setError(errorText(cause)); }
    finally { mutationLock.current=false;setSaving(false); }
  }
  async function importAttendance(file: File | undefined) {if(mutationLock.current || !hasPermission("attendance:create")) return;
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) { setError("Choose an Excel workbook in .xlsx or .xls format."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Attendance workbook must be 10 MB or smaller."); return; }
    const selectedBranch = branchId;
    if (!selectedBranch) { setError("Add or select a branch before importing attendance."); return; }
    mutationLock.current=true;setImportingAttendance(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.upload<unknown>(`/hr/attendance/import/${selectedBranch}`, form);
      await load();
      const response = result && typeof result === "object" ? result as { message?: string; data?: { message?: string } } : {};
      setNotice(response.data?.message || response.message || "Attendance spreadsheet imported.");
    } catch (cause) { setError(errorText(cause)); }
    finally { mutationLock.current=false;setImportingAttendance(false); }
  }
  async function createLeave() {if(mutationLock.current || !hasPermission("leave:create")) return;
    const dateError=dateRangeError(leave.startDate,leave.endDate);if(dateError){setError(dateError);return;}
    if (!leave.employeeId || !leave.leaveTypeId || !(leave.branchId || branchId)) { setError("Employee, leave type and branch are required."); return; }
    mutationLock.current=true;setSaving(true); setError("");
    try {
      await api.post("/hr/leaves", { ...leave, branchId:leave.branchId||branchId, startDate: new Date(`${leave.startDate}T00:00:00.000+06:00`).toISOString(), endDate: new Date(`${leave.endDate}T23:59:59.999+06:00`).toISOString(), reason: leave.reason || undefined });
      setDialog(false); await load(); setNotice("Leave request submitted.");
    } catch (cause) { setError(errorText(cause)); } finally { mutationLock.current=false;setSaving(false); }
  }
  async function reviewLeave(next: "approved" | "rejected") {if(mutationLock.current || !hasPermission("leave:approve")) return;
    if(!reviewId || !rows.some(row=>row.id===reviewId&&row.status==="pending"))return;
    mutationLock.current=true;setSaving(true); setError("");
    try { await api.patch(`/hr/leaves/${reviewId}/approve`, { status: next, note: reviewNote || undefined }); setReviewId(""); await load(); setNotice(t(next==="approved"?"Leave request approved.":"Leave request rejected.")); }
    catch (cause) { setError(errorText(cause)); } finally { mutationLock.current=false;setSaving(false); }
  }
  function openDialog() { setError(""); if (tab === "employees") { setEditingEmployeeId(null); setEmployee({ name: "", branchId: "", employeeType: "staff", age: "18", gender: "", phone: "", email: "", address: "", grossSalary: "0", joiningDate: new Date().toISOString().slice(0, 10), status: "active" }); } if(tab==="attendance"){setEditingAttendanceId(null);setAttendance({employeeId:"",branchId:"",date:new Date().toISOString().slice(0,10),clockIn:"",clockOut:"",shift:""});} if(tab==="leaves"){setLeave({employeeId:"",branchId:"",leaveTypeId:"",startDate:new Date().toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10),reason:""});} setDialog(true); }

  const pending = tab === "leaves" ? rows.filter((row) => row.status === "pending").length : "—";
  if(!canRead)return <section className="notice-card">{t("Your role cannot view this page.")}</section>;
  return <section className="hr-page">
    <div className="page-heading-row"><div><p className="eyebrow">{t("PEOPLE · SHIFT OPERATIONS")}</p><h1>{t("HR & attendance")}</h1><p className="page-subtitle">{t("Manage your team, record daily attendance and review leave requests.")}</p></div><div className="inventory-heading-actions">{tab === "attendance" && hasPermission("attendance:create") && <label className="purchase-save-pending catalog-import-button" title={t("Excel .xlsx or .xls only, up to 10 MB. Required headers include AC-No., Name, Date, Clock In and Clock Out.")}><Upload size={14}/>{importingAttendance ? t("Importing…") : t("Import spreadsheet")}<input type="file" accept=".xlsx,.xls" disabled={importingAttendance} onChange={event => { void importAttendance(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>}{(tab==="employees"?hasPermission("employee:create"):tab==="attendance"?hasPermission("attendance:create")&&hasPermission("employee:read"):hasPermission("leave:create")&&hasPermission("employee:read")&&hasPermission("leave-type:read"))&&<button disabled={saving} className="purchase-primary-action" onClick={openDialog}><Plus size={15}/>{tab === "employees" ? t("Add employee") : tab === "attendance" ? t("Record attendance") : t("New leave request")}</button>}</div></div>
    {(error || notice) && <div className={`sales-alert ${error ? "error" : "success"}`}>{error ? <AlertCircle size={15}/> : <Check size={15}/>}<span role={error?"alert":"status"}>{t(error || notice)}</span><button disabled={saving} onClick={() => { setError(""); setNotice(""); }} aria-label={t("Dismiss")}><X size={14}/></button></div>}
    <div className="hr-summary"><article className="panel"><i><UsersRound size={17}/></i><span><small>{t("Team members in view")}</small><strong>{tab === "employees" && !loading ? pageInfo.total : employeeOptions.length || "—"}</strong></span></article><article className="panel"><i className="attendance-icon"><CalendarCheck2 size={17}/></i><span><small>{tab === "attendance" ? t("Attendance records") : t("Activity records")}</small><strong>{tab === "attendance" && !loading ? pageInfo.total : tab === "leaves" && !loading ? rows.length : "—"}</strong></span></article><article className="panel"><i className="leave-icon"><Clock3 size={17}/></i><span><small>{t("Pending leave requests")}</small><strong>{pending}</strong></span></article></div>
    {error&&!dialog&&<button disabled={saving} className="purchase-save-pending" onClick={()=>void load()}>{t("Retry")}</button>}<div className="hr-card panel"><nav className="data-tabs hr-tabs">{permitted.map((section) => <button disabled={saving} key={section.id} className={tab === section.id ? "selected" : ""} onClick={() => { setDialog(false);setReviewId("");setTab(section.id); setPage(1); setSearch(""); setStatus(""); setEmployeeTypeFilter(""); setAttendanceShift(""); setAttendanceDepartment(""); setAttendanceStartDate(""); setAttendanceEndDate(""); setFiltersOpen(false); }}>{t(section.label)}</button>)}</nav>
      <div className="hr-toolbar"><div className="sales-search"><Search size={15}/><input disabled={saving} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t(tab==="employees"?"Search name, phone or employee ID":tab==="attendance"?"Search employee attendance":"Search leave requests")}/></div>{branchId && <span className="hr-active-branch">{branches.find((branch) => branch.id === branchId)?.name || t("Active branch")}</span>}<button aria-expanded={filtersOpen} disabled={saving} className="data-filter-button" onClick={()=>setFiltersOpen(!filtersOpen)}><Filter size={14}/> {t("Filters")}</button></div>{filtersOpen&&<FilterPopover className="data-filter-drawer" onClose={() => setFiltersOpen(false)}>{tab === "leaves" && <label><span>{t("Status")}</span><Select disabled={saving} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">{t("All statuses")}</option>{["pending", "approved", "rejected"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</Select></label>}{tab==="employees" ? <><label><span>{t("Employment type")}</span><Select disabled={saving} value={employeeTypeFilter} onChange={e=>{setEmployeeTypeFilter(e.target.value);setPage(1);}}><option value="">{t("All employee types")}</option>{["doctor","nurse","staff","guest-doctor"].map(type=><option key={type} value={type}>{t(type)}</option>)}</Select></label><label><span>{t("Status")}</span><Select disabled={saving} value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">{t("All statuses")}</option>{["active","inactive","on_leave","terminated"].map(value=><option key={value} value={value}>{t(value.replace("_"," "))}</option>)}</Select></label><button disabled={saving} onClick={()=>{setEmployeeTypeFilter("");setStatus("");setPage(1);}}>{t("Clear filters")}</button></> : tab==="attendance" ? <><label><span>{t("Shift")}</span><input disabled={saving} value={attendanceShift} onChange={e=>{setAttendanceShift(e.target.value);setPage(1);}} placeholder={t("Filter shift")}/></label><label><span>{t("Department")}</span><input disabled={saving} value={attendanceDepartment} onChange={e=>{setAttendanceDepartment(e.target.value);setPage(1);}} placeholder={t("Filter department")}/></label><label><span>{t("From date")}</span><input disabled={saving} type="date" value={attendanceStartDate} onChange={e=>{setAttendanceStartDate(e.target.value);setPage(1);}}/></label><label><span>{t("Through date")}</span><input disabled={saving} type="date" value={attendanceEndDate} min={attendanceStartDate||undefined} onChange={e=>{setAttendanceEndDate(e.target.value);setPage(1);}}/></label><button disabled={saving} onClick={()=>{setAttendanceShift("");setAttendanceDepartment("");setAttendanceStartDate("");setAttendanceEndDate("");setPage(1);}}>{t("Clear filters")}</button></> : <span>{t("Use status selector to filter leave requests.")}</span>}</FilterPopover>}
      {tab === "employees" ? <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>{t("Employee")}</th><th>{t("Role")}</th><th>{t("Branch")}</th><th>{t("Phone")}</th><th>{t("Joined")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || row.fullName || t("Unnamed")}</strong><small>{row.employeeNumber || row.employeeType || t("Team member")}</small></td><td>{row.designation?.name || row.employeeType || "—"}<small>{row.department?.name || ""}</small></td><td>{row.branch?.name || "—"}</td><td>{row.phone || "—"}</td><td>{dateText(row.joiningDate)}</td><td><span className={`hr-status ${row.status || "active"}`}>{t((row.status || "active").replace("_", " "))}</span></td><td><div className="hr-row-actions">{hasPermission("employee:update")&&<button disabled={saving} onClick={()=>openEmployeeEditor(row)}><Edit3 size={13}/> {t("Edit")}</button>}{hasPermission("employee:delete")&&<button disabled={saving} onClick={()=>void deleteEmployee(row)}><Trash2 size={13}/> {t("Delete")}</button>}</div></td></tr>)}</tbody></table></div> : tab === "attendance" ? <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>{t("Employee")}</th><th>{t("Date")}</th><th>{t("Shift")}</th><th>{t("Clock in")}</th><th>{t("Clock out")}</th><th>{t("Hours / state")}</th><th>{t("Actions")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.employee?.name || row.employeeName || "—"}</strong><small>{row.employee?.employeeNumber || row.employeeNumber || ""}</small></td><td>{dateText(row.isoDate || row.date || row.createdAt)}</td><td>{row.shift || "—"}</td><td>{row.clockIn || "—"}</td><td>{row.clockOut || "—"}</td><td>{row.workTime || row.exception || t("Recorded")}</td><td><div className="hr-row-actions">{hasPermission("attendance:update")&&hasPermission("employee:read")&&<button disabled={saving} onClick={()=>openAttendanceEditor(row)}><Edit3 size={13}/> {t("Edit")}</button>}{hasPermission("attendance:delete")&&<button disabled={saving} onClick={()=>void deleteAttendance(row)}><Trash2 size={13}/> {t("Delete")}</button>}</div></td></tr>)}</tbody></table></div> : <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>{t("Employee")}</th><th>{t("Leave type")}</th><th>{t("Dates")}</th><th>{t("Reason")}</th><th>{t("Status")}</th><th>{t("Review")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.employee?.name || row.employeeName || "—"}</strong><small>{row.employee?.employeeNumber || ""}</small></td><td>{row.leaveType?.name || "—"}</td><td>{dateText(row.startDate)} – {dateText(row.endDate)}</td><td>{row.reason || row.note || "—"}</td><td><span className={`hr-status ${row.status || "pending"}`}>{t(row.status || "pending")}</span></td><td>{row.status === "pending" && hasPermission("leave:approve") && <button disabled={saving} className="hr-review-trigger" onClick={() => { setReviewId(row.id); setReviewNote(""); }}>{t("Review")}</button>}</td></tr>)}</tbody></table></div>}
      {!loading && !error && rows.length === 0 && <div className="data-empty"><UsersRound size={22}/><strong>{t("No")} {tab === "employees" ? t("employees") : tab === "attendance" ? t("attendance") : t("leave requests")} {t("found")}</strong><span>{t("Add a record or adjust the filters.")}</span></div>}{loading && <DataSkeleton variant="table">{t("Loading")} {t(tab)}…</DataSkeleton>}{tab!=="leaves"&&<div className="sales-pagination"><span>{pageInfo.total ? `${(page-1)*pageInfo.limit+1}–${Math.min(page*pageInfo.limit,pageInfo.total)} of ${pageInfo.total}` : t("No records")}</span><div><button type="button" disabled={loading||page<=1} onClick={()=>setPage(page-1)}>{t("Previous")}</button><span>{t("Page")} {page} {t("of")} {pageInfo.totalPages}</span><button type="button" disabled={loading||page>=pageInfo.totalPages} onClick={()=>setPage(page+1)}>{t("Next")}</button></div></div>}
    </div>
    {dialog && <OperationsDialog
      title={tab==="employees"?t(editingEmployeeId?"Edit employee":"Add employee"):tab==="attendance"?t(editingAttendanceId?"Edit attendance":"Record attendance"):t("New leave request")}
      description={t(tab==="employees"?"Create a staff profile for your pharmacy.":tab==="attendance"?"Record the employee’s attendance for a workday.":"Submit a leave request for review.")}
      icon={tab==="employees"?<UsersRound size={23}/>:tab==="attendance"?<Clock3 size={23}/>:<CalendarCheck2 size={23}/>}
      busy={saving} error={error} onClose={()=>setDialog(false)} onSubmit={tab==="employees"?saveEmployee:tab==="attendance"?saveAttendance:createLeave}
      actions={<button type="submit" className="purchase-primary-action" disabled={saving||(tab==="attendance"&&!employeeOptions.length)||(tab==="leaves"&&!leaveTypes.length)}>{saving?t("Saving…"):tab==="employees"?t(editingEmployeeId?"Save changes":"Save employee"):tab==="attendance"?t(editingAttendanceId?"Save changes":"Save attendance"):t("Submit request")}</button>}>
      {tab === "employees" ? <><label>{t("Full name")}<input disabled={saving} value={employee.name} onChange={(e) => setEmployee({ ...employee, name: e.target.value })}/></label><div className="customer-form-grid"><label>{t("Employee type")}<Select disabled={saving} value={employee.employeeType} onChange={(e) => setEmployee({ ...employee, employeeType: e.target.value })}>{["staff", "doctor", "nurse", "guest-doctor"].map((type) => <option key={type} value={type}>{t(type)}</option>)}</Select></label><label>{t("Age")}<input disabled={saving} type="number" min="18" value={employee.age} onChange={(e) => setEmployee({ ...employee, age: e.target.value })}/></label></div><div className="customer-form-grid"><label>{t("Gender")}<input disabled={saving} value={employee.gender} onChange={(e) => setEmployee({ ...employee, gender: e.target.value })}/></label><label>{t("Phone")}<input disabled={saving} value={employee.phone} onChange={(e) => setEmployee({ ...employee, phone: e.target.value })}/></label></div><label>{t("Email")}<input disabled={saving} type="email" value={employee.email} onChange={(e) => setEmployee({ ...employee, email: e.target.value })}/></label><label>{t("Branch")}<Select disabled={saving} value={employee.branchId || branchId || ""} onChange={(e) => setEmployee({ ...employee, branchId: e.target.value })}><option value="">{t("Choose branch")}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label><label>{t("Address")}<input disabled={saving} value={employee.address} onChange={(e) => setEmployee({ ...employee, address: e.target.value })}/></label><div className="customer-form-grid"><label>{t("Gross salary")}<input disabled={saving} type="number" min="0" value={employee.grossSalary} onChange={(e) => setEmployee({ ...employee, grossSalary: e.target.value })}/></label><label>{t("Joining date")}<input disabled={saving} type="date" value={employee.joiningDate} onChange={(e) => setEmployee({ ...employee, joiningDate: e.target.value })}/></label></div>{editingEmployeeId&&<label>{t("Employment status")}<Select disabled={saving} value={employee.status} onChange={e=>setEmployee({...employee,status:e.target.value})}>{["active","inactive","on_leave","terminated"].map(value=><option key={value} value={value}>{t(value.replace("_"," "))}</option>)}</Select></label>}</> : tab === "attendance" ? <><label>{t("Employee")}<Select disabled={saving} value={attendance.employeeId} onChange={(e) => setAttendance({ ...attendance, employeeId: e.target.value })}><option value="">{t("Choose employee")}</option>{employeeOptions.map((item) => <option key={item.id} value={item.id}>{item.name || item.fullName} · {item.employeeNumber || item.employeeType}</option>)}</Select></label><label>{t("Branch")}<Select disabled={saving} value={attendance.branchId || branchId || ""} onChange={(e) => setAttendance({ ...attendance, branchId: e.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label><div className="customer-form-grid"><label>{t("Date")}<input disabled={saving} type="date" value={attendance.date} onChange={(e) => setAttendance({ ...attendance, date: e.target.value })}/></label><label>{t("Shift")}<input disabled={saving} value={attendance.shift} onChange={(e) => setAttendance({ ...attendance, shift: e.target.value })} placeholder={t("Morning")}/></label></div><div className="customer-form-grid"><label>{t("Clock in")}<input disabled={saving} type="time" value={attendance.clockIn} onChange={(e) => setAttendance({ ...attendance, clockIn: e.target.value })}/></label><label>{t("Clock out")}<input disabled={saving} type="time" value={attendance.clockOut} onChange={(e) => setAttendance({ ...attendance, clockOut: e.target.value })}/></label></div></> : <><label>{t("Employee")}<Select disabled={saving} value={leave.employeeId} onChange={(e) => setLeave({ ...leave, employeeId: e.target.value })}><option value="">{t("Choose employee")}</option>{employeeOptions.map((item) => <option key={item.id} value={item.id}>{item.name || item.fullName}</option>)}</Select></label><label>{t("Leave type")}<Select disabled={saving} value={leave.leaveTypeId} onChange={(e) => setLeave({ ...leave, leaveTypeId: e.target.value })}><option value="">{t("Choose leave type")}</option>{leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label>{t("Branch")}<Select disabled={saving} value={leave.branchId || branchId || ""} onChange={(e) => setLeave({ ...leave, branchId: e.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label><div className="customer-form-grid"><label>{t("From")}<input disabled={saving} type="date" value={leave.startDate} onChange={(e) => setLeave({ ...leave, branchId:leave.branchId||branchId, startDate: e.target.value })}/></label><label>{t("Through")}<input disabled={saving} type="date" min={leave.startDate} value={leave.endDate} onChange={(e) => setLeave({ ...leave, endDate: e.target.value })}/></label></div><label>{t("Reason")}<input disabled={saving} value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })}/></label></>}    </OperationsDialog>}
    {reviewId && <OperationsDialog compact title={t("Review leave request")} description={t("Approve or decline this employee’s leave application.")} icon={<CalendarCheck2 size={23}/>} busy={saving} error={error} onClose={()=>setReviewId("")} actions={<><button type="button" className="operations-decline" disabled={saving} onClick={()=>void reviewLeave("rejected")}>{t("Decline")}</button><button type="button" className="purchase-primary-action" disabled={saving} onClick={()=>void reviewLeave("approved")}>{t("Approve request")}</button></>}><label>{t("Review note")}<textarea disabled={saving} rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label></OperationsDialog>}

  </section>;
}

