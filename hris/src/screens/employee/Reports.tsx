'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileSpreadsheet, TrendingUp, Users, CalendarClock,
  Loader2, Download, Eye,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/session';
import { useStore } from '@/lib/store';
import { useUsers, type UserSummary } from '@/lib/hooks';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { type DatePreset, makeDateRange, type DateRange } from '../../components/ui/DateRangePicker';
import './Reports.css';

// ─── period helpers ───────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today',         label: 'Today' },
  { key: 'yesterday',     label: 'Yesterday' },
  { key: 'this-week',     label: 'This week' },
  { key: 'last-week',     label: 'Last week' },
  { key: 'this-month',    label: 'This month' },
  { key: 'last-month',    label: 'Last month' },
  { key: 'last-3-months', label: 'Last 3 months' },
  { key: 'last-6-months', label: 'Last 6 months' },
  { key: 'this-year',     label: 'This year' },
  { key: 'last-year',     label: 'Last year' },
  { key: 'custom',        label: 'Custom' },
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── preview types ────────────────────────────────────────

type TablePreview = { columns: string[]; rows: (string | number)[][] };

type PerformancePreview = {
  performance: Record<string, number>;
  balance: Record<string, number>;
  counts: { approved: number; pending: number; rejected: number };
  leaveColumns: string[];
  leaveRows: (string | number)[][];
};

type PreviewData =
  | { kind: 'table'; data: TablePreview }
  | { kind: 'performance'; data: PerformancePreview };

// ─── period picker component ──────────────────────────────

interface PeriodPickerProps {
  dateRange: DateRange;
  customStart: string;
  customEnd: string;
  onPresetChange: (key: DatePreset) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onApply: () => void;
}

function PeriodPicker({
  dateRange, customStart, customEnd,
  onPresetChange, onCustomStartChange, onCustomEndChange, onApply,
}: PeriodPickerProps) {
  return (
    <div className="rpts-period-controls">
      <select
        className="rpts-period-select"
        value={dateRange.preset}
        onChange={(e) => onPresetChange(e.target.value as DatePreset)}
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>
      <span className="rpts-period-custom-label">From</span>
      <input
        type="date"
        className={`rpts-period-date-input${dateRange.preset !== 'custom' ? ' rpts-period-date-input--disabled' : ''}`}
        value={customStart}
        max={customEnd || undefined}
        disabled={dateRange.preset !== 'custom'}
        onChange={(e) => onCustomStartChange(e.target.value)}
      />
      <span className="rpts-period-custom-sep">-</span>
      <span className="rpts-period-custom-label">To</span>
      <input
        type="date"
        className={`rpts-period-date-input${dateRange.preset !== 'custom' ? ' rpts-period-date-input--disabled' : ''}`}
        value={customEnd}
        min={customStart || undefined}
        disabled={dateRange.preset !== 'custom'}
        onChange={(e) => onCustomEndChange(e.target.value)}
      />
      <Button
        size="sm"
        variant="primary"
        disabled={dateRange.preset !== 'custom' || !customStart || !customEnd || customStart > customEnd}
        onClick={onApply}
      >
        Apply
      </Button>
    </div>
  );
}

// ─── single-employee picker ───────────────────────────────

interface SingleEmpPickerProps {
  selectedEmp: UserSummary | null;
  allUsers: UserSummary[];
  onSelect: (u: UserSummary | null) => void;
}

function SingleEmpPicker({ selectedEmp, allUsers, onSelect }: SingleEmpPickerProps) {
  const [empSearch, setEmpSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDrop) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDrop(false);
        setEmpSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDrop]);

  const filtered = allUsers
    .filter((u) => u.isActive)
    .filter((u) => !empSearch
      || u.fullName.toLowerCase().includes(empSearch.toLowerCase())
      || (u.department ?? '').toLowerCase().includes(empSearch.toLowerCase()))
    .slice(0, 20);

  return (
    <div className="rpts-emp-picker" ref={ref}>
      <input
        className="rpts-emp-input"
        placeholder="Select employee"
        value={showDrop ? empSearch : (selectedEmp?.fullName ?? '')}
        onFocus={() => { setEmpSearch(''); setShowDrop(true); }}
        onChange={(e) => setEmpSearch(e.target.value)}
      />
      {selectedEmp && !showDrop && (
        <button
          type="button"
          className="rpts-emp-clear"
          onClick={() => { onSelect(null); setEmpSearch(''); }}
          title="Clear"
        >
          ×
        </button>
      )}
      {showDrop && (
        <div className="rpts-emp-dropdown">
          {filtered.length === 0 ? (
            <div className="rpts-emp-empty">No employees found</div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`rpts-emp-option${selectedEmp?.id === u.id ? ' rpts-emp-option-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(u);
                  setShowDrop(false);
                  setEmpSearch('');
                }}
              >
                <span>{u.fullName}</span>
                {u.department && <span className="rpts-emp-dept">{u.department}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── multi-employee picker ────────────────────────────────

interface MultiEmpPickerProps {
  selectedIds: string[];
  allUsers: UserSummary[];
  onChange: (ids: string[]) => void;
}

function MultiEmpPicker({ selectedIds, allUsers, onChange }: MultiEmpPickerProps) {
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDrop) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDrop(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDrop]);

  const activeUsers = allUsers.filter((u) => u.isActive);
  const filtered = activeUsers.filter((u) =>
    !search
    || u.fullName.toLowerCase().includes(search.toLowerCase())
    || (u.department ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const displayText = selectedIds.length === 0 ? 'All employees' : '';

  return (
    <div className="rpts-multi-picker" ref={ref}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          readOnly
          className="rpts-multi-input"
          value={displayText}
          placeholder="All employees"
          onClick={() => setShowDrop((v) => !v)}
        />
        {selectedIds.length > 0 && (
          <span className="rpts-multi-selected">{selectedIds.length} selected</span>
        )}
      </div>
      {showDrop && (
        <div className="rpts-multi-dropdown">
          <input
            type="text"
            className="rpts-multi-search"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="rpts-multi-controls">
            <button
              type="button"
              className="rpts-multi-ctrl-btn"
              onMouseDown={(e) => { e.preventDefault(); onChange(activeUsers.map((u) => u.id)); }}
            >
              Select all
            </button>
            <button
              type="button"
              className="rpts-multi-ctrl-btn"
              onMouseDown={(e) => { e.preventDefault(); onChange([]); }}
            >
              Clear all
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="rpts-emp-empty">No employees found</div>
          ) : (
            filtered.map((u) => (
              <label
                key={u.id}
                className="rpts-multi-option"
                onMouseDown={(e) => e.preventDefault()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggle(u.id)}
                />
                <span className="rpts-multi-option-info">
                  <span className="rpts-multi-option-name">{u.fullName}</span>
                  {u.department && (
                    <span className="rpts-multi-option-dept">{u.department}</span>
                  )}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── preview modal content ────────────────────────────────

function TablePreviewContent({ data }: { data: TablePreview }) {
  return (
    <div className="rpts-preview-table">
      <table>
        <thead>
          <tr>
            {data.columns.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerformancePreviewContent({ data }: { data: PerformancePreview }) {
  const perfItems = Object.entries(data.performance);
  const balItems = Object.entries(data.balance);
  const countItems = Object.entries(data.counts);

  return (
    <div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Performance
      </p>
      <dl className="rpts-preview-kv">
        {perfItems.map(([k, v]) => (
          <div key={k} className="rpts-preview-kv-item">
            <dt>{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, marginTop: 16 }}>
        Leave balance
      </p>
      <dl className="rpts-preview-kv">
        {balItems.map(([k, v]) => (
          <div key={k} className="rpts-preview-kv-item">
            <dt>{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, marginTop: 16 }}>
        Requests this cycle
      </p>
      <dl className="rpts-preview-kv" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {countItems.map(([k, v]) => (
          <div key={k} className="rpts-preview-kv-item">
            <dt>{k.charAt(0).toUpperCase() + k.slice(1)}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
      {data.leaveRows.length > 0 && (
        <>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, marginTop: 16 }}>
            Recent leave requests
          </p>
          <div className="rpts-preview-table">
            <table>
              <thead>
                <tr>{data.leaveColumns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {data.leaveRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <td key={j}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────

export function ReportsPage() {
  const user = useCurrentUser();
  const addToast = useStore((s) => s.addToast);

  // Shared period state
  const [dateRange, setDateRange] = useState<DateRange>(() => makeDateRange('this-month'));
  const [customStart, setCustomStart] = useState(() => toIso(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toIso(new Date()));

  // Per-operation busy/done
  const [busy, setBusy] = useState<string | null>(null);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewExportKey, setPreviewExportKey] = useState<string | null>(null);

  // Employee pickers
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [perfEmp, setPerfEmp] = useState<UserSummary | null>(null);

  const { data: allUsers = [] } = useUsers();

  if (!user) return null;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  const isManager = isAdmin || roles.includes('LINE_MANAGER');

  const year = dateRange.start.getFullYear();
  const month = dateRange.start.getMonth() + 1;

  function selectPreset(key: DatePreset) {
    if (key === 'custom') {
      setCustomStart(toIso(dateRange.start));
      setCustomEnd(toIso(dateRange.end));
      setDateRange((dr) => ({ ...dr, preset: 'custom' }));
    } else {
      setDateRange(makeDateRange(key));
    }
  }

  function applyCustom() {
    if (!customStart || !customEnd || customStart > customEnd) return;
    const s = new Date(customStart + 'T00:00:00');
    const e = new Date(customEnd + 'T23:59:59');
    setDateRange({ start: s, end: e, preset: 'custom' });
  }

  function periodLabel() {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  async function doDownload(type: string, extraParams: URLSearchParams, filename?: string) {
    const key = type;
    setBusy(key);
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month), format: 'xlsx' });
      extraParams.forEach((v, k) => q.set(k, v));
      const res = await fetch(`/api/reports/${type}?${q.toString()}`);
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? filename ?? `${type}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ kind: 'success', title: 'Download ready', body: name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast({ kind: 'error', title: 'Could not generate report', body: msg });
    } finally {
      setBusy(null);
    }
  }

  async function openPreview(
    type: string,
    title: string,
    extraParams: URLSearchParams,
    exportKey: string,
  ) {
    setPreviewTitle(title);
    setPreviewBusy(true);
    setPreviewOpen(true);
    setPreviewData(null);
    setPreviewExportKey(exportKey);
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month), format: 'preview' });
      extraParams.forEach((v, k) => q.set(k, v));
      const res = await fetch(`/api/reports/${type}?${q.toString()}`);
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const j = (await res.json()) as { message?: string }; if (j.message) msg = j.message; } catch {}
        throw new Error(msg);
      }
      const json = await res.json() as unknown;
      if (type === 'performance-leave-summary') {
        setPreviewData({ kind: 'performance', data: json as PerformancePreview });
      } else {
        setPreviewData({ kind: 'table', data: json as TablePreview });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast({ kind: 'error', title: 'Could not load preview', body: msg });
      setPreviewOpen(false);
    } finally {
      setPreviewBusy(false);
    }
  }

  // ── Attendance Summary handlers ───────────────────────────

  function attendanceParams() {
    const p = new URLSearchParams();
    if (selectedEmpIds.length > 0) p.set('employeeIds', selectedEmpIds.join(','));
    return p;
  }

  // ── Employee Summary handlers ─────────────────────────────
  // (no extra params needed)

  // ── Performance & Leave handlers ──────────────────────────

  function perfLeaveParams() {
    const p = new URLSearchParams();
    if (perfEmp) p.set('employeeId', perfEmp.id);
    return p;
  }

  // ── Shared export-from-preview button ─────────────────────
  async function exportFromPreview() {
    if (!previewExportKey) return;
    const [type, ...rest] = previewExportKey.split(':');
    const extraRaw = rest.join(':');
    const extraParams = new URLSearchParams(extraRaw);
    setPreviewOpen(false);
    await doDownload(type, extraParams);
  }

  // ── PDF for performance-leave-summary ─────────────────────
  async function downloadPdf() {
    if (!perfEmp && !isManager) return;
    const key = 'performance-leave-summary:pdf';
    setBusy(key);
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month), format: 'pdf' });
      if (perfEmp) q.set('employeeId', perfEmp.id);
      const res = await fetch(`/api/reports/performance-leave-summary?${q.toString()}`);
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const j = (await res.json()) as { message?: string }; if (j.message) msg = j.message; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? 'performance-leave-summary.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ kind: 'success', title: 'Download ready', body: name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast({ kind: 'error', title: 'Could not generate PDF', body: msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rpts">
      <div className="rpts-head">
        <h1>Reports</h1>
        <p className="muted">
          Formatted Excel workbooks — filter, pivot and paste straight into payroll or audit
          sheets. Pick a period, then export.
        </p>
      </div>

      {/* ── Shared period picker ──────────────────────────────── */}
      <div className="rpts-period card">
        <div className="rpts-period-label">
          <CalendarClock size={15} />
          <span>Period</span>
        </div>
        <PeriodPicker
          dateRange={dateRange}
          customStart={customStart}
          customEnd={customEnd}
          onPresetChange={selectPreset}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          onApply={applyCustom}
        />
      </div>

      <div className="rpts-cards">

        {/* ── Card 1: Attendance Summary ──────────────────────── */}
        <motion.div
          className="rpts-card card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="rpts-card-header">
            <div className="rpts-icon" style={{ background: 'var(--color-info-light)', color: 'var(--color-brand-primary)' }}>
              <CalendarClock size={20} />
            </div>
            <div className="rpts-card-title-block">
              <h4>Attendance Summary</h4>
              <p>Daily clock-in/out, hours worked, deficit, overtime, and location for the selected employees and period.</p>
            </div>
          </div>
          <div className="rpts-card-body">
            {isManager && (
              <>
                <div className="rpts-period-label">
                  <Users size={14} />
                  <span>Employees</span>
                </div>
                <MultiEmpPicker
                  selectedIds={selectedEmpIds}
                  allUsers={allUsers}
                  onChange={setSelectedEmpIds}
                />
              </>
            )}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {periodLabel()}
            </span>
          </div>
          <div className="rpts-card-actions">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={previewBusy && previewTitle === 'Attendance Summary' ? <Loader2 size={13} className="rpts-spin" /> : <Eye size={13} />}
              onClick={() => openPreview(
                'attendance-summary',
                'Attendance Summary',
                attendanceParams(),
                `attendance-summary:${attendanceParams().toString()}`,
              )}
              disabled={busy !== null}
            >
              Preview
            </Button>
            <Button
              variant="primary"
              leadingIcon={busy === 'attendance-summary' ? <Loader2 size={14} className="rpts-spin" /> : <FileSpreadsheet size={14} />}
              onClick={() => doDownload('attendance-summary', attendanceParams())}
              disabled={busy !== null}
            >
              {busy === 'attendance-summary' ? 'Building…' : 'Export Excel'}
            </Button>
          </div>
        </motion.div>

        {/* ── Card 2: Employee Summary ────────────────────────── */}
        {isManager && (
          <motion.div
            className="rpts-card card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="rpts-card-header">
              <div className="rpts-icon" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                <Users size={20} />
              </div>
              <div className="rpts-card-title-block">
                <h4>Employee Summary</h4>
                <p>Company directory — Employee IDs, contact info, department, designation, line manager, joining and departure dates.</p>
              </div>
            </div>
            <div className="rpts-card-body">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                All employees (active + deactivated)
              </span>
            </div>
            <div className="rpts-card-actions">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={previewBusy && previewTitle === 'Employee Summary' ? <Loader2 size={13} className="rpts-spin" /> : <Eye size={13} />}
                onClick={() => openPreview(
                  'employee-summary',
                  'Employee Summary',
                  new URLSearchParams(),
                  'employee-summary:',
                )}
                disabled={busy !== null}
              >
                Preview
              </Button>
              <Button
                variant="primary"
                leadingIcon={busy === 'employee-summary' ? <Loader2 size={14} className="rpts-spin" /> : <FileSpreadsheet size={14} />}
                onClick={() => doDownload('employee-summary', new URLSearchParams())}
                disabled={busy !== null}
              >
                {busy === 'employee-summary' ? 'Building…' : 'Export Excel'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Card 3: Performance & Leave Summary ─────────────── */}
        <motion.div
          className="rpts-card card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="rpts-card-header">
            <div className="rpts-icon" style={{ background: 'var(--color-leave-replacement-light)', color: 'var(--color-leave-replacement)' }}>
              <TrendingUp size={20} />
            </div>
            <div className="rpts-card-title-block">
              <h4>Performance &amp; Leave Summary</h4>
              <p>Performance metrics and complete leave history with balance breakdown for a single employee.</p>
            </div>
          </div>
          <div className="rpts-card-body">
            {isManager && (
              <>
                <div className="rpts-period-label">
                  <Users size={14} />
                  <span>Employee</span>
                </div>
                <SingleEmpPicker
                  selectedEmp={perfEmp}
                  allUsers={allUsers}
                  onSelect={setPerfEmp}
                />
              </>
            )}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {periodLabel()}
            </span>
          </div>
          <div className="rpts-card-actions">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={previewBusy && previewTitle === 'Performance & Leave Summary' ? <Loader2 size={13} className="rpts-spin" /> : <Eye size={13} />}
              onClick={() => openPreview(
                'performance-leave-summary',
                'Performance & Leave Summary',
                perfLeaveParams(),
                `performance-leave-summary:${perfLeaveParams().toString()}`,
              )}
              disabled={busy !== null}
            >
              Preview
            </Button>
            <Button
              variant="primary"
              leadingIcon={busy === 'performance-leave-summary' ? <Loader2 size={14} className="rpts-spin" /> : <FileSpreadsheet size={14} />}
              onClick={() => doDownload('performance-leave-summary', perfLeaveParams())}
              disabled={busy !== null}
            >
              {busy === 'performance-leave-summary' ? 'Building…' : 'Export Excel'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={busy === 'performance-leave-summary:pdf' ? <Loader2 size={13} className="rpts-spin" /> : <Download size={13} />}
              onClick={downloadPdf}
              disabled={busy !== null}
            >
              {busy === 'performance-leave-summary:pdf' ? 'Rendering…' : 'PDF'}
            </Button>
          </div>
        </motion.div>

      </div>

      {/* ── Preview modal ─────────────────────────────────────── */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        size="xl"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<FileSpreadsheet size={14} />}
              onClick={exportFromPreview}
              disabled={!previewData}
            >
              Export Excel
            </Button>
            {previewTitle === 'Performance & Leave Summary' && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Download size={14} />}
                onClick={() => { setPreviewOpen(false); downloadPdf(); }}
                disabled={!previewData}
              >
                PDF
              </Button>
            )}
          </div>
        }
      >
        {previewBusy && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: 'var(--color-text-muted)' }}>
            <Loader2 size={18} className="rpts-spin" />
            <span>Loading preview…</span>
          </div>
        )}
        {!previewBusy && previewData && (
          previewData.kind === 'table'
            ? <TablePreviewContent data={previewData.data} />
            : <PerformancePreviewContent data={previewData.data} />
        )}
      </Modal>

      <div className="rpts-note card">
        <strong>About these exports</strong>
        <p>
          Workbooks open on a Summary sheet carrying the period and headline figures, then the raw rows. Header rows are frozen and filterable; hours, days and rates are real numbers rather than text, so they sort and total correctly, and each sheet ends with a live <span className="mono">SUM()</span> row. Times are shown in Dhaka time. Everything is generated fresh on request, and you only ever receive rows you already have permission to see in the app.
        </p>
      </div>
    </div>
  );
}
