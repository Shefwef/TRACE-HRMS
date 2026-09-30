'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Search, Plus, Pencil, Trash2, ClipboardList,
  Download, Check, AlertTriangle, Save, X,
} from 'lucide-react';
import { 
  useDailyScrumDay, useDailyScrumDates, useUpsertScrumEntry,
  useAddScrumTask, useUpdateScrumTask, useDeleteScrumTask,
  useGenerateScrumDay, useUsers,
  type DailyScrumEntryShape, type DailyTaskShape, type UserSummary,
  type TaskPriority,
} from '@/lib/hooks';
import { useCurrentUser, initials, avatarColorFor } from '@/lib/session';
import { useStore } from '@/lib/store';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { TextInput, TextArea } from '../../components/ui/Field';
import { cx, fmtDate, todayISO } from '../../lib/utils';
import './DailyScrum.css';

/**
 * Sort comparator that orders items by their employee's `employeeIdCode`
 * (nulls last), falling back to `fullName`.
 */
function byEmployeeId<T>(pick: (t: T) => { employeeIdCode?: string | null; fullName: string }) {
  return (a: T, b: T) => {
    const ea = pick(a);
    const eb = pick(b);
    const ida = ea.employeeIdCode ?? '';
    const idb = eb.employeeIdCode ?? '';
    if (ida && idb) return ida.localeCompare(idb);
    if (ida) return -1;
    if (idb) return 1;
    return ea.fullName.localeCompare(eb.fullName);
  };
}

// ─── Task modal (add / edit) ─────────────────────────────

interface TaskFormValue {
  text: string;
  deadline: string;
  isDecision: boolean;
  decisionNote: string;
  carryOver: boolean;
  priority: TaskPriority;
}

const emptyFormValue: TaskFormValue = {
  text: '', deadline: '', isDecision: false, decisionNote: '', carryOver: false, priority: 'MEDIUM',
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
];

/** Small class-name helper for the coloured priority chip / border used everywhere. */
function priorityClass(p: TaskPriority): string {
  return `dscrum-p-${p.toLowerCase()}`;
}

type TaskModalIntent =
  | { mode: 'add'; entryId: string; taskType: 'TODAY' | 'COMPLETED' }
  | { mode: 'edit'; task: DailyTaskShape };

interface TaskModalProps {
  intent: TaskModalIntent | null;
  onClose: () => void;
}

function TaskModal({ intent, onClose }: TaskModalProps) {
  const addTask = useAddScrumTask();
  const updateTask = useUpdateScrumTask();
  const [v, setV] = useState<TaskFormValue>(emptyFormValue);
  const open = intent !== null;

  const isEdit = intent?.mode === 'edit';
  const taskType: 'TODAY' | 'COMPLETED' =
    intent?.mode === 'edit' ? intent.task.type
      : intent?.mode === 'add' ? intent.taskType
      : 'TODAY';
  const showDetails = taskType === 'TODAY';

  useEffect(() => {
    if (!intent) { setV(emptyFormValue); return; }
    if (intent.mode === 'edit') {
      setV({
        text: intent.task.text,
        deadline: intent.task.deadline ?? '',
        isDecision: intent.task.isDecision,
        decisionNote: intent.task.decisionNote ?? '',
        carryOver: intent.task.carryOver,
        priority: intent.task.priority,
      });
    } else {
      setV(emptyFormValue);
    }
  }, [intent]);

  const title = isEdit
    ? 'Edit task'
    : taskType === 'TODAY' ? 'New task' : 'New yesterday item';

  const submitLabel = isEdit ? 'Save changes' : 'Add task';
  const saving = addTask.isPending || updateTask.isPending;

  function submit() {
    if (!intent || !v.text.trim()) return;
    if (intent.mode === 'edit') {
      updateTask.mutate(
        {
          id: intent.task.id,
          text: v.text,
          priority: v.priority,
          ...(showDetails ? {
            deadline: v.deadline || null,
            isDecision: v.isDecision,
            decisionNote: v.isDecision ? (v.decisionNote || null) : null,
            carryOver: v.carryOver,
          } : {}),
        },
        { onSuccess: onClose },
      );
    } else {
      addTask.mutate(
        {
          entryId: intent.entryId,
          type: intent.taskType,
          text: v.text,
          priority: v.priority,
          ...(showDetails && v.deadline ? { deadline: v.deadline } : {}),
          ...(showDetails ? {
            isDecision: v.isDecision,
            decisionNote: v.isDecision ? (v.decisionNote || null) : null,
            carryOver: v.carryOver,
          } : {}),
        },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            leadingIcon={isEdit ? <Save size={14} /> : <Plus size={14} />}
            loading={saving}
            disabled={!v.text.trim()}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="dscrum-form">
        <div className="dscrum-form-group">
          <label className="dscrum-form-label">TASK TITLE</label>
          <TextArea
            value={v.text}
            onChange={(e) => setV((p) => ({ ...p, text: e.target.value }))}
            placeholder="What needs to be done?"
            rows={2}
            autoFocus
          />
        </div>

        <div className="dscrum-form-group">
          <label className="dscrum-form-label">PRIORITY</label>
          <div className="dscrum-priority-picker" role="radiogroup" aria-label="Priority">
            {PRIORITY_OPTIONS.map((opt) => {
              const on = v.priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cx('dscrum-priority-option', priorityClass(opt.value), on && 'dscrum-priority-option--on')}
                  onClick={() => setV((p) => ({ ...p, priority: opt.value }))}
                >
                  <span className="dscrum-priority-dot" aria-hidden="true" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {showDetails && (
          <>
            <div className="dscrum-form-group">
              <label className="dscrum-form-label">WAITING ON DECISION</label>
              <div className="dscrum-toggle-row">
                <button
                  type="button"
                  className={cx('dscrum-toggle', v.isDecision && 'dscrum-toggle--on')}
                  onClick={() => setV((p) => ({ ...p, isDecision: !p.isDecision }))}
                  aria-pressed={v.isDecision}
                >
                  <span className="dscrum-toggle-track">
                    <span className="dscrum-toggle-knob" />
                  </span>
                  <span className="dscrum-toggle-text">
                    {v.isDecision ? 'Waiting on a decision' : 'Ready to proceed'}
                  </span>
                </button>
              </div>
              {v.isDecision && (
                <>
                  <div className="dscrum-blocker-wrap">
                    <AlertTriangle size={14} className="dscrum-blocker-icon" />
                    <TextArea
                      value={v.decisionNote}
                      onChange={(e) => setV((p) => ({ ...p, decisionNote: e.target.value }))}
                      placeholder="Whose decision is holding this back? (e.g. Waiting on budget approval from CFO)"
                      rows={2}
                      className="dscrum-blocker-input"
                    />
                  </div>
                  <p className="dscrum-form-hint">Highlighted in the scrum board so managers can spot what needs attention.</p>
                </>
              )}
            </div>

            <div className="dscrum-form-row">
              <div className="dscrum-form-group">
                <label className="dscrum-form-label">DEADLINE</label>
                <TextInput
                  type="date"
                  value={v.deadline}
                  onChange={(e) => setV((p) => ({ ...p, deadline: e.target.value }))}
                />
                <p className="dscrum-form-hint">Leave empty for no deadline.</p>
              </div>

              <div className="dscrum-form-group">
                <label className="dscrum-form-label">CARRY OVER</label>
                <label className="dscrum-check-row">
                  <input
                    type="checkbox"
                    checked={v.carryOver}
                    onChange={(e) => setV((p) => ({ ...p, carryOver: e.target.checked }))}
                  />
                  <span>If not completed, move to next day</span>
                </label>
                <p className="dscrum-form-hint">If checked, this task appears in tomorrow&apos;s Today list; otherwise it moves to tomorrow&apos;s Yesterday/Completed list when the next day is generated.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Yesterday item ──────────────────────────────────────

function YesterdayItem({
  task, canEdit, onEdit,
}: {
  task: DailyTaskShape;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const remove = useDeleteScrumTask();
  return (
    <div className="dscrum-y-item">
      <span className="dscrum-y-check"><Check size={12} strokeWidth={3} /></span>
      <span className="dscrum-y-text">{task.text}</span>
      {canEdit && (
        <div className="dscrum-inline-actions">
          <button type="button" className="dscrum-icon-btn" title="Edit" onClick={onEdit}>
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className="dscrum-icon-btn dscrum-icon-btn-danger"
            title="Delete"
            onClick={() => remove.mutate(task.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Today item ──────────────────────────────────────────

function TodayItem({
  task, canEdit, onEdit,
}: {
  task: DailyTaskShape;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const remove = useDeleteScrumTask();

  return (
    <div
      className={cx(
        'dscrum-t-item',
        'dscrum-t-item--tinted',
        priorityClass(task.priority),
        task.isDecision && 'dscrum-t-item--blocker',
      )}
    >
      <div className="dscrum-t-content">
        <div className="dscrum-t-line">
          <span className="dscrum-t-text">{task.text}</span>
          {task.deadline && (
            <span className="dscrum-t-due">due {fmtDate(task.deadline, 'd MMM')}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="dscrum-inline-actions">
          <button type="button" className="dscrum-icon-btn" title="Edit" onClick={onEdit}>
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className="dscrum-icon-btn dscrum-icon-btn-danger"
            title="Delete"
            onClick={() => remove.mutate(task.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Board row (one employee entry) ──────────────────────

interface BoardRowProps {
  entry: DailyScrumEntryShape;
  canEdit: boolean;
  onOpenTask: (intent: TaskModalIntent) => void;
}

function BoardRow({ entry, canEdit, onOpenTask }: BoardRowProps) {
  const yesterdayTasks = entry.tasks.filter((t) => t.type === 'COMPLETED');
  const todayTasks = entry.tasks.filter((t) => t.type === 'TODAY');
  const decisions = todayTasks.filter((t) => t.isDecision);

  const emp = entry.employee;

  return (
    <div className="dscrum-board-row">
      <div className="dscrum-board-cell dscrum-member-cell">
        <Avatar
          initials={initials(emp.fullName)}
          color={avatarColorFor(emp.id)}
          imageUrl={emp.avatarUrl}
          size="md"
        />
        <div className="dscrum-member-info">
          <span className="dscrum-member-name">{emp.fullName}</span>
          {emp.designation && (
            <span className="dscrum-member-role">{emp.designation}</span>
          )}
        </div>
      </div>

      <div className="dscrum-board-cell">
        {yesterdayTasks.length === 0 && (
          <span className="dscrum-none">none</span>
        )}
        {yesterdayTasks.map((t) => (
          <YesterdayItem
            key={t.id}
            task={t}
            canEdit={canEdit}
            onEdit={() => onOpenTask({ mode: 'edit', task: t })}
          />
        ))}
        {canEdit && (
          <button
            type="button"
            className="dscrum-add-btn"
            onClick={() => onOpenTask({ mode: 'add', entryId: entry.id, taskType: 'COMPLETED' })}
          >
            <Plus size={11} /> Add item
          </button>
        )}
      </div>

      <div className="dscrum-board-cell">
        {todayTasks.length === 0 && (
          <span className="dscrum-none">none</span>
        )}
        {todayTasks.map((t) => (
          <TodayItem
            key={t.id}
            task={t}
            canEdit={canEdit}
            onEdit={() => onOpenTask({ mode: 'edit', task: t })}
          />
        ))}
        {canEdit && (
          <button
            type="button"
            className="dscrum-add-btn"
            onClick={() => onOpenTask({ mode: 'add', entryId: entry.id, taskType: 'TODAY' })}
          >
            <Plus size={11} /> Add task
          </button>
        )}
      </div>

      <div className="dscrum-board-cell">
        {decisions.length === 0 ? (
          <span className="dscrum-none">none</span>
        ) : (
          <ul className="dscrum-decision-list">
            {decisions.map((t) => (
              <li key={t.id} className="dscrum-decision-item">
                <span className="dscrum-decision-diamond">◇</span>
                <span>{t.decisionNote?.trim() ? t.decisionNote : t.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

// ─── Placeholder row (user without an entry) ─────────────

interface PlaceholderRowProps {
  user: UserSummary;
  date: string;
}

function PlaceholderRow({ user, date }: PlaceholderRowProps) {
  const upsert = useUpsertScrumEntry();
  return (
    <div className="dscrum-board-row dscrum-board-row-empty">
      <div className="dscrum-board-cell dscrum-member-cell">
        <Avatar
          initials={initials(user.fullName)}
          color={avatarColorFor(user.id)}
          imageUrl={user.avatarUrl}
          size="md"
        />
        <div className="dscrum-member-info">
          <span className="dscrum-member-name">{user.fullName}</span>
          {user.designation && (
            <span className="dscrum-member-role">{user.designation}</span>
          )}
        </div>
      </div>
      <div className="dscrum-board-cell dscrum-placeholder-cell" style={{ gridColumn: 'span 3' }}>
        <span className="dscrum-none">No entry yet</span>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Plus size={12} />}
          loading={upsert.isPending}
          onClick={() => upsert.mutate({ date, employeeId: user.id })}
        >
          Create entry
        </Button>
      </div>
    </div>
  );
}

// ─── Detail modal (the team board) ───────────────────────

interface DetailModalProps {
  date: string;
  filterToUserId?: string;
  onClose: () => void;
}

function DetailModal({ date, filterToUserId, onClose }: DetailModalProps) {
  const { data, isLoading } = useDailyScrumDay(date);
  const { data: users } = useUsers();
  const currentUser = useCurrentUser();
  const [searchQ, setSearchQ] = useState('');
  const [taskIntent, setTaskIntent] = useState<TaskModalIntent | null>(null);

  const canEditAll = data?.canEditAll ?? false;
  const canEditTeam = data?.canEditTeam ?? false;

  const entries = useMemo(() => {
    const src = data?.entries ?? [];
    const filtered = filterToUserId
      ? src.filter((e) => e.employeeId === filterToUserId)
      : src;
    return [...filtered].sort(byEmployeeId((e) => e.employee));
  }, [data, filterToUserId]);

  const activeUsers = useMemo(() => {
    if (!users) return [] as UserSummary[];
    return users
      .filter((u) => u.isActive && !u.deletedAt)
      .filter((u) => (filterToUserId ? u.id === filterToUserId : true))
      .sort(byEmployeeId((u) => u));
  }, [users, filterToUserId]);

  const entryUserIds = new Set(entries.map((e) => e.employeeId));
  const missing = activeUsers.filter((u) => !entryUserIds.has(u.id));

  const q = searchQ.trim().toLowerCase();
  const visibleEntries = q
    ? entries.filter(
        (e) =>
          e.employee.fullName.toLowerCase().includes(q) ||
          e.tasks.some((t) => t.text.toLowerCase().includes(q)),
      )
    : entries;
  const visibleMissing = q
    ? missing.filter((u) => u.fullName.toLowerCase().includes(q))
    : missing;

  function canEditEntry(e: DailyScrumEntryShape): boolean {
    if (canEditAll) return true;
    if (currentUser && e.employeeId === currentUser.id) return true;
    if (canEditTeam) return true;
    return false;
  }

  const memberCount = entries.length + missing.length;
  const taskCount = entries.reduce((sum, e) => sum + e.tasks.length, 0);
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const { createWorkbook, addSheet, addRows, XLSX_MIME } = await import('@/lib/reports/workbook');
      const wb = createWorkbook();
      const cols = [
        { header: 'SL#', key: 'sl', width: 6 },
        { header: 'Employee', key: 'name', width: 26 },
        { header: 'Department', key: 'dept', width: 20 },
        { header: 'Designation', key: 'desig', width: 22 },
        { header: 'Yesterday/Completed', key: 'yesterday', width: 60 },
        { header: "Today's Tasks", key: 'today', width: 60 },
        { header: 'Decisions/Blockers', key: 'decisions', width: 40 },
      ];
      const sheet = addSheet(wb, `Scrum ${date}`, cols);
      addRows(sheet, entries.map((e, i) => ({
        sl: i + 1,
        name: e.employee.fullName,
        dept: e.employee.department ?? '',
        desig: e.employee.designation ?? '',
        yesterday: e.tasks.filter((t) => t.type === 'COMPLETED').map((t) => t.text).join(' | '),
        today: e.tasks.filter((t) => t.type === 'TODAY').map((t) => t.text).join(' | '),
        decisions: e.tasks
          .filter((t) => t.type === 'TODAY' && t.isDecision)
          .map((t) => t.decisionNote?.trim() || t.text)
          .join(' | '),
      })));
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf as ArrayBuffer], { type: XLSX_MIME });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-scrum-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="full"
        widthOverride="min(1600px, calc(100vw - 48px))"
        hideHeader
        footer={
          <div className="dscrum-footer-actions">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download size={14} />}
              loading={exporting}
              onClick={exportExcel}
            >
              Export Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
        }
      >
        <div className="dscrum-modal-hero">
          <div className="dscrum-modal-hero-text">
            <p className="dscrum-modal-hero-title">Daily Scrum</p>
            <p className="dscrum-modal-hero-date">{fmtDate(date, 'EEEE, d MMMM yyyy')}</p>
            <p className="dscrum-modal-hero-meta">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Trace Consulting Logo White.png" alt="TRACE HRMS" className="dscrum-modal-hero-logo" />
          <button type="button" className="dscrum-modal-hero-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="dscrum-modal-search">
          <Search size={14} className="dscrum-search-icon" />
          <input
            className="dscrum-search-input"
            placeholder="Search tasks or people"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {isLoading && <div className="dscrum-loading">Loading…</div>}

        {!isLoading && visibleEntries.length === 0 && visibleMissing.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="Nothing to show"
            body={searchQ ? 'Try a different search term.' : 'No scrum entries for this date.'}
          />
        )}

        {!isLoading && (visibleEntries.length > 0 || visibleMissing.length > 0) && (
          <div className="dscrum-board">
            <div className="dscrum-board-head">
              <div>Member</div>
              <div>Yesterday/Completed</div>
              <div>Today</div>
              <div>Decisions/Blockers</div>
            </div>

            {visibleEntries.map((entry) => (
              <BoardRow
                key={entry.id}
                entry={entry}
                canEdit={canEditEntry(entry)}
                onOpenTask={setTaskIntent}
              />
            ))}

            {visibleMissing.map((u) => (
              <PlaceholderRow key={u.id} user={u} date={date} />
            ))}
          </div>
        )}
      </Modal>

      <TaskModal intent={taskIntent} onClose={() => setTaskIntent(null)} />
    </>
  );
}

// ─── Daily Scrum tab (date list) ─────────────────────────

function DailyScrumTab() {
  const currentUser = useCurrentUser();
  const addToast = useStore((s) => s.addToast);
  const { data: datesData, isLoading } = useDailyScrumDates();
  const generateDay = useGenerateScrumDay();
  const [dateFilter, setDateFilter] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState(todayISO());

  const roles = currentUser?.roles ?? [];
  const isHr = roles.includes('HR') || roles.includes('SUPER_ADMIN');

  const allDates = datesData?.dates ?? [];
  const visibleDates = dateFilter
    ? allDates.filter((d) => d === dateFilter)
    : allDates;

  function handleGenerate() {
    if (!generateDate) return;
    generateDay.mutate(generateDate, {
      onSuccess: (r) => {
        addToast({
          kind: 'success',
          title: 'Scrum board generated',
          body: r.createdEntries === 0
            ? `All rostered employees already have an entry for ${fmtDate(generateDate, 'd MMM yyyy')}.`
            : `${r.createdEntries} new ${r.createdEntries === 1 ? 'entry' : 'entries'} created for ${fmtDate(generateDate, 'd MMM yyyy')}${r.copiedTasks > 0 ? ` (${r.copiedTasks} tasks carried from prior day)` : ''}.`,
        });
      },
      onError: (e: Error) => {
        addToast({
          kind: 'error',
          title: 'Generation failed',
          body: e.message || 'Something went wrong.',
        });
      },
    });
  }

  return (
    <div className="dscrum-tab-content">
      <div className="dscrum-controls">
        <label className="dscrum-date-wrap">
          <Calendar size={16} className="dscrum-date-icon" />
          <span className="dscrum-date-label">Filter</span>
          <input
            type="date"
            className="dscrum-date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button
              type="button"
              className="dscrum-date-clear"
              onClick={() => setDateFilter('')}
            >
              Clear
            </button>
          )}
        </label>
        {isHr && (
          <div className="dscrum-generate-wrap">
            <label className="dscrum-date-wrap">
              <span className="dscrum-date-label">Generate for</span>
              <input
                type="date"
                className="dscrum-date-input"
                value={generateDate}
                onChange={(e) => setGenerateDate(e.target.value)}
                aria-label="Date to generate"
              />
            </label>
            <Button
              size="sm"
              variant="primary"
              loading={generateDay.isPending}
              onClick={handleGenerate}
            >
              Generate
            </Button>
          </div>
        )}
      </div>

      {isLoading && <div className="dscrum-loading">Loading…</div>}

      {!isLoading && visibleDates.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No scrum days"
          body="No scrum entries have been generated yet."
        />
      )}

      {!isLoading && visibleDates.length > 0 && (
        <div className="dscrum-list-table">
          <div className="dscrum-list-head">
            <div>SL#</div>
            <div>Date</div>
            <div>Day</div>
            <div />
          </div>
          {visibleDates.map((d, i) => (
            <div className="dscrum-list-row" key={d}>
              <div>{i + 1}</div>
              <div>{fmtDate(d, 'd MMM yyyy')}</div>
              <div>{fmtDate(d, 'EEEE')}</div>
              <div className="dscrum-list-action">
                <Button size="sm" variant="secondary" onClick={() => setActiveDate(d)}>
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeDate && (
        <DetailModal date={activeDate} onClose={() => setActiveDate(null)} />
      )}
    </div>
  );
}

// ─── My Tasks tab ────────────────────────────────────────

function MyTasksTab() {
  const currentUser = useCurrentUser();
  const { data: datesData, isLoading } = useDailyScrumDates();
  const [dateFilter, setDateFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const allDates = datesData?.dates ?? [];
  const visibleDates = dateFilter
    ? allDates.filter((d) => d === dateFilter)
    : allDates;

  return (
    <div className="dscrum-tab-content">
      <div className="dscrum-controls">
        <div className="dscrum-date-wrap">
          <Calendar size={16} className="dscrum-date-icon" />
          <input
            type="date"
            className="dscrum-date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button
              type="button"
              className="dscrum-date-clear"
              onClick={() => setDateFilter('')}
            >
              Clear
            </button>
          )}
        </div>
        <div className="dscrum-modal-search dscrum-modal-search-inline">
          <Search size={14} className="dscrum-search-icon" />
          <input
            className="dscrum-search-input"
            placeholder="Search tasks…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <div className="dscrum-loading">Loading…</div>}

      {!isLoading && visibleDates.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No entries"
          body="No scrum entries found for the selected period."
        />
      )}

      {!isLoading && visibleDates.length > 0 && (
        <div className="dscrum-list-table">
          <div className="dscrum-list-head">
            <div>SL#</div>
            <div>Date</div>
            <div>Day</div>
            <div />
          </div>
          {visibleDates.map((d, i) => (
            <MyTasksRow
              key={d}
              date={d}
              serial={i + 1}
              userId={currentUser?.id ?? ''}
              searchQ={searchQ}
              onDetails={() => setActiveDate(d)}
            />
          ))}
        </div>
      )}

      {activeDate && currentUser && (
        <DetailModal
          date={activeDate}
          filterToUserId={currentUser.id}
          onClose={() => setActiveDate(null)}
        />
      )}
    </div>
  );
}

interface MyTasksRowProps {
  date: string;
  serial: number;
  userId: string;
  searchQ: string;
  onDetails: () => void;
}

function MyTasksRow({ date, serial, userId, searchQ, onDetails }: MyTasksRowProps) {
  const { data } = useDailyScrumDay(date);
  const myEntry = data?.entries.find((e) => e.employeeId === userId);

  const q = searchQ.trim().toLowerCase();
  if (myEntry && q) {
    const matches =
      myEntry.employee.fullName.toLowerCase().includes(q) ||
      myEntry.tasks.some((t) => t.text.toLowerCase().includes(q));
    if (!matches) return null;
  }

  return (
    <div className="dscrum-list-row">
      <div>{serial}</div>
      <div>{fmtDate(date, 'd MMM yyyy')}</div>
      <div>{fmtDate(date, 'EEEE')}</div>
      <div className="dscrum-list-action">
        <Button size="sm" variant="secondary" onClick={onDetails}>Details</Button>
      </div>
    </div>
  );
}

// ─── Page root ───────────────────────────────────────────

export function DailyScrumPage() {
  const [tab, setTab] = useState<'SCRUM' | 'MY_TASKS'>('SCRUM');

  return (
    <div className="dscrum">
      <div className="dscrum-head">
        <h1>Daily Task Tracker</h1>
        <p className="muted">Track daily standups and individual task progress.</p>
      </div>

      <div className="dscrum-tabs">
        <button
          className={cx('dscrum-tab', tab === 'SCRUM' && 'dscrum-tab-active')}
          onClick={() => setTab('SCRUM')}
        >
          Daily Scrum
        </button>
        <button
          className={cx('dscrum-tab', tab === 'MY_TASKS' && 'dscrum-tab-active')}
          onClick={() => setTab('MY_TASKS')}
        >
          My Tasks
        </button>
      </div>

      {tab === 'SCRUM' && <DailyScrumTab />}
      {tab === 'MY_TASKS' && <MyTasksTab />}
    </div>
  );
}
