'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet, TrendingUp, Users, CalendarClock,
  Loader2, Download, Eye, Check,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/session';
import { useStore } from '@/lib/store';
import { useUsers, type UserSummary } from '@/lib/hooks';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { type DatePreset, makeDateRange, type DateRange } from '../../components/ui/DateRangePicker';
import './Reports.css';

// ─── period helpers ───────────────────────────────────────

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

// ─── types ────────────────────────────────────────────────

type ReportType = 'attendance-summary' | 'employee-summary' | 'performance-leave-summary';

type TablePreview = { columns: string[]; rows: (string | number)[][] };

type PerfLeaveKvSection = { heading: string; pairs: [string, string | number][] };
type PerfLeaveTab =
  | { kind: 'kv'; title: string; sections: PerfLeaveKvSection[] }
  | { kind: 'table'; title: string; columns: string[]; rows: (string | number)[][] };
type PerfLeavePreview = { tabs: PerfLeaveTab[] };

type PreviewData =
  | { kind: 'table'; data: TablePreview }
  | { kind: 'perf-leave'; data: PerfLeavePreview };

// ─── report type metadata ─────────────────────────────────

interface ReportTypeMeta {
  key: ReportType;
  label: string;
  Icon: React.FC<{ size?: number }>;
  iconStyle: React.CSSProperties;
  description: string;
  details: string;
  hasPeriod: boolean;
  hasMultiEmp: boolean;
  hasSingleEmp: boolean;
  hasPdf: boolean;
  managerOnly: boolean;
}

const REPORT_TYPES: ReportTypeMeta[] = [
  {
    key: 'attendance-summary',
    label: 'Attendance Summary',
    Icon: CalendarClock,
    iconStyle: { background: 'var(--color-info-light)', color: 'var(--color-brand-primary)' },
    description: 'Monitor attendance, work hours, overtime, and daily work locations.',
    details: 'Monitor attendance, work hours, overtime, and daily work locations.',
    hasPeriod: true,
    hasMultiEmp: true,
    hasSingleEmp: false,
    hasPdf: true,
    managerOnly: false,
  },
  {
    key: 'employee-summary',
    label: 'Employee Summary',
    Icon: Users,
    iconStyle: { background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' },
    description: 'Access and review comprehensive employee information in one place.',
    details: 'Access and review comprehensive employee information in one place.',
    hasPeriod: false,
    hasMultiEmp: false,
    hasSingleEmp: false,
    hasPdf: true,
    managerOnly: true,
  },
  {
    key: 'performance-leave-summary',
    label: 'Performance & Leave Summary',
    Icon: TrendingUp,
    iconStyle: { background: 'var(--color-leave-replacement-light)', color: 'var(--color-leave-replacement)' },
    description: 'Track individual performance, working days, overtime, and leave history.',
    details: 'Track individual performance, working days, overtime, and leave history.',
    hasPeriod: true,
    hasMultiEmp: false,
    hasSingleEmp: true,
    hasPdf: true,
    managerOnly: false,
  },
];

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
      <span className="rpts-period-custom-sep">–</span>
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  const selectedUsers = activeUsers.filter((u) => selectedIds.includes(u.id));

  return (
    <div className="rpts-multi-picker" ref={ref}>
      <div
        className={`rpts-multi-tags${showDrop ? ' rpts-multi-tags--open' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => { setShowDrop(true); setTimeout(() => searchRef.current?.focus(), 10); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDrop(true); }}
      >
        {selectedUsers.length === 0 ? (
          <span className="rpts-multi-placeholder">All employees</span>
        ) : (
          selectedUsers.map((u) => (
            <span key={u.id} className="rpts-multi-tag">
              <span className="rpts-multi-tag-name">{u.fullName}</span>
              <button
                type="button"
                className="rpts-multi-tag-remove"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onChange(selectedIds.filter((x) => x !== u.id)); }}
                title={`Remove ${u.fullName}`}
              >×</button>
            </span>
          ))
        )}
      </div>
      {selectedUsers.length > 0 && (
        <button
          type="button"
          className="rpts-multi-outer-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange([])}
        >
          Clear
        </button>
      )}
      {showDrop && (
        <div className="rpts-multi-dropdown">
          <input
            ref={searchRef}
            type="text"
            className="rpts-multi-search"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rpts-multi-controls">
            <button
              type="button"
              className="rpts-multi-ctrl-btn"
              onMouseDown={(e) => { e.preventDefault(); onChange(activeUsers.map((u) => u.id)); }}
            >
              Select all
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

function PerfLeavePreviewContent({ data }: { data: PerfLeavePreview }) {
  const [activeTab, setActiveTab] = useState(0);
  useEffect(() => { setActiveTab(0); }, [data]);

  const tab = data.tabs[activeTab];
  return (
    <div>
      <div className="rpts-preview-tabs">
        {data.tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            className={`rpts-preview-tab-btn${activeTab === i ? ' rpts-preview-tab-btn-active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {t.title}
          </button>
        ))}
      </div>
      {tab && tab.kind === 'table' && (
        <TablePreviewContent data={{ columns: tab.columns, rows: tab.rows }} />
      )}
      {tab && tab.kind === 'kv' && (
        <div className="rpts-preview-kv-sections">
          {tab.sections.map((section, si) => (
            <table key={si} className="rpts-preview-kv-table">
              <thead>
                <tr>
                  <th className="rpts-preview-kv-section" colSpan={2}>{section.heading}</th>
                </tr>
              </thead>
              <tbody>
                {section.pairs.map(([k, v], pi) => (
                  <tr key={pi}>
                    <td className="rpts-preview-kv-label">{k}</td>
                    <td className="rpts-preview-kv-value">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────

export function ReportsPage() {
  const user = useCurrentUser();
  const addToast = useStore((s) => s.addToast);

  const [selectedType, setSelectedType] = useState<ReportType | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>(() => makeDateRange('this-month'));
  const [customStart, setCustomStart] = useState(() => toIso(new Date()));
  const [customEnd, setCustomEnd] = useState(() => toIso(new Date()));

  const [busy, setBusy] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewExportKey, setPreviewExportKey] = useState<string | null>(null);

  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [perfEmp, setPerfEmp] = useState<UserSummary | null>(null);

  const { data: allUsers = [] } = useUsers();

  if (!user) return null;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  const isManager = isAdmin || roles.includes('LINE_MANAGER');

  const year = dateRange.start.getFullYear();
  const month = dateRange.start.getMonth() + 1;

  const visibleTypes = REPORT_TYPES.filter((rt) => !rt.managerOnly || isManager);
  const activeRt = selectedType ? visibleTypes.find((r) => r.key === selectedType) ?? null : null;

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

  function getParams(type: ReportType): URLSearchParams {
    const p = new URLSearchParams();
    p.set('startDate', toIso(dateRange.start));
    p.set('endDate', toIso(dateRange.end));
    if (type === 'attendance-summary' && selectedEmpIds.length > 0) {
      p.set('employeeIds', selectedEmpIds.join(','));
    }
    if (type === 'performance-leave-summary' && perfEmp) {
      p.set('employeeId', perfEmp.id);
    }
    return p;
  }

  async function doDownload(type: string, extraParams: URLSearchParams, filename?: string) {
    setBusy(type);
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
        setPreviewData({ kind: 'perf-leave', data: json as PerfLeavePreview });
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

  async function exportFromPreview() {
    if (!previewExportKey) return;
    const [type, ...rest] = previewExportKey.split(':');
    const extraRaw = rest.join(':');
    const extraParams = new URLSearchParams(extraRaw);
    setPreviewOpen(false);
    await doDownload(type, extraParams);
  }

  async function downloadPdf(type: ReportType) {
    const key = `${type}:pdf`;
    setBusy(key);
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month), format: 'pdf' });
      if (type === 'performance-leave-summary' && perfEmp) q.set('employeeId', perfEmp.id);
      const res = await fetch(`/api/reports/${type}?${q.toString()}`);
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const j = (await res.json()) as { message?: string }; if (j.message) msg = j.message; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = cd.match(/filename="([^"]+)"/)?.[1] ?? `${type}.pdf`;
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
          View and review employee-related records in one place, including attendance, working hours, overtime, performance, and leave information. These reports help HR monitor employee activities and access relevant details efficiently.
        </p>
      </div>

      {/* ── Type selector ─────────────────────────────────────── */}
      <div className="rpts-type-selector">
        {visibleTypes.map((rt) => (
          <button
            key={rt.key}
            type="button"
            className={`rpts-type-option${selectedType === rt.key ? ' rpts-type-option-active' : ''}`}
            onClick={() => setSelectedType(selectedType === rt.key ? null : rt.key)}
          >
            <div className="rpts-type-option-icon" style={rt.iconStyle}>
              <rt.Icon size={22} />
            </div>
            <div className="rpts-type-option-text">
              <span className="rpts-type-option-label">{rt.label}</span>
              <span className="rpts-type-option-desc">{rt.description}</span>
            </div>
            {selectedType === rt.key && (
              <span className="rpts-type-option-check">
                <Check size={11} />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Selected type panel ───────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeRt && (
          <motion.div
            key={activeRt.key}
            className="rpts-selected-panel card"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeRt.hasPeriod && (
              <div className="rpts-filter-row">
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
            )}

            {activeRt.hasMultiEmp && isManager && (
              <div className="rpts-filter-row">
                <div className="rpts-period-label">
                  <Users size={14} />
                  <span>Employees</span>
                </div>
                <MultiEmpPicker
                  selectedIds={selectedEmpIds}
                  allUsers={allUsers}
                  onChange={setSelectedEmpIds}
                />
              </div>
            )}

            {activeRt.hasSingleEmp && isManager && (
              <div className="rpts-filter-row">
                <div className="rpts-period-label">
                  <Users size={14} />
                  <span>Employee</span>
                </div>
                <SingleEmpPicker
                  selectedEmp={perfEmp}
                  allUsers={allUsers}
                  onSelect={setPerfEmp}
                />
              </div>
            )}

            <div className="rpts-selected-details">{activeRt.details}</div>

            <div className="rpts-card-actions">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={
                  previewBusy
                    ? <Loader2 size={13} className="rpts-spin" />
                    : <Eye size={13} />
                }
                disabled={busy !== null}
                onClick={() => {
                  const params = getParams(activeRt.key);
                  openPreview(
                    activeRt.key,
                    activeRt.label,
                    params,
                    `${activeRt.key}:${params.toString()}`,
                  );
                }}
              >
                Preview
              </Button>
              <Button
                variant="primary"
                leadingIcon={
                  busy === activeRt.key
                    ? <Loader2 size={14} className="rpts-spin" />
                    : <FileSpreadsheet size={14} />
                }
                disabled={busy !== null}
                onClick={() => doDownload(activeRt.key, getParams(activeRt.key))}
              >
                {busy === activeRt.key ? 'Building…' : 'Export Excel'}
              </Button>
              {activeRt.hasPdf && (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={
                    busy === `${activeRt.key}:pdf`
                      ? <Loader2 size={13} className="rpts-spin" />
                      : <Download size={13} />
                  }
                  disabled={busy !== null}
                  onClick={() => downloadPdf(activeRt.key)}
                >
                  {busy === `${activeRt.key}:pdf` ? 'Rendering…' : 'PDF'}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Preview modal ─────────────────────────────────────── */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        size="full"
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
            {(() => {
              const pt = previewExportKey?.split(':')[0] as ReportType | undefined;
              if (!pt || !REPORT_TYPES.find((r) => r.key === pt)?.hasPdf) return null;
              return (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={busy === `${pt}:pdf` ? <Loader2 size={13} className="rpts-spin" /> : <Download size={14} />}
                  onClick={() => { setPreviewOpen(false); downloadPdf(pt); }}
                  disabled={!previewData}
                >
                  PDF
                </Button>
              );
            })()}
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
            : <PerfLeavePreviewContent key={previewExportKey ?? undefined} data={previewData.data} />
        )}
      </Modal>

    </div>
  );
}
