'use client';
import { useMemo, useState } from 'react';
import {
  Calendar, Search, Plus, Pencil, Trash2, ArrowRight, ClipboardList, Download,
} from 'lucide-react';
import {
  useDailyScrumDay, useDailyScrumDates, useUpsertScrumEntry, useUpdateScrumEntry,
  useAddScrumTask, useUpdateScrumTask, useDeleteScrumTask, useMoveTaskNextDay,
  type DailyScrumEntryShape, type DailyTaskShape,
} from '@/lib/hooks';
import { useCurrentUser } from '@/lib/session';
import { initials, avatarColorFor } from '@/lib/session';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
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
  ATTENTION_NEEDED: 'Needs attention',
  BLOCKED: 'Blocked',
};

// ─── Task inline form ───────────────────────────────────

interface TaskFormState {
  text: string;
  deadline: string;
  isDecision: boolean;
  decisionNote: string;
}

const emptyForm = (): TaskFormState => ({ text: '', deadline: '', isDecision: false, decisionNote: '' });

interface TaskFormProps {
  initial?: Partial<TaskFormState>;
  onSave: (v: TaskFormState) => void;
  onCancel: () => void;
  saving?: boolean;
  submitLabel?: string;
}

function TaskForm({ initial, onSave, onCancel, saving, submitLabel = 'Save' }: TaskFormProps) {
  const [v, setV] = useState<TaskFormState>({ ...emptyForm(), ...initial });
  return (
    <div className="dscrum-task-form">
      <Field label="Task text">
        <TextInput
          value={v.text}
          onChange={(e) => setV((p) => ({ ...p, text: e.target.value }))}
          placeholder="What needs to be done?"
          autoFocus
        />
      </Field>
      <Field label="Deadline (optional)">
        <TextInput
          type="date"
          value={v.deadline}
          onChange={(e) => setV((p) => ({ ...p, deadline: e.target.value }))}
        />
      </Field>
      <label className="dscrum-decision-check">
        <input
          type="checkbox"
          checked={v.isDecision}
          onChange={(e) => setV((p) => ({ ...p, isDecision: e.target.checked }))}
        />
        Decision needed
      </label>
      {v.isDecision && (
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

// ─── Move-to-next-day form ──────────────────────────────

interface MoveFormProps {
  taskId: string;
  onDone: () => void;
}

function MoveForm({ taskId, onDone }: MoveFormProps) {
  const [deadline, setDeadline] = useState('');
  const move = useMoveTaskNextDay();
  return (
    <div className="dscrum-task-form">
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
          Move to next day
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Task row ───────────────────────────────────────────

interface TaskRowProps {
  task: DailyTaskShape;
  canEdit: boolean;
}

function TaskRow({ task, canEdit }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const update = useUpdateScrumTask();
  const remove = useDeleteScrumTask();

  if (moving) {
    return <MoveForm taskId={task.id} onDone={() => setMoving(false)} />;
  }

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

  return (
    <div className="dscrum-task-row">
      <div className="dscrum-task-body">
        <span className="dscrum-task-text">{task.text}</span>
        {task.deadline && (
          <span className="dscrum-task-due">due {fmtDate(task.deadline, 'd MMM')}</span>
        )}
        {task.isDecision && (
          <div className="dscrum-task-decision">
            <Badge variant="warning">Decision needed</Badge>
            {task.decisionNote && (
              <span className="dscrum-task-decision-note">{task.decisionNote}</span>
            )}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="dscrum-task-actions">
          <button className="dscrum-icon-btn" title="Edit" onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </button>
          <button
            className="dscrum-icon-btn dscrum-icon-btn-danger"
            title="Delete"
            onClick={() => remove.mutate(task.id)}
          >
            <Trash2 size={14} />
          </button>
          {task.type === 'TODAY' && (
            <button className="dscrum-icon-btn" title="Move to next day" onClick={() => setMoving(true)}>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry panel in drawer ─────────────────────────────

interface EntryPanelProps {
  entry: DailyScrumEntryShape;
  canEdit: boolean;
  searchQ: string;
}

function EntryPanel({ entry, canEdit, searchQ }: EntryPanelProps) {
  const [addingType, setAddingType] = useState<'TODAY' | 'COMPLETED' | null>(null);
  const addTask = useAddScrumTask();
  const updateEntry = useUpdateScrumEntry();

  const todayTasks = entry.tasks.filter((t) => t.type === 'TODAY');
  const completedTasks = entry.tasks.filter((t) => t.type === 'COMPLETED');

  const matchesSearch = (t: DailyTaskShape) =>
    !searchQ || t.text.toLowerCase().includes(searchQ.toLowerCase());

  const visibleToday = todayTasks.filter(matchesSearch);
  const visibleCompleted = completedTasks.filter(matchesSearch);

  const emp = entry.employee;

  return (
    <div className="dscrum-entry-panel">
      <div className="dscrum-entry-header">
        <Avatar
          initials={initials(emp.fullName)}
          color={avatarColorFor(emp.id)}
          imageUrl={emp.avatarUrl}
          size="md"
        />
        <div>
          <div className="dscrum-entry-name">{emp.fullName}</div>
          {emp.designation && (
            <div className="dscrum-entry-role">{emp.designation}</div>
          )}
        </div>
        {canEdit && (
          <div className="dscrum-entry-status-wrap">
            <select
              className="dscrum-status-select"
              value={entry.status}
              onChange={(e) =>
                updateEntry.mutate({ id: entry.id, status: e.target.value as ScrumStatus })
              }
            >
              <option value="ON_TRACK">On track</option>
              <option value="ATTENTION_NEEDED">Needs attention</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        )}
        {!canEdit && (
          <Badge variant={statusVariant[entry.status as ScrumStatus]}>
            {statusLabel[entry.status as ScrumStatus]}
          </Badge>
        )}
      </div>

      {visibleCompleted.length > 0 && (
        <div className="dscrum-section">
          <div className="dscrum-section-title">Yesterday&apos;s completed</div>
          <ul className="dscrum-bullet-list">
            {visibleCompleted.map((t) => (
              <li key={t.id}>
                <TaskRow task={t} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dscrum-section">
        <div className="dscrum-section-title">Today&apos;s tasks</div>
        {visibleToday.length === 0 && !addingType && (
          <p className="dscrum-empty-section">No tasks yet.</p>
        )}
        {visibleToday.map((t) => (
          <TaskRow key={t.id} task={t} canEdit={canEdit} />
        ))}
        {addingType === 'TODAY' && (
          <TaskForm
            saving={addTask.isPending}
            onCancel={() => setAddingType(null)}
            onSave={(v) =>
              addTask.mutate(
                {
                  entryId: entry.id,
                  type: 'TODAY',
                  text: v.text,
                  ...(v.deadline ? { deadline: v.deadline } : {}),
                },
                { onSuccess: () => setAddingType(null) },
              )
            }
          />
        )}
        {canEdit && addingType !== 'TODAY' && (
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Plus size={14} />}
            onClick={() => setAddingType('TODAY')}
          >
            Add today task
          </Button>
        )}
      </div>

      {canEdit && (
        <div className="dscrum-section">
          <div className="dscrum-section-title">Yesterday&apos;s completed</div>
          {completedTasks.length === 0 && !addingType && (
            <p className="dscrum-empty-section">No completed tasks recorded.</p>
          )}
          {addingType === 'COMPLETED' && (
            <TaskForm
              saving={addTask.isPending}
              onCancel={() => setAddingType(null)}
              onSave={(v) =>
                addTask.mutate(
                  {
                    entryId: entry.id,
                    type: 'COMPLETED',
                    text: v.text,
                    ...(v.deadline ? { deadline: v.deadline } : {}),
                  },
                  { onSuccess: () => setAddingType(null) },
                )
              }
            />
          )}
          {addingType !== 'COMPLETED' && (
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Plus size={14} />}
              onClick={() => setAddingType('COMPLETED')}
            >
              Add completed task
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail drawer ─────────────────────────────────────

interface DetailDrawerProps {
  date: string;
  entries: DailyScrumEntryShape[];
  canEditAll: boolean;
  canEditTeam: boolean;
  currentUserId: string;
  onClose: () => void;
}

function DetailDrawer({ date, entries, canEditAll, canEditTeam, currentUserId, onClose }: DetailDrawerProps) {
  const [searchQ, setSearchQ] = useState('');
  const upsert = useUpsertScrumEntry();

  const filtered = useMemo(() => {
    if (!searchQ) return entries;
    const q = searchQ.toLowerCase();
    return entries.filter(
      (e) =>
        e.employee.fullName.toLowerCase().includes(q) ||
        e.tasks.some((t) => t.text.toLowerCase().includes(q)),
    );
  }, [entries, searchQ]);

  function canEditEntry(e: DailyScrumEntryShape) {
    if (canEditAll) return true;
    if (e.employeeId === currentUserId) return true;
    if (canEditTeam) return true;
    return false;
  }

  function exportToExcel() {
    const rows: string[][] = [['Employee', 'Department', 'Status', 'Task Type', 'Task', 'Deadline', 'Decision']];
    for (const e of entries) {
      for (const t of e.tasks) {
        rows.push([
          e.employee.fullName,
          e.employee.department ?? '',
          statusLabel[e.status as ScrumStatus],
          t.type,
          t.text,
          t.deadline ?? '',
          t.isDecision ? (t.decisionNote ?? 'Yes') : '',
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-scrum-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width={720}
      title={`Daily Scrum — ${fmtDate(date)}`}
      subtitle={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
      footer={
        <div className="dscrum-drawer-footer">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download size={14} />}
            onClick={exportToExcel}
          >
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="dscrum-drawer-body">
        <div className="dscrum-search-bar">
          <Search size={14} className="dscrum-search-icon" />
          <input
            className="dscrum-search-input"
            placeholder="Search by name or task…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="No entries found"
            body={searchQ ? 'Try a different search term.' : 'No scrum entries for this date.'}
          />
        )}

        {filtered.map((entry) => (
          <EntryPanel
            key={entry.id}
            entry={entry}
            canEdit={canEditEntry(entry)}
            searchQ={searchQ}
          />
        ))}

        {canEditAll && (
          <div className="dscrum-add-entry-wrap">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus size={14} />}
              loading={upsert.isPending}
              onClick={() => upsert.mutate({ date })}
            >
              Add entry for myself
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ─── Scrum table row ────────────────────────────────────

interface ScrumTableRowProps {
  entry: DailyScrumEntryShape;
  onDetails: () => void;
}

function ScrumTableRow({ entry, onDetails }: ScrumTableRowProps) {
  const emp = entry.employee;
  const todayCount = entry.tasks.filter((t) => t.type === 'TODAY').length;

  return (
    <div className="dscrum-row">
      <div className="dscrum-cell dscrum-cell-employee">
        <Avatar
          initials={initials(emp.fullName)}
          color={avatarColorFor(emp.id)}
          imageUrl={emp.avatarUrl}
          size="sm"
        />
        <div className="dscrum-emp-info">
          <span className="dscrum-emp-name">{emp.fullName}</span>
          {emp.department && <span className="dscrum-emp-dept">{emp.department}</span>}
        </div>
      </div>
      <div className="dscrum-cell">
        <span className="dscrum-task-count">{todayCount}</span>
      </div>
      <div className="dscrum-cell">
        <Badge variant={statusVariant[entry.status as ScrumStatus]}>
          {statusLabel[entry.status as ScrumStatus]}
        </Badge>
      </div>
      <div className="dscrum-cell dscrum-cell-action">
        <Button size="sm" variant="secondary" onClick={onDetails}>Details</Button>
      </div>
    </div>
  );
}

// ─── Daily Scrum tab ────────────────────────────────────

function DailyScrumTab() {
  const [date, setDate] = useState(todayISO());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useCurrentUser();
  const { data, isLoading } = useDailyScrumDay(date);
  const upsert = useUpsertScrumEntry();

  const entries = data?.entries ?? [];

  function handleCreateMyEntry() {
    upsert.mutate({ date }, { onSuccess: () => setDrawerOpen(true) });
  }

  return (
    <div className="dscrum-tab-content">
      <div className="dscrum-controls">
        <div className="dscrum-date-wrap">
          <Calendar size={16} className="dscrum-date-icon" />
          <input
            type="date"
            className="dscrum-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="dscrum-stat">
          <span className="dscrum-stat-value">{entries.length}</span>
          <span className="dscrum-stat-label">{entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<ClipboardList size={14} />}
          onClick={() => {
            if (entries.length === 0) {
              handleCreateMyEntry();
            } else {
              setDrawerOpen(true);
            }
          }}
          loading={upsert.isPending}
        >
          View all
        </Button>
      </div>

      {isLoading && <div className="dscrum-loading">Loading…</div>}

      {!isLoading && entries.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No scrum entries"
          body="No one has logged their daily scrum for this date yet."
          action={
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              loading={upsert.isPending}
              onClick={handleCreateMyEntry}
            >
              Start my entry
            </Button>
          }
        />
      )}

      {!isLoading && entries.length > 0 && (
        <div className="dscrum-table">
          <div className="dscrum-thead">
            <div className="dscrum-cell">Employee</div>
            <div className="dscrum-cell">Today&apos;s tasks</div>
            <div className="dscrum-cell">Status</div>
            <div className="dscrum-cell"></div>
          </div>
          {entries.map((entry) => (
            <ScrumTableRow
              key={entry.id}
              entry={entry}
              onDetails={() => setDrawerOpen(true)}
            />
          ))}
        </div>
      )}

      {drawerOpen && data && user && (
        <DetailDrawer
          date={date}
          entries={entries}
          canEditAll={data.canEditAll}
          canEditTeam={data.canEditTeam}
          currentUserId={user.id}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── My Tasks tab ──────────────────────────────────────

function MyTasksTab() {
  const user = useCurrentUser();
  const { data: datesData, isLoading: datesLoading } = useDailyScrumDates();
  const [dateFilter, setDateFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const allDates = datesData?.dates ?? [];

  const filteredDates = useMemo(() => {
    return allDates.filter((d) => {
      if (dateFilter && !d.startsWith(dateFilter)) return false;
      return true;
    });
  }, [allDates, dateFilter]);

  return (
    <div className="dscrum-tab-content">
      <div className="dscrum-controls">
        <div className="dscrum-date-wrap">
          <Calendar size={16} className="dscrum-date-icon" />
          <input
            type="month"
            className="dscrum-date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by month"
          />
        </div>
        <div className="dscrum-search-bar dscrum-search-bar-inline">
          <Search size={14} className="dscrum-search-icon" />
          <input
            className="dscrum-search-input"
            placeholder="Search tasks…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      {datesLoading && <div className="dscrum-loading">Loading…</div>}

      {!datesLoading && filteredDates.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No entries"
          body="No scrum entries found for the selected period."
        />
      )}

      {filteredDates.length > 0 && (
        <div className="dscrum-table">
          <div className="dscrum-thead dscrum-thead-mytasks">
            <div className="dscrum-cell">Date</div>
            <div className="dscrum-cell">Today&apos;s tasks</div>
            <div className="dscrum-cell">Status</div>
            <div className="dscrum-cell"></div>
          </div>
          {filteredDates.map((d) => (
            <MyTasksDateRow
              key={d}
              date={d}
              searchQ={searchQ}
              userId={user?.id ?? ''}
              onDetails={() => setActiveDate(d)}
            />
          ))}
        </div>
      )}

      {activeDate && user && (
        <MyTasksDrawer
          date={activeDate}
          userId={user.id}
          searchQ={searchQ}
          onClose={() => setActiveDate(null)}
        />
      )}
    </div>
  );
}

interface MyTasksDateRowProps {
  date: string;
  searchQ: string;
  userId: string;
  onDetails: () => void;
}

function MyTasksDateRow({ date, onDetails }: MyTasksDateRowProps) {
  const { data } = useDailyScrumDay(date);
  const myEntry = data?.entries.find(() => true);

  if (!myEntry) {
    return (
      <div className="dscrum-row dscrum-row-loading">
        <div className="dscrum-cell">{fmtDate(date)}</div>
        <div className="dscrum-cell">—</div>
        <div className="dscrum-cell">—</div>
        <div className="dscrum-cell dscrum-cell-action">
          <Button size="sm" variant="secondary" onClick={onDetails}>Details</Button>
        </div>
      </div>
    );
  }

  const todayCount = myEntry.tasks.filter((t) => t.type === 'TODAY').length;

  return (
    <div className="dscrum-row">
      <div className="dscrum-cell">{fmtDate(date)}</div>
      <div className="dscrum-cell">
        <span className="dscrum-task-count">{todayCount}</span>
      </div>
      <div className="dscrum-cell">
        <Badge variant={statusVariant[myEntry.status as ScrumStatus]}>
          {statusLabel[myEntry.status as ScrumStatus]}
        </Badge>
      </div>
      <div className="dscrum-cell dscrum-cell-action">
        <Button size="sm" variant="secondary" onClick={onDetails}>Details</Button>
      </div>
    </div>
  );
}

interface MyTasksDrawerProps {
  date: string;
  userId: string;
  searchQ: string;
  onClose: () => void;
}

function MyTasksDrawer({ date, userId, searchQ, onClose }: MyTasksDrawerProps) {
  const { data } = useDailyScrumDay(date);
  const myEntries = (data?.entries ?? []).filter((e) => e.employeeId === userId);

  return (
    <Drawer
      open
      onClose={onClose}
      width={720}
      title={`My tasks — ${fmtDate(date)}`}
    >
      <div className="dscrum-drawer-body">
        {myEntries.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="No entry found"
            body="No scrum entry for this date."
          />
        )}
        {myEntries.map((entry) => (
          <EntryPanel
            key={entry.id}
            entry={entry}
            canEdit
            searchQ={searchQ}
          />
        ))}
      </div>
    </Drawer>
  );
}

// ─── Page root ─────────────────────────────────────────

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
