"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarCheck2, Check, Clock3, Edit3, Filter, Plus, Search, Trash2, Upload, UsersRound, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";

type Data = {
  id: string; data?: unknown; name?: string; fullName?: string; employeeNumber?: string; employeeType?: string; employeeId?: string; status?: string; phone?: string; age?: number; gender?: string; email?: string; address?: string; branchId?: string; grossSalary?: number;
  joiningDate?: string; branch?: { id?: string; name?: string }; designation?: { name?: string }; department?: { name?: string };
  employee?: { id?: string; name?: string; employeeNumber?: string }; employeeName?: string; isoDate?: string; date?: string; createdAt?: string;
  shift?: string; clockIn?: string; clockOut?: string; workTime?: string; exception?: string; leaveType?: { name?: string };
  startDate?: string; endDate?: string; reason?: string; note?: string;
};
type Branch = { id: string; name: string };
type Tab = "employees" | "attendance" | "leaves";
const sections: { id: Tab; label: string }[] = [{ id: "employees", label: "Employees" }, { id: "attendance", label: "Attendance" }, { id: "leaves", label: "Leave requests" }];
function records(value: unknown): Data[] { if (Array.isArray(value)) return value as Data[]; if (value && typeof value === "object") { const o = value as Data; if (Array.isArray(o.data)) return o.data; } return []; }
function errorText(error: unknown) { return error instanceof ApiClientError ? error.message : "Could not complete the HR request."; }
function dateText(value?: string) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function HrWorkspace() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("employees");
  const [rows, setRows] = useState<Data[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Data[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<Data[]>([]);
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("");
  const [attendanceShift, setAttendanceShift] = useState("");
  const [attendanceDepartment, setAttendanceDepartment] = useState("");
  const [attendanceStartDate, setAttendanceStartDate] = useState("");
  const [attendanceEndDate, setAttendanceEndDate] = useState("");
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
    setLoading(true);
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
      if (tab !== "leaves") { params.set("page", "1"); params.set("limit", "100"); }
      setRows(records(await api.get<unknown>(`/hr/${tab}?${params}`)));
      setError("");
    } catch (cause) { setError(errorText(cause)); setRows([]); }
    finally { setLoading(false); }
  }, [attendanceDepartment, attendanceEndDate, attendanceShift, attendanceStartDate, branchId, employeeTypeFilter, search, status, tab]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 120); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.allSettled([api.get<unknown>("/branches?page=1&limit=100"), api.get<unknown>("/hr/employees?page=1&limit=100&status=active"), api.get<unknown>("/hr/leave-types")]).then(([b, e, l]) => {
        if (b.status === "fulfilled") setBranches(records(b.value) as Branch[]);
        if (e.status === "fulfilled") setEmployeeOptions(records(e.value));
        if (l.status === "fulfilled") setLeaveTypes(records(l.value));
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function openEmployeeEditor(item?: Data) {
    setError(""); setEditingEmployeeId(item?.id || null);
    setEmployee({ name: item?.name || item?.fullName || "", branchId: item?.branchId || item?.branch?.id || "", employeeType: item?.employeeType || "staff", age: item?.age == null ? "18" : String(item.age), gender: item?.gender || "", phone: item?.phone || "", email: item?.email || "", address: item?.address || "", grossSalary: item?.grossSalary == null ? "0" : String(item.grossSalary), joiningDate: item?.joiningDate ? item.joiningDate.slice(0, 10) : new Date().toISOString().slice(0, 10), status: item?.status || "active" });
    setDialog(true);
  }
  async function saveEmployee() {
    if (!employee.name.trim() || !(employee.branchId || branches[0]?.id) || Number(employee.age) < 18 || !employee.gender.trim() || !employee.phone.trim() || !employee.address.trim()) { setError("Name, a branch, age 18 or older, gender, phone and address are required."); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...employee, branchId: employee.branchId || branches[0]?.id, age: Number(employee.age), grossSalary: Number(employee.grossSalary), joiningDate: new Date(`${employee.joiningDate}T00:00:00.000+06:00`).toISOString(), email: employee.email || undefined };
      if (editingEmployeeId) await api.patch(`/hr/employees/${editingEmployeeId}`, payload); else await api.post("/hr/employees", payload);
      setDialog(false); setEditingEmployeeId(null); await load(); setNotice(editingEmployeeId ? "Employee details updated." : "Employee added to the directory.");
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  async function deleteEmployee(item: Data) {
    if (!hasPermission("employee:delete") || !window.confirm(`Delete ${item.name || item.fullName || "this employee"}? The server may block deletion when HR or sales records are linked.`)) return;
    setSaving(true); setError("");
    try { await api.delete(`/hr/employees/${item.id}`); await load(); setNotice("Employee removed from the directory."); }
    catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }
  function openAttendanceEditor(item?: Data) {
    setError(""); setEditingAttendanceId(item?.id || null);
    const date = item?.isoDate || item?.date || item?.createdAt || new Date().toISOString();
    setAttendance({ employeeId: item?.employee?.id || item?.employeeId || "", branchId: item?.branchId || "", date: date.slice(0, 10), clockIn: item?.clockIn || "", clockOut: item?.clockOut || "", shift: item?.shift || "" });
    setDialog(true);
  }
  async function saveAttendance() {
    const chosen = employeeOptions.find((item) => item.id === attendance.employeeId);
    if (!chosen || !(attendance.branchId || branches[0]?.id)) { setError("Select an employee and branch first."); return; }
    setSaving(true); setError("");
    try {
      const payload = { employeeId: chosen.id, employeeName: chosen.name || chosen.fullName, branchId: attendance.branchId || branches[0]?.id || "", date: attendance.date, isoDate: new Date(`${attendance.date}T00:00:00.000+06:00`).toISOString(), clockIn: attendance.clockIn || undefined, clockOut: attendance.clockOut || undefined, shift: attendance.shift || undefined };
      if (editingAttendanceId) await api.patch(`/hr/attendance/${editingAttendanceId}`, payload); else await api.post("/hr/attendance", payload);
      setDialog(false); setEditingAttendanceId(null); await load(); setNotice(editingAttendanceId ? "Attendance record updated." : "Attendance record saved.");
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  async function deleteAttendance(item: Data) {
    if (!hasPermission("attendance:delete") || !window.confirm("Delete this attendance record? This action cannot be undone.")) return;
    setSaving(true); setError("");
    try { await api.delete(`/hr/attendance/${item.id}`); await load(); setNotice("Attendance record deleted."); }
    catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }
  async function importAttendance(file: File | undefined) {
    if (!file) return;
    const selectedBranch = branchId || branches[0]?.id;
    if (!selectedBranch) { setError("Add or select a branch before importing attendance."); return; }
    setImportingAttendance(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.upload<unknown>(`/hr/attendance/import/${selectedBranch}`, form);
      await load();
      const response = result && typeof result === "object" ? result as { message?: string; data?: { message?: string } } : {};
      setNotice(response.data?.message || response.message || "Attendance spreadsheet imported.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setImportingAttendance(false); }
  }
  async function createLeave() {
    if (!leave.employeeId || !leave.leaveTypeId || !(leave.branchId || branches[0]?.id)) { setError("Employee, leave type and branch are required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/hr/leaves", { ...leave, startDate: new Date(`${leave.startDate}T00:00:00.000Z`).toISOString(), endDate: new Date(`${leave.endDate}T23:59:59.999Z`).toISOString(), reason: leave.reason || undefined });
      setDialog(false); await load(); setNotice("Leave request submitted.");
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  async function reviewLeave(next: "approved" | "rejected") {
    setSaving(true); setError("");
    try { await api.patch(`/hr/leaves/${reviewId}/approve`, { status: next, note: reviewNote || undefined }); setReviewId(""); await load(); setNotice(`Leave request ${next}.`); }
    catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  function openDialog() { setError(""); if (tab === "employees") { setEditingEmployeeId(null); setEmployee({ name: "", branchId: "", employeeType: "staff", age: "18", gender: "", phone: "", email: "", address: "", grossSalary: "0", joiningDate: new Date().toISOString().slice(0, 10), status: "active" }); } if(tab==="attendance"){setEditingAttendanceId(null);setAttendance({employeeId:"",branchId:"",date:new Date().toISOString().slice(0,10),clockIn:"",clockOut:"",shift:""});} setDialog(true); }

  const pending = tab === "leaves" ? rows.filter((row) => row.status === "pending").length : "—";
  return <section className="hr-page">
    <div className="page-heading-row"><div><p className="eyebrow">PEOPLE · SHIFT OPERATIONS</p><h1>HR &amp; attendance</h1><p className="page-subtitle">Manage your team, record daily attendance and review leave requests.</p></div><div className="inventory-heading-actions">{tab === "attendance" && hasPermission("attendance:create") && <label className="purchase-save-pending catalog-import-button"><Upload size={14}/>{importingAttendance ? "Importing…" : "Import spreadsheet"}<input type="file" accept=".xlsx,.xls" disabled={importingAttendance} onChange={event => { void importAttendance(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>}{(tab==="employees"?hasPermission("employee:create"):tab==="attendance"?hasPermission("attendance:create"):hasPermission("leave:create"))&&<button className="purchase-primary-action" onClick={openDialog}><Plus size={15}/>{tab === "employees" ? "Add employee" : tab === "attendance" ? "Record attendance" : "New leave request"}</button>}</div></div>
    {(error || notice) && <div className={`sales-alert ${error ? "error" : "success"}`}>{error ? <AlertCircle size={15}/> : <Check size={15}/>}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss"><X size={14}/></button></div>}
    <div className="hr-summary"><article className="panel"><i><UsersRound size={17}/></i><span><small>Team members in view</small><strong>{tab === "employees" && !loading ? rows.length : employeeOptions.length || "—"}</strong></span></article><article className="panel"><i className="attendance-icon"><CalendarCheck2 size={17}/></i><span><small>{tab === "attendance" ? "Attendance records" : "Activity records"}</small><strong>{tab !== "employees" && !loading ? rows.length : "—"}</strong></span></article><article className="panel"><i className="leave-icon"><Clock3 size={17}/></i><span><small>Pending leave requests</small><strong>{pending}</strong></span></article></div>
    <div className="hr-card panel"><nav className="data-tabs hr-tabs">{sections.map((section) => <button key={section.id} className={tab === section.id ? "selected" : ""} onClick={() => { setTab(section.id); setSearch(""); setStatus(""); setEmployeeTypeFilter(""); setAttendanceShift(""); setAttendanceDepartment(""); setAttendanceStartDate(""); setAttendanceEndDate(""); setFiltersOpen(false); }}>{section.label}</button>)}</nav>
      <div className="hr-toolbar"><div className="sales-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab === "employees" ? "name, phone or employee ID" : tab === "attendance" ? "employee attendance" : "leave requests"}`}/></div><select value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{tab === "leaves" && <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending", "approved", "rejected"].map((value) => <option key={value}>{value}</option>)}</select>}<button className="data-filter-button" onClick={()=>setFiltersOpen(!filtersOpen)}><Filter size={14}/> Filters</button></div>{filtersOpen&&<div className="data-filter-drawer">{tab==="employees"?<><label><span>Employment type</span><select value={employeeTypeFilter} onChange={e=>setEmployeeTypeFilter(e.target.value)}><option value="">All employee types</option>{["doctor","nurse","staff","guest-doctor"].map(type=><option key={type}>{type}</option>)}</select></label><label><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["active","inactive","on_leave","terminated"].map(value=><option key={value} value={value}>{value.replace("_"," ")}</option>)}</select></label><button onClick={()=>{setEmployeeTypeFilter("");setStatus("");}}>Clear filters</button></>:tab==="attendance"?<><label><span>Shift</span><input value={attendanceShift} onChange={e=>setAttendanceShift(e.target.value)} placeholder="Filter shift"/></label><label><span>Department</span><input value={attendanceDepartment} onChange={e=>setAttendanceDepartment(e.target.value)} placeholder="Filter department"/></label><label><span>From date</span><input type="date" value={attendanceStartDate} onChange={e=>setAttendanceStartDate(e.target.value)}/></label><label><span>Through date</span><input type="date" value={attendanceEndDate} onChange={e=>setAttendanceEndDate(e.target.value)}/></label><button onClick={()=>{setAttendanceShift("");setAttendanceDepartment("");setAttendanceStartDate("");setAttendanceEndDate("");}}>Clear filters</button></>:<span>Use status selector to filter leave requests.</span>}</div>}
      {tab === "employees" ? <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Employee</th><th>Role</th><th>Branch</th><th>Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || row.fullName || "Unnamed"}</strong><small>{row.employeeNumber || row.employeeType || "Team member"}</small></td><td>{row.designation?.name || row.employeeType || "—"}<small>{row.department?.name || ""}</small></td><td>{row.branch?.name || "—"}</td><td>{row.phone || "—"}</td><td>{dateText(row.joiningDate)}</td><td><span className={`hr-status ${row.status || "active"}`}>{(row.status || "active").replace("_", " ")}</span></td><td><div className="hr-row-actions">{hasPermission("employee:update")&&<button onClick={()=>openEmployeeEditor(row)}><Edit3 size={13}/> Edit</button>}{hasPermission("employee:delete")&&<button disabled={saving} onClick={()=>void deleteEmployee(row)}><Trash2 size={13}/> Delete</button>}</div></td></tr>)}</tbody></table></div> : tab === "attendance" ? <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Clock in</th><th>Clock out</th><th>Hours / state</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.employee?.name || row.employeeName || "—"}</strong><small>{row.employee?.employeeNumber || row.employeeNumber || ""}</small></td><td>{dateText(row.isoDate || row.date || row.createdAt)}</td><td>{row.shift || "—"}</td><td>{row.clockIn || "—"}</td><td>{row.clockOut || "—"}</td><td>{row.workTime || row.exception || "Recorded"}</td><td><div className="hr-row-actions">{hasPermission("attendance:update")&&<button onClick={()=>openAttendanceEditor(row)}><Edit3 size={13}/> Edit</button>}{hasPermission("attendance:delete")&&<button disabled={saving} onClick={()=>void deleteAttendance(row)}><Trash2 size={13}/> Delete</button>}</div></td></tr>)}</tbody></table></div> : <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Employee</th><th>Leave type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.employee?.name || row.employeeName || "—"}</strong><small>{row.employee?.employeeNumber || ""}</small></td><td>{row.leaveType?.name || "—"}</td><td>{dateText(row.startDate)} – {dateText(row.endDate)}</td><td>{row.reason || row.note || "—"}</td><td><span className={`hr-status ${row.status || "pending"}`}>{row.status || "pending"}</span></td><td>{row.status === "pending" && <button className="hr-review-trigger" onClick={() => { setReviewId(row.id); setReviewNote(""); }}>Review</button>}</td></tr>)}</tbody></table></div>}
      {!loading && rows.length === 0 && <div className="data-empty"><UsersRound size={22}/><strong>No {tab === "employees" ? "employees" : tab === "attendance" ? "attendance" : "leave requests"} found</strong><span>Add a record or adjust the filters.</span></div>}{loading && <div className="data-loading">Loading {tab}…</div>}
    </div>
    {dialog && <div className="sales-backdrop" role="presentation" onClick={() => setDialog(false)}><div className="supplier-dialog panel hr-dialog" role="dialog" aria-modal="true" aria-label="Create HR record" onClick={(e) => e.stopPropagation()}><button className="purchase-close" onClick={() => setDialog(false)} aria-label="Close"><X size={18}/></button><h2>{tab === "employees" ? editingEmployeeId ? "Edit employee" : "Add employee" : tab === "attendance" ? editingAttendanceId ? "Edit attendance" : "Record attendance" : "New leave request"}</h2><p>{tab === "employees" ? "Create a staff profile for your pharmacy." : tab === "attendance" ? "Record the employee’s attendance for a workday." : "Submit a leave request for review."}</p>
      {tab === "employees" ? <><label>Full name<input value={employee.name} onChange={(e) => setEmployee({ ...employee, name: e.target.value })}/></label><div className="customer-form-grid"><label>Employee type<select value={employee.employeeType} onChange={(e) => setEmployee({ ...employee, employeeType: e.target.value })}>{["staff", "doctor", "nurse", "guest-doctor"].map((type) => <option key={type}>{type}</option>)}</select></label><label>Age<input type="number" min="18" value={employee.age} onChange={(e) => setEmployee({ ...employee, age: e.target.value })}/></label></div><div className="customer-form-grid"><label>Gender<input value={employee.gender} onChange={(e) => setEmployee({ ...employee, gender: e.target.value })}/></label><label>Phone<input value={employee.phone} onChange={(e) => setEmployee({ ...employee, phone: e.target.value })}/></label></div><label>Email<input type="email" value={employee.email} onChange={(e) => setEmployee({ ...employee, email: e.target.value })}/></label><label>Branch<select value={employee.branchId || branches[0]?.id || ""} onChange={(e) => setEmployee({ ...employee, branchId: e.target.value })}><option value="">Choose branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Address<input value={employee.address} onChange={(e) => setEmployee({ ...employee, address: e.target.value })}/></label><div className="customer-form-grid"><label>Gross salary<input type="number" min="0" value={employee.grossSalary} onChange={(e) => setEmployee({ ...employee, grossSalary: e.target.value })}/></label><label>Joining date<input type="date" value={employee.joiningDate} onChange={(e) => setEmployee({ ...employee, joiningDate: e.target.value })}/></label></div>{editingEmployeeId&&<label>Employment status<select value={employee.status} onChange={e=>setEmployee({...employee,status:e.target.value})}>{["active","inactive","on_leave","terminated"].map(value=><option key={value} value={value}>{value.replace("_"," ")}</option>)}</select></label>}<button className="purchase-primary-action full" disabled={saving} onClick={() => void saveEmployee()}>{saving ? "Saving…" : editingEmployeeId ? "Save changes" : "Save employee"}</button></> : tab === "attendance" ? <><label>Employee<select value={attendance.employeeId} onChange={(e) => setAttendance({ ...attendance, employeeId: e.target.value })}><option value="">Choose employee</option>{employeeOptions.map((item) => <option key={item.id} value={item.id}>{item.name || item.fullName} · {item.employeeNumber || item.employeeType}</option>)}</select></label><label>Branch<select value={attendance.branchId || branches[0]?.id || ""} onChange={(e) => setAttendance({ ...attendance, branchId: e.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><div className="customer-form-grid"><label>Date<input type="date" value={attendance.date} onChange={(e) => setAttendance({ ...attendance, date: e.target.value })}/></label><label>Shift<input value={attendance.shift} onChange={(e) => setAttendance({ ...attendance, shift: e.target.value })} placeholder="Morning"/></label></div><div className="customer-form-grid"><label>Clock in<input type="time" value={attendance.clockIn} onChange={(e) => setAttendance({ ...attendance, clockIn: e.target.value })}/></label><label>Clock out<input type="time" value={attendance.clockOut} onChange={(e) => setAttendance({ ...attendance, clockOut: e.target.value })}/></label></div><button className="purchase-primary-action full" disabled={saving || !employeeOptions.length} onClick={() => void saveAttendance()}>{saving ? "Saving…" : editingAttendanceId ? "Save changes" : "Save attendance"}</button></> : <><label>Employee<select value={leave.employeeId} onChange={(e) => setLeave({ ...leave, employeeId: e.target.value })}><option value="">Choose employee</option>{employeeOptions.map((item) => <option key={item.id} value={item.id}>{item.name || item.fullName}</option>)}</select></label><label>Leave type<select value={leave.leaveTypeId} onChange={(e) => setLeave({ ...leave, leaveTypeId: e.target.value })}><option value="">Choose leave type</option>{leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Branch<select value={leave.branchId || branches[0]?.id || ""} onChange={(e) => setLeave({ ...leave, branchId: e.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><div className="customer-form-grid"><label>From<input type="date" value={leave.startDate} onChange={(e) => setLeave({ ...leave, startDate: e.target.value })}/></label><label>Through<input type="date" min={leave.startDate} value={leave.endDate} onChange={(e) => setLeave({ ...leave, endDate: e.target.value })}/></label></div><label>Reason<input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })}/></label><button className="purchase-primary-action full" disabled={saving || !leaveTypes.length} onClick={() => void createLeave()}>{saving ? "Submitting…" : "Submit request"}</button></>}</div></div>}
    {reviewId && <div className="sales-backdrop hr-review-layer" role="presentation" onClick={() => setReviewId("")}><div className="supplier-dialog panel hr-dialog" role="dialog" aria-modal="true" aria-label="Review leave request" onClick={(e) => e.stopPropagation()}><button className="purchase-close" onClick={() => setReviewId("")} aria-label="Close"><X size={18}/></button><h2>Review leave request</h2><p>Approve or decline this employee’s leave application.</p><label>Review note<input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}/></label><div className="hr-review-actions"><button disabled={saving} onClick={() => void reviewLeave("rejected")}>Decline</button><button disabled={saving} onClick={() => void reviewLeave("approved")}>Approve request</button></div></div></div>}
  </section>;
}


