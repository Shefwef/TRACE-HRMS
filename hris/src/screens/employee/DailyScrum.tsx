'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Search, Plus, Pencil, Trash2, ClipboardList,
  Download, Check, AlertTriangle, Save, X, ListChecks,
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
  /** Stack depth when opened on top of another modal (dims parent). */
  stackLevel?: number;
}

function TaskModal({ intent, onClose, stackLevel = 0 }: TaskModalProps) {
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
      stackLevel={stackLevel}
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
      </div>
      {task.deadline && (
        <span className="dscrum-t-due">due {fmtDate(task.deadline, 'd MMM')}</span>
      )}
    </div>
  );
}

// ─── Board row (one employee entry) ──────────────────────

interface BoardRowProps {
  entry: DailyScrumEntryShape;
  canEdit: boolean;
  onOpenTask: (intent: TaskModalIntent) => void;
  onOpenEmployee: (entryId: string) => void;
}

function BoardRow({ entry, canEdit, onOpenTask, onOpenEmployee }: BoardRowProps) {
  const yesterdayTasks = entry.tasks.filter((t) => t.type === 'COMPLETED');
  const todayTasks = entry.tasks.filter((t) => t.type === 'TODAY');
  const decisions = todayTasks.filter((t) => t.isDecision);

  const emp = entry.employee;

  return (
    <div className="dscrum-board-row">
      <button
        type="button"
        className="dscrum-board-cell dscrum-member-cell dscrum-member-cell--clickable"
        onClick={() => onOpenEmployee(entry.id)}
        title="Open task checkboxes for this person"
      >
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
          <span className="dscrum-member-cta">
            <ListChecks size={11} /> Open tasks
          </span>
        </div>
      </button>

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

// ─── Per-employee Daily Tasks popup ──────────────────────
/**
 * Nested modal that opens when someone clicks the member cell of a scrum
 * board row. Shows all of that employee's tasks for the day split across
 * In Progress / Done tabs, lets the viewer flip a task's status by ticking
 * its checkbox, and offers a compact inline "New task" form at the bottom
 * so HR / the employee can add work without leaving the popup.
 *
 * Deliberately narrower than the team board modal — the point here is a
 * one-person focus view, not another wide grid.
 */
interface EmployeeTasksPopupProps {
  entry: DailyScrumEntryShape;
  date: string;
  canEdit: boolean;
  onClose: () => void;
  /** Stack depth when opened on top of another modal (dims parent). */
  stackLevel?: number;
}

interface QuickTaskFormValue {
  text: string;
  priority: TaskPriority;
  deadline: string;
  isDecision: boolean;
  decisionNote: string;
  carryOver: boolean;
}

const emptyQuickForm: QuickTaskFormValue = {
  text: '', priority: 'MEDIUM', deadline: '', isDecision: false, decisionNote: '', carryOver: false,
};

function EmployeeTasksPopup({ entry, date, canEdit, onClose, stackLevel = 0 }: EmployeeTasksPopupProps) {
  const [tab, setTab] = useState<'IN_PROGRESS' | 'DONE'>('IN_PROGRESS');
  const [v, setV] = useState<QuickTaskFormValue>(emptyQuickForm);
  const addTask = useAddScrumTask();
  const updateTask = useUpdateScrumTask();
  const removeTask = useDeleteScrumTask();

  // Only TODAY-type tasks live in the tabs — COMPLETED-type rows represent
  // rolled-forward yesterday items and don't need a status flip UI.
  const todayTasks = entry.tasks.filter((t) => t.type === 'TODAY');
  const inProgress = todayTasks.filter((t) => t.status !== 'DONE');
  const done       = todayTasks.filter((t) => t.status === 'DONE');
  const visible    = tab === 'IN_PROGRESS' ? inProgress : done;

  function toggleStatus(task: DailyTaskShape) {
    updateTask.mutate({
      id: task.id,
      status: task.status === 'DONE' ? 'IN_PROGRESS' : 'DONE',
    });
  }

  function submit() {
    if (!v.text.trim()) return;
    addTask.mutate(
      {
        entryId: entry.id,
        type: 'TODAY',
        text: v.text.trim(),
        priority: v.priority,
        status: 'IN_PROGRESS',
        isDecision: v.isDecision,
        decisionNote: v.isDecision ? (v.decisionNote.trim() || null) : null,
        carryOver: v.carryOver,
        ...(v.deadline ? { deadline: v.deadline } : {}),
      },
      { onSuccess: () => setV(emptyQuickForm) },
    );
  }

  const emp = entry.employee;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      widthOverride="min(720px, calc(100vw - 48px))"
      hideHeader
      stackLevel={stackLevel}
      footer={
        <div className="dscrum-etp-footer">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      }
    >
      {/* Compact header — mirrors the main modal hero but for one person */}
      <div className="dscrum-etp-head">
        <div className="dscrum-etp-head-left">
          <Avatar
            initials={initials(emp.fullName)}
            color={avatarColorFor(emp.id)}
            imageUrl={emp.avatarUrl}
            size="lg"
          />
          <div className="dscrum-etp-head-text">
            <p className="dscrum-etp-title">Daily Tasks</p>
            <p className="dscrum-etp-name">{emp.fullName}</p>
            <p className="dscrum-etp-meta">
              {emp.designation ? `${emp.designation} · ` : ''}{fmtDate(date, 'EEEE, d MMM yyyy')}
            </p>
          </div>
        </div>
        <button type="button" className="dscrum-etp-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* System-standard tabs (matches Daily Scrum / My Tasks page tabs) */}
      <div className="dscrum-tabs dscrum-etp-tabs">
        <button
          type="button"
          className={cx('dscrum-tab', tab === 'IN_PROGRESS' && 'dscrum-tab-active')}
          onClick={() => setTab('IN_PROGRESS')}
        >
          In Progress <span className="dscrum-etp-count">{inProgress.length}</span>
        </button>
        <button
          type="button"
          className={cx('dscrum-tab', tab === 'DONE' && 'dscrum-tab-active')}
          onClick={() => setTab('DONE')}
        >
          Done <span className="dscrum-etp-count">{done.length}</span>
        </button>
      </div>

      {/* Task list */}
      <div className="dscrum-etp-list">
        {visible.length === 0 && (
          <div className="dscrum-etp-empty">
            {tab === 'IN_PROGRESS' ? 'No tasks in progress.' : 'Nothing marked done yet.'}
          </div>
        )}
        {visible.map((t) => (
          <div
            key={t.id}
            className={cx(
              'dscrum-etp-row',
              priorityClass(t.priority),
              t.isDecision && 'dscrum-t-item--blocker',
            )}
          >
            <input
              type="checkbox"
              className="dscrum-etp-check"
              checked={t.status === 'DONE'}
              disabled={!canEdit || updateTask.isPending}
              onChange={() => toggleStatus(t)}
              aria-label={t.status === 'DONE' ? 'Mark as in progress' : 'Mark as done'}
            />
            <div className="dscrum-etp-row-body">
              <div className={cx('dscrum-etp-row-text', t.status === 'DONE' && 'dscrum-etp-row-text--done')}>
                {t.text}
              </div>
              {(t.deadline || t.isDecision) && (
                <div className="dscrum-etp-row-meta">
                  {t.deadline && <span>due {fmtDate(t.deadline, 'd MMM')}</span>}
                  {t.isDecision && (
                    <span className="dscrum-etp-blocker-tag">
                      <AlertTriangle size={11} />
                      {t.decisionNote?.trim() || 'Waiting on decision'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                className="dscrum-icon-btn dscrum-icon-btn-danger"
                title="Delete"
                onClick={() => removeTask.mutate(t.id)}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Inline add form (only when the viewer can edit this entry) */}
      {canEdit && (
        <div className="dscrum-etp-add">
          <div className="dscrum-etp-add-head">
            <Plus size={14} />
            <span>New task</span>
          </div>
          <div className="dscrum-form">
            <div className="dscrum-form-group">
              <label className="dscrum-form-label">TASK TITLE</label>
              <TextArea
                value={v.text}
                onChange={(e) => setV((p) => ({ ...p, text: e.target.value }))}
                placeholder="What needs to be done?"
                rows={2}
              />
            </div>

            <div className="dscrum-form-row">
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

              <div className="dscrum-form-group">
                <label className="dscrum-form-label">DEADLINE</label>
                <TextInput
                  type="date"
                  value={v.deadline}
                  onChange={(e) => setV((p) => ({ ...p, deadline: e.target.value }))}
                />
              </div>
            </div>

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
                <div className="dscrum-blocker-wrap">
                  <AlertTriangle size={14} className="dscrum-blocker-icon" />
                  <TextArea
                    value={v.decisionNote}
                    onChange={(e) => setV((p) => ({ ...p, decisionNote: e.target.value }))}
                    placeholder="Whose decision is holding this back?"
                    rows={2}
                    className="dscrum-blocker-input"
                  />
                </div>
              )}
            </div>

            <div className="dscrum-form-group dscrum-etp-add-actions">
              <Button
                variant="primary"
                leadingIcon={<Plus size={14} />}
                loading={addTask.isPending}
                disabled={!v.text.trim()}
                onClick={submit}
              >
                Add task
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
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
  const [openedEntryId, setOpenedEntryId] = useState<string | null>(null);

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
                onOpenEmployee={setOpenedEntryId}
              />
            ))}

            {visibleMissing.map((u) => (
              <PlaceholderRow key={u.id} user={u} date={date} />
            ))}
          </div>
        )}
      </Modal>

      <TaskModal
        intent={taskIntent}
        onClose={() => setTaskIntent(null)}
        stackLevel={1}
      />

      {openedEntryId && (() => {
        const opened = entries.find((e) => e.id === openedEntryId);
        if (!opened) return null;
        return (
          <EmployeeTasksPopup
            entry={opened}
            date={date}
            canEdit={canEditEntry(opened)}
            onClose={() => setOpenedEntryId(null)}
            stackLevel={1}
          />
        );
      })()}
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
        <div className="dscrum-mytasks-grid">
          {visibleDates.map((d) => (
            <ScrumDateCard
              key={d}
              date={d}
              onDetails={() => setActiveDate(d)}
            />
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
        <div className="dscrum-mytasks-grid">
          {visibleDates.map((d) => (
            <MyTaskCard
              key={d}
              date={d}
              userId={currentUser?.id ?? ''}
              onDetails={() => setActiveDate(d)}
            />
          ))}
        </div>
      )}

      {activeDate && currentUser && (
        <MyTasksDetailPopup
          date={activeDate}
          userId={currentUser.id}
          onClose={() => setActiveDate(null)}
        />
      )}
    </div>
  );
}

// ─── My Tasks details popup (single-person focused) ─────
/**
 * When someone clicks Details on a My Tasks card, they get the same
 * focused per-employee popup that HR sees on the scrum board — never
 * the full team-board layout. Keeps the surface consistent and keeps
 * the person centred on their own In Progress / Done split.
 */
function MyTasksDetailPopup({
  date, userId, onClose,
}: {
  date: string;
  userId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useDailyScrumDay(date);
  const myEntry = data?.entries.find((e) => e.employeeId === userId);

  if (isLoading) {
    return (
      <Modal open onClose={onClose} title="Loading…" size="sm">
        <div className="dscrum-loading">Loading your tasks…</div>
      </Modal>
    );
  }

  if (!myEntry) {
    return (
      <Modal open onClose={onClose} title="No entry" size="sm">
        <div className="dscrum-etp-empty">
          You don&apos;t have a scrum entry for {fmtDate(date, 'd MMM yyyy')} yet.
        </div>
      </Modal>
    );
  }

  return (
    <EmployeeTasksPopup
      entry={myEntry}
      date={date}
      canEdit
      onClose={onClose}
    />
  );
}

/**
 * Slim calendar-square card for the Daily Scrum date list. Same visual shell
 * as MyTaskCard but without any task-count summary — HR/managers just need
 * to pick a date and jump into the team board.
 */
function ScrumDateCard({ date, onDetails }: { date: string; onDetails: () => void }) {
  const isToday = date === todayISO();
  return (
    <button
      type="button"
      className={cx('dscrum-mytasks-card', isToday && 'dscrum-mytasks-card--today')}
      onClick={onDetails}
    >
      <div className="dscrum-mytasks-date" aria-hidden="true">
        <span className="dscrum-mytasks-date-dow">{fmtDate(date, 'EEE').toUpperCase()}</span>
        <span className="dscrum-mytasks-date-day">{fmtDate(date, 'd')}</span>
        <span className="dscrum-mytasks-date-mon">{fmtDate(date, 'MMM').toUpperCase()}</span>
      </div>
      <div className="dscrum-mytasks-info">
        <div className="dscrum-mytasks-info-top">
          <span className="dscrum-mytasks-weekday">{fmtDate(date, 'EEEE')}</span>
          {isToday && <span className="dscrum-mytasks-today-tag">Today</span>}
        </div>
        <div className="dscrum-mytasks-full">{fmtDate(date, 'd MMMM yyyy')}</div>
      </div>
      <div className="dscrum-mytasks-action">
        <span className="dscrum-mytasks-details-btn">Details →</span>
      </div>
    </button>
  );
}

interface MyTaskCardProps {
  date: string;
  userId: string;
  onDetails: () => void;
}

/**
 * Calendar-square card row for the My Tasks list. The date on the left reads
 * like a wall-calendar tile (weekday · big day · month), the middle summarises
 * the day's work, and Details opens the same filtered team modal as before.
 */
function MyTaskCard({ date, userId, onDetails }: MyTaskCardProps) {
  const { data } = useDailyScrumDay(date);
  const myEntry = data?.entries.find((e) => e.employeeId === userId);

  const todayTasks = myEntry?.tasks.filter((t) => t.type === 'TODAY') ?? [];
  const doneCount = todayTasks.filter((t) => t.status === 'DONE').length;
  const inProgressCount = todayTasks.length - doneCount;
  const blockerCount = todayTasks.filter((t) => t.isDecision).length;

  const isToday = date === todayISO();

  return (
    <button
      type="button"
      className={cx('dscrum-mytasks-card', isToday && 'dscrum-mytasks-card--today')}
      onClick={onDetails}
    >
      <div className="dscrum-mytasks-date" aria-hidden="true">
        <span className="dscrum-mytasks-date-dow">{fmtDate(date, 'EEE').toUpperCase()}</span>
        <span className="dscrum-mytasks-date-day">{fmtDate(date, 'd')}</span>
        <span className="dscrum-mytasks-date-mon">{fmtDate(date, 'MMM').toUpperCase()}</span>
      </div>

      <div className="dscrum-mytasks-info">
        <div className="dscrum-mytasks-info-top">
          <span className="dscrum-mytasks-weekday">{fmtDate(date, 'EEEE')}</span>
          {isToday && <span className="dscrum-mytasks-today-tag">Today</span>}
        </div>
        <div className="dscrum-mytasks-full">{fmtDate(date, 'd MMMM yyyy')}</div>
        {myEntry ? (
          <div className="dscrum-mytasks-summary">
            {todayTasks.length === 0 ? (
              <span className="dscrum-mytasks-muted">No tasks logged</span>
            ) : (
              <>
                <span>{todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}</span>
                {doneCount > 0 && <span className="dscrum-mytasks-done-count">· {doneCount} done</span>}
                {inProgressCount > 0 && <span className="dscrum-mytasks-progress-count">· {inProgressCount} in progress</span>}
                {blockerCount > 0 && <span className="dscrum-mytasks-blocker-count">· {blockerCount} waiting on decision</span>}
              </>
            )}
          </div>
        ) : (
          <div className="dscrum-mytasks-summary dscrum-mytasks-muted">
            No entry for this day
          </div>
        )}
      </div>

      <div className="dscrum-mytasks-action">
        <span className="dscrum-mytasks-details-btn">Details →</span>
      </div>
    </button>
  );
}

// ─── Page root ───────────────────────────────────────────

export function DailyScrumPage() {
  const [tab, setTab] = useState<'SCRUM' | 'MY_TASKS'>('MY_TASKS');

  return (
    <div className="dscrum">
      <div className="dscrum-head">
        <h1>Daily Task Tracker</h1>
        <p className="muted">Track daily standups and individual task progress.</p>
      </div>

      <div className="dscrum-tabs">
                <button
          className={cx('dscrum-tab', tab === 'MY_TASKS' && 'dscrum-tab-active')}
          onClick={() => setTab('MY_TASKS')}
        >
          My Tasks
        </button>
        <button
          className={cx('dscrum-tab', tab === 'SCRUM' && 'dscrum-tab-active')}
          onClick={() => setTab('SCRUM')}
        >
          Daily Scrum
        </button>
      </div>

      {tab === 'SCRUM' && <DailyScrumTab />}
      {tab === 'MY_TASKS' && <MyTasksTab />}
    </div>
  );
}
