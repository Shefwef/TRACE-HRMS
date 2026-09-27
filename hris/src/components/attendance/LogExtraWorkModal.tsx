'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useSubmitExtraWork, useHolidays, useSettings } from '@/lib/hooks';
import { workWindowSlots } from '@/lib/leave';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { cx } from '../../lib/utils';
import './LogExtraWorkModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

type WorkType = 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';

interface WorkOption {
  key: WorkType; label: string; window: string; credit: string; color: string; bg: string;
}

/**
 * Build the slot picker options from the admin's configured office hours.
 * Full day = start-end; halves split at the exact midpoint of the window.
 */
function buildOptions(workStartTime: string, workEndTime: string): WorkOption[] {
  const w = workWindowSlots(workStartTime, workEndTime);
  return [
    {
      key: 'FULL_DAY',
      label: 'Full day',
      window: w.fullDay,
      credit: '+1 day',
      color: 'var(--color-success)',
      bg: 'var(--color-success-light)',
    },
    {
      key: 'HALF_DAY_MORNING',
      label: 'Half day (morning)',
      window: w.morningHalf,
      credit: '+0.5 day',
      color: 'var(--color-leave-replacement)',
      bg: 'var(--color-leave-replacement-light)',
    },
    {
      key: 'HALF_DAY_AFTERNOON',
      label: 'Half day (afternoon)',
      window: w.afternoonHalf,
      credit: '+0.5 day',
      color: 'var(--color-leave-replacement)',
      bg: 'var(--color-leave-replacement-light)',
    },
  ];
}

export function LogExtraWorkModal({ open, onClose }: Props) {
  const submit = useSubmitExtraWork();
  const { data: holidays = [] } = useHolidays();
  const { data: settings } = useSettings();
  const options = useMemo(
    () => buildOptions(settings?.workStartTime ?? '09:00', settings?.workEndTime ?? '17:00'),
    [settings?.workStartTime, settings?.workEndTime],
  );
  const [workDate, setWorkDate] = useState('');
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // O(1) lookup for "is this a public holiday?".
  const holidayDates = useMemo(
    () => new Set(holidays.map((h) => h.date.slice(0, 10))),
    [holidays],
  );

  /** Only Bangladesh weekend days (Fri = 5, Sat = 6) or public holidays are
   *  eligible for replacement leave. Anything else is a normal workday. */
  function isEligibleWorkDate(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0 Sun .. 6 Sat
    if (dow === 5 || dow === 6) return true;
    return holidayDates.has(dateStr);
  }

  function handleDateChange(next: string) {
    if (!next) {
      setWorkDate('');
      setDateError(null);
      return;
    }
    if (!isEligibleWorkDate(next)) {
      setDateError('Only weekends (Fri/Sat) or public holidays can be logged.');
      setWorkDate('');
      return;
    }
    setDateError(null);
    setWorkDate(next);
  }

  function reset() {
    setWorkDate('');
    setWorkType(null);
    setReason('');
    setDescription('');
    setDone(false);
    setError(null);
    setDateError(null);
  }
  function handleClose() {
    onClose();
    setTimeout(reset, 300);
  }
  function handleSubmit() {
    if (!workDate || !workType || reason.trim().length < 2) return;
    setError(null);
    submit.mutate(
      { workDate, workType, reason: reason.trim(), description: description || undefined },
      {
        onSuccess: () => setDone(true),
        onError: (e: Error) => setError(e.message),
      }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={done ? 'Sent for approval' : 'Apply for replacement leave'}
      size="lg"
      footer={
        done ? (
          <Button variant="primary" onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={submit.isPending}
              disabled={!workDate || !workType || reason.trim().length < 2}
              onClick={handleSubmit}
            >
              Send for approval
            </Button>
          </>
        )
      }
    >
      {done ? (
        <motion.div
          className="lew-success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <svg viewBox="0 0 64 64" width="72" height="72">
            <circle cx="32" cy="32" r="30" fill="var(--color-success-light)" />
            <motion.path
              d="M20 33 L29 42 L45 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            />
          </svg>
          <h3>Sent for approval</h3>
          <p>
            HR (or an Admin) will review your request. Once approved, your replacement leave
            balance will update automatically.
          </p>
        </motion.div>
      ) : (
        <div className="lew">
          <p className="lew-hint">
            Approved leave here is credited to your <strong>replacement balance</strong>.
          </p>

          <Field
            label="Date you worked"
            required
            hint="Only weekends (Fri/Sat) or public holidays can be logged."
          >
            <TextInput
              type="date"
              value={workDate}
              max={today}
              onChange={(e) => handleDateChange(e.target.value)}
            />
            {dateError && <p className="lew-field-error">{dateError}</p>}
          </Field>

          <div className="lew-options">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={cx('lew-option', workType === o.key && 'lew-option-active')}
                onClick={() => setWorkType(o.key)}
                style={{ '--o-color': o.color, '--o-bg': o.bg } as React.CSSProperties}
              >
                <div className="lew-option-head">
                  <span className="lew-option-label">{o.label}</span>
                  <span className="lew-option-credit">{o.credit}</span>
                </div>
                <span className="lew-option-window">{o.window}</span>
                {workType === o.key && <span className="lew-option-check"><Check size={14} /></span>}
              </button>
            ))}
          </div>

          <Field label="Reason" required hint="Why did you come in?">
            <TextInput
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Client demo on Saturday"
            />
          </Field>

          <Field label="Description (optional)">
            <TextArea
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any extra context for HR"
              rows={3}
            />
          </Field>

          {error && <div className="lew-error">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
