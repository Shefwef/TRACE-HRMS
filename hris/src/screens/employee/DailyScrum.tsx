'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, Search, Plus, Pencil, Trash2, ArrowRight, ClipboardList, Download, Sparkles,
} from 'lucide-react';
import {
  useDailyScrumDay, useDailyScrumDates, useUpsertScrumEntry, useUpdateScrumEntry,
  useAddScrumTask, useUpdateScrumTask, useDeleteScrumTask, useMoveTaskNextDay,
  useEnsureScrumWeek, useUsers,
  type DailyScrumEntryShape, type DailyTaskShape, type UserSummary,
} from '@/lib/hooks';
import { useCurrentUser, initials, avatarColorFor } from '@/lib/session';
import { useStore } from '@/lib/store';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, TextInput, TextArea } from '../../components/ui/Field';
import { cx, fmtDate, todayISO } from '../../lib/utils';
import './DailyScrum.css';

type ScrumStatus = 'ON_TRACK' | 'ATTENTION_NEEDED' | 'BLOCKED';

const statusVariant: Record<ScrumStatus, 'success' | 'warning' | 'danger'> = {
  ON_TRACK: 'success',
  ATTENTION_NEEDED: 'warning',
  BLOCKED: 'danger',
};

const statusLabel: Record<ScrumStatus, string> = {
  ON_TRACK: 'On track',
  ATTENTION_NEEDED: 'Attention needed',
  BLOCKED: 'Blocked',
};

const statusColorVar: Record<ScrumStatus, string> = {
  ON_TRACK: 'var(--color-success)',
  ATTENTION_NEEDED: 'var(--color-warning)',
  BLOCKED: 'var(--color-danger)',
};

/** Return the Sunday of the ISO calendar week that contains `dayKey`. */
function sundayOf(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

function addDaysISO(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Local weekday index (0 = Sunday) for a YYYY-MM-DD key. */
function dowOf(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ─── Inline task form ────────────────────────────────────

interface TaskFormState {
  text: string;
  deadline: string;
  isDecision: boolean;
  decisionNote: string;
}

const emptyForm = (): TaskFormState => ({
  text: '', deadline: '', isDecision: false, decisionNote: '',
});

interface TaskFormProps {
  initial?: Partial<TaskFormState>;
  onSave: (v: TaskFormState) => void;
  onCancel: () => void;
  saving?: boolean;
  submitLabel?: string;
  showDeadline?: boolean;
  showDecision?: boolean;
}

function TaskForm({
  initial, onSave, onCancel, saving,
  submitLabel = 'Save',
  showDeadline = true,
  showDecision = true,
}: TaskFormProps) {
  const [v, setV] = useState<TaskFormState>({ ...emptyForm(), ...initial });
  return (
    <div className="dscrum-add-form">
      <TextArea
        value={v.text}
        onChange={(e) => setV((p) => ({ ...p, text: e.target.value }))}
        placeholder="What needs to be done?"
        rows={2}
        autoFocus
      />
      {showDeadline && (
        <Field label="Deadline">
          <TextInput
            type="date"
            value={v.deadline}
            onChange={(e) => setV((p) => ({ ...p, deadline: e.target.value }))}
          />
        </Field>
      )}
      {showDecision && (
        <label className="dscrum-decision-check">
          <input
            type="checkbox"
            checked={v.isDecision}
            onChange={(e) => setV((p) => ({ ...p, isDecision: e.target.checked }))}
          />
          Decision needed
        </label>
      )}
      {showDecision && v.isDecision && (
        <Field label="Decision note">
          <TextArea
            value={v.decisionNote}
            onChange={(e) => setV((p) => ({ ...p, decisionNote: e.target.value }))}
            rows={2}
            placeholder="Describe the decision needed…"
          />
        </Field>
      )}
      <div className="dscrum-form-actions">
        <Button size="sm" onClick={() => onSave(v)} loading={saving} disabled={!v.text.trim()}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Move-to-next-day inline form ───────────────────────

interface MoveFormProps {
  taskId: string;
  onDone: () => void;
}

function MoveForm({ taskId, onDone }: MoveFormProps) {
  const [deadline, setDeadline] = useState('');
  const move = useMoveTaskNextDay();
  return (
    <div className="dscrum-add-form">
      <Field label="New deadline (optional)">
        <TextInput
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Field>
      <div className="dscrum-form-actions">
        <Button
          size="sm"
          loading={move.isPending}
          onClick={() =>
            move.mutate({ id: taskId, deadline: deadline || undefined }, { onSuccess: onDone })
          }
        >
          Move
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Yesterday (COMPLETED) task item ─────────────────────

interface YesterdayItemProps {
  task: DailyTaskShape;
  index: number;
  canEdit: boolean;
}

function YesterdayItem({ task, index, canEdit }: YesterdayItemProps) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateScrumTask();
  const remove = useDeleteScrumTask();

  if (editing) {
    return (
      <TaskForm
        initial={{ text: task.text }}
        saving={update.isPending}
        submitLabel="Update"
        showDeadline={false}
        showDecision={false}
        onCancel={() => setEditing(false)}
        onSave={(v) =>
          update.mutate(
            { id: task.id, text: v.text },
            { onSuccess: () => setEditing(false) },
          )
        }
      />
    );
  }

  return (
    <div className="dscrum-task-item">
      <span className="dscrum-task-num">{index + 1}.</span>
      <span className="dscrum-task-text">{task.text}</span>
      {canEdit && (
        <div className="dscrum-inline-actions">
          <button className="dscrum-icon-btn" title="Edit" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </button>
          <button
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

// ─── Today (TODAY) task item ─────────────────────────────

interface TodayItemProps {
  task: DailyTaskShape;
  canEdit: boolean;
}

function TodayItem({ task, canEdit }: TodayItemProps) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const update = useUpdateScrumTask();
  const remove = useDeleteScrumTask();

  if (moving) return <MoveForm taskId={task.id} onDone={() => setMoving(false)} />;

  if (editing) {
    return (
      <TaskForm
        initial={{
          text: task.text,
          deadline: task.deadline ?? '',
          isDecision: task.isDecision,
          decisionNote: task.decisionNote ?? '',
        }}
        saving={update.isPending}
        submitLabel="Update"
        onCancel={() => setEditing(false)}
        onSave={(v) =>
          update.mutate(
            {
              id: task.id,
              text: v.text,
              deadline: v.deadline || null,
              isDecision: v.isDecision,
              decisionNote: v.isDecision ? (v.decisionNote || null) : null,
            },
            { onSuccess: () => setEditing(false) },
          )
        }
      />
    );
  }

  const markerClass = task.isDecision
    ? 'dscrum-task-marker--decision'
    : task.deadline
      ? 'dscrum-task-marker--deadline'
      : 'dscrum-task-marker--default';

  return (
    <div className="dscrum-task-item">
      <span className={cx('dscrum-task-marker', markerClass)} />
      <div className="dscrum-task-body">
        {task.isDecision && <span className="dscrum-decision-dot" />}
        <span className="dscrum-task-text">{task.text}</span>
        {task.deadline && (
          <span className="dscrum-task-due">due {fmtDate(task.deadline, 'd MMM')}</span>
        )}
      </div>
      {canEdit && (
        <div className="dscrum-inline-actions">
          <button className="dscrum-icon-btn" title="Edit" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </button>
          <button
            className="dscrum-icon-btn dscrum-icon-btn-danger"
            title="Delete"
            onClick={() => remove.mutate(task.id)}
          >
            <Trash2 size={12} />
          </button>
          <button
            className="dscrum-icon-btn"
            title="Move to next day"
            onClick={() => setMoving(true)}
          >
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Board row (one employee) ────────────────────────────

interface BoardRowProps {
  entry: DailyScrumEntryShape;
  serial: number;
  canEdit: boolean;
}

function BoardRow({ entry, serial, canEdit }: BoardRowProps) {
  const [addingToday, setAddingToday] = useState(false);
  const [addingYesterday, setAddingYesterday] = useState(false);
  const addTask = useAddScrumTask();
  const updateTask = useUpdateScrumTask();
  const updateEntry = useUpdateScrumEntry();

  const yesterdayTasks = entry.tasks.filter((t) => t.type === 'COMPLETED');
  const todayTasks = entry.tasks.filter((t) => t.type === 'TODAY');
  const decisions = todayTasks.filter((t) => t.isDecision);

  const emp = entry.employee;
  const status = entry.status as ScrumStatus;

  return (
    <div className="dscrum-board-row">
      <div className="dscrum-board-cell dscrum-member-cell">
        <span className="dscrum-serial">#{serial}</span>
        <div className="dscrum-member-block">
          <Avatar
            initials={initials(emp.fullName)}
            color={avatarColorFor(emp.id)}
            imageUrl={emp.avatarUrl}
            size="sm"
          />
          <div className="dscrum-member-info">
            <span className="dscrum-member-name">{emp.fullName}</span>
            {emp.designation && (
              <span className="dscrum-member-role">{emp.designation}</span>
            )}
          </div>
        </div>
      </div>

      <div className="dscrum-board-cell">
        {yesterdayTasks.length === 0 && !addingYesterday && (
          <span className="dscrum-none">none</span>
        )}
        {yesterdayTasks.map((t, i) => (
          <YesterdayItem key={t.id} task={t} index={i} canEdit={canEdit} />
        ))}
        {addingYesterday && (
          <TaskForm
            saving={addTask.isPending}
            showDeadline={false}
            showDecision={false}
            onCancel={() => setAddingYesterday(false)}
            onSave={(v) =>
              addTask.mutate(
                { entryId: entry.id, type: 'COMPLETED', text: v.text },
                { onSuccess: () => setAddingYesterday(false) },
              )
            }
          />
        )}
        {canEdit && !addingYesterday && (
          <button
            className="dscrum-add-btn"
            onClick={() => setAddingYesterday(true)}
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      <div className="dscrum-board-cell">
        {todayTasks.length === 0 && !addingToday && (
          <span className="dscrum-none">none</span>
        )}
        {todayTasks.map((t) => (
          <TodayItem key={t.id} task={t} canEdit={canEdit} />
        ))}
        {addingToday && (
          <TaskForm
            saving={addTask.isPending}
            onCancel={() => setAddingToday(false)}
            onSave={(v) => {
              addTask.mutate(
                {
                  entryId: entry.id,
                  type: 'TODAY',
                  text: v.text,
                  ...(v.deadline ? { deadline: v.deadline } : {}),
                },
                {
                  onSuccess: (created) => {
                    setAddingToday(false);
                    // Decision flag isn't part of the POST payload — patch it after creation.
                    if (v.isDecision && created?.id) {
                      updateTask.mutate({
                        id: created.id,
                        isDecision: true,
                        decisionNote: v.decisionNote || null,
                      });
                    }
                  },
                },
              );
            }}
          />
        )}
        {canEdit && !addingToday && (
          <button className="dscrum-add-btn" onClick={() => setAddingToday(true)}>
            <Plus size={12} /> Add
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

      <div className="dscrum-board-cell dscrum-status-cell">
        {canEdit ? (
          <select
            className="dscrum-status-select"
            style={{ color: statusColorVar[status] }}
            value={status}
            onChange={(e) =>
              updateEntry.mutate({
                id: entry.id,
                status: e.target.value as ScrumStatus,
              })
            }
          >
            <option value="ON_TRACK">On track</option>
            <option value="ATTENTION_NEEDED">Attention needed</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        ) : (
          <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
        )}
      </div>
    </div>
  );
}

// ─── Placeholder row for users without an entry ──────────

interface PlaceholderRowProps {
  user: UserSummary;
  serial: number;
  date: string;
}

function PlaceholderRow({ user, serial, date }: PlaceholderRowProps) {
  const upsert = useUpsertScrumEntry();
  return (
    <div className="dscrum-board-row dscrum-board-row-empty">
      <div className="dscrum-board-cell dscrum-member-cell">
        <span className="dscrum-serial">#{serial}</span>
        <div className="dscrum-member-block">
          <Avatar
            initials={initials(user.fullName)}
            color={avatarColorFor(user.id)}
            imageUrl={user.avatarUrl}
            size="sm"
          />
          <div className="dscrum-member-info">
            <span className="dscrum-member-name">{user.fullName}</span>
            {user.designation && (
              <span className="dscrum-member-role">{user.designation}</span>
            )}
          </div>
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
      <div className="dscrum-board-cell" />
    </div>
  );
}

// ─── Detail modal ───────────────────────────────────────

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

  const canEditAll = data?.canEditAll ?? false;
  const canEditTeam = data?.canEditTeam ?? false;

  const entries = useMemo(() => {
    const src = data?.entries ?? [];
    const filtered = filterToUserId
      ? src.filter((e) => e.employeeId === filterToUserId)
      : src;
    return [...filtered].sort((a, b) =>
      a.employee.fullName.localeCompare(b.employee.fullName),
    );
  }, [data, filterToUserId]);

  const activeUsers = useMemo(() => {
    if (!users) return [] as UserSummary[];
    return users
      .filter((u) => u.isActive && !u.deletedAt)
      .filter((u) => (filterToUserId ? u.id === filterToUserId : true))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
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

  function exportCSV() {
    const rows: string[][] = [[
      'SL#', 'Employee', 'Department', 'Designation',
      'Yesterday', 'Today', 'Decisions', 'Status',
    ]];
    entries.forEach((e, i) => {
      const yesterday = e.tasks
        .filter((t) => t.type === 'COMPLETED')
        .map((t) => t.text)
        .join(' | ');
      const today = e.tasks
        .filter((t) => t.type === 'TODAY')
        .map((t) => t.text)
        .join(' | ');
      const decisions = e.tasks
        .filter((t) => t.type === 'TODAY' && t.isDecision)
        .map((t) => t.decisionNote?.trim() || t.text)
        .join(' | ');
      rows.push([
        String(i + 1),
        e.employee.fullName,
        e.employee.department ?? '',
        e.employee.designation ?? '',
        yesterday,
        today,
        decisions,
        statusLabel[e.status as ScrumStatus],
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-scrum-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title="Daily Scrum"
      footer={
        <div className="dscrum-footer-actions">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={14} />}
            onClick={exportCSV}
          >
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="dscrum-modal-head">
        <span className="dscrum-modal-subtitle">
          {fmtDate(date, 'EEEE, d MMMM yyyy')} · {memberCount} {memberCount === 1 ? 'member' : 'members'} · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        </span>
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
            <div>Yesterday</div>
            <div>Today</div>
            <div>Decisions needed</div>
            <div>Status</div>
          </div>

          {visibleEntries.map((entry, i) => (
            <BoardRow
              key={entry.id}
              entry={entry}
              serial={i + 1}
              canEdit={canEditEntry(entry)}
            />
          ))}

          {visibleMissing.map((u, i) => (
            <PlaceholderRow
              key={u.id}
              user={u}
              serial={visibleEntries.length + i + 1}
              date={date}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Daily Scrum tab (date list) ─────────────────────────

function DailyScrumTab() {
  const currentUser = useCurrentUser();
  const addToast = useStore((s) => s.addToast);
  const { data: datesData, isLoading } = useDailyScrumDates();
  const ensureWeek = useEnsureScrumWeek();
  const [dateFilter, setDateFilter] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const autoRunRef = useRef(false);

  const roles = currentUser?.roles ?? [];
  const isHr = roles.includes('HR') || roles.includes('SUPER_ADMIN');

  const allDates = datesData?.dates ?? [];
  const visibleDates = dateFilter
    ? allDates.filter((d) => d === dateFilter)
    : allDates;

  useEffect(() => {
    if (!isHr) return;
    if (autoRunRef.current) return;
    autoRunRef.current = true;
    const today = todayISO();
    const thisSun = sundayOf(today);
    ensureWeek.mutate(thisSun);
    const dow = dowOf(today);
    if (dow === 5 || dow === 6) {
      const nextSun = addDaysISO(thisSun, 7);
      ensureWeek.mutate(nextSun);
    }
  }, [isHr, ensureWeek]);

  function handleEnsureWeek() {
    const sun = sundayOf(todayISO());
    ensureWeek.mutate(sun, {
      onSuccess: (r) => {
        addToast({
          kind: 'success',
          title: 'Scrum week generated',
          body: `${r.created} new ${r.created === 1 ? 'entry' : 'entries'} created for the week of ${fmtDate(sun, 'd MMM yyyy')}.`,
        });
      },
    });
  }

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
            placeholder="Filter by date"
          />
          {dateFilter && (
            <button
              className="dscrum-date-clear"
              onClick={() => setDateFilter('')}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
        {isHr && (
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Sparkles size={14} />}
            loading={ensureWeek.isPending}
            onClick={handleEnsureWeek}
          >
            Ensure this week
          </Button>
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
            <div>Members</div>
            <div>Tasks</div>
            <div />
          </div>
          {visibleDates.map((d, i) => (
            <DateListRow
              key={d}
              date={d}
              serial={i + 1}
              onDetails={() => setActiveDate(d)}
            />
          ))}
        </div>
      )}

      {activeDate && (
        <DetailModal
          date={activeDate}
          onClose={() => setActiveDate(null)}
        />
      )}
    </div>
  );
}

interface DateListRowProps {
  date: string;
  serial: number;
  onDetails: () => void;
}

function DateListRow({ date, serial, onDetails }: DateListRowProps) {
  return (
    <div className="dscrum-list-row">
      <div>{serial}</div>
      <div>{fmtDate(date, 'EEE, d MMM yyyy')}</div>
      <div>{fmtDate(date, 'EEEE')}</div>
      <div className="dscrum-list-muted">—</div>
      <div className="dscrum-list-muted">—</div>
      <div className="dscrum-list-action">
        <Button size="sm" variant="secondary" onClick={onDetails}>Details</Button>
      </div>
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
              className="dscrum-date-clear"
              onClick={() => setDateFilter('')}
              type="button"
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
        <div className="dscrum-list-table dscrum-list-table-mytasks">
          <div className="dscrum-list-head">
            <div>SL#</div>
            <div>Date</div>
            <div>Day</div>
            <div>Today</div>
            <div>Yesterday</div>
            <div>Status</div>
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

  const todayCount = myEntry?.tasks.filter((t) => t.type === 'TODAY').length ?? 0;
  const yesterdayCount = myEntry?.tasks.filter((t) => t.type === 'COMPLETED').length ?? 0;
  const status = (myEntry?.status ?? 'ON_TRACK') as ScrumStatus;

  return (
    <div className="dscrum-list-row">
      <div>{serial}</div>
      <div>{fmtDate(date, 'EEE, d MMM yyyy')}</div>
      <div>{fmtDate(date, 'EEEE')}</div>
      <div>{myEntry ? todayCount : '—'}</div>
      <div>{myEntry ? yesterdayCount : '—'}</div>
      <div>
        {myEntry ? (
          <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
        ) : (
          <span className="dscrum-list-muted">—</span>
        )}
      </div>
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
        <h1>Daily Scrum</h1>
        <p className="muted">Track daily standups and task progress.</p>
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
