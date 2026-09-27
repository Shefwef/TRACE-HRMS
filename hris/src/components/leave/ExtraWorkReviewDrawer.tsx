'use client';
import { useState, useEffect, useMemo } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { useAllExtraWork, useApproveExtraWork, useRejectExtraWork, useSettings } from '@/lib/hooks';
import { initials, avatarColorFor } from '@/lib/session';
import { extraWorkTypeLabel, extraWorkCredit, workWindowSlots } from '@/lib/leave';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Field, TextArea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { fmtDate, cx } from '../../lib/utils';
import './LeaveReviewDrawer.css';

type WorkType = 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';

interface Props {
  logId: string | null;
  onClose: () => void;
}

/** Format a UTC-instant ISO timestamp as "hh:mm AM/PM" in Dhaka local time. */
function fmtDhakaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

/** Human-readable "5h 30m" from a minutes count. */
function fmtDuration(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ExtraWorkReviewDrawer({ logId, onClose }: Props) {
  const { data: allLogs } = useAllExtraWork();
  const { data: settings } = useSettings();
  const log = allLogs?.find((l) => l.id === logId);
  const approve = useApproveExtraWork();
  const reject = useRejectExtraWork();

  const windows = useMemo(
    () => workWindowSlots(settings?.workStartTime ?? '09:00', settings?.workEndTime ?? '17:00'),
    [settings?.workStartTime, settings?.workEndTime],
  );
  const slotOptions: { key: WorkType; label: string; hint: string }[] = useMemo(() => [
    { key: 'FULL_DAY',           label: `Full day (${windows.fullDay})`,           hint: '+1 day' },
    { key: 'HALF_DAY_MORNING',   label: `Half day AM (${windows.morningHalf})`,    hint: '+0.5 day' },
    { key: 'HALF_DAY_AFTERNOON', label: `Half day PM (${windows.afternoonHalf})`,  hint: '+0.5 day' },
  ], [windows]);

  const [note, setNote] = useState('');
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [slotOverride, setSlotOverride] = useState<WorkType | null>(null);

  // The biometric pipeline sets source='AUTO' when it auto-files a log.
  // Only AUTO logs get the Full/Half AM/Half PM picker; MANUAL logs keep
  // the workType the employee explicitly selected in the Apply form.
  const isAutoDetected = log?.source === 'AUTO';

  useEffect(() => {
    if (!logId) {
      setNote(''); setRejectReason(''); setShowApprove(false); setShowReject(false);
      setSlotOverride(null);
    }
  }, [logId]);

  // Seed slot picker with the currently-recorded workType so HR can just
  // click Approve if the default is already right.
  useEffect(() => {
    if (log && isAutoDetected) setSlotOverride(log.workType);
    else setSlotOverride(null);
  }, [log?.id, isAutoDetected, log]);

  if (!logId || !log || !log.employee) {
    return <Drawer open={!!logId} onClose={onClose}>{null}</Drawer>;
  }

  const effectiveWorkType: WorkType = slotOverride ?? log.workType;
  const credit = extraWorkCredit(effectiveWorkType);
  const empInitials = initials(log.employee.fullName);
  const empColor = avatarColorFor(log.employee.id);

  return (
    <>
      <Drawer
        open={!!logId}
        onClose={onClose}
        title="Replacement leave review"
        subtitle={`Submitted ${fmtDate(log.createdAt, 'd MMM yyyy · h:mm a')}`}
      >
        <div className="lrd">
          <div className="lrd-emp">
            <Avatar
              initials={empInitials}
              color={empColor}
              size="lg"
              imageUrl={log.employee.avatarUrl}
              alt={log.employee.fullName}
            />
            <div>
              <div className="lrd-emp-name">{log.employee.fullName}</div>
              <div className="lrd-emp-role">{log.employee.role} · {log.employee.department ?? ''}</div>
              <div className="lrd-emp-id mono">{log.employee.email}</div>
            </div>
          </div>

          <div className="lrd-facts">
            <div className="lrd-fact">
              <span className="lrd-fact-label">Work day</span>
              <span className="lrd-fact-value">{fmtDate(log.workDate, 'd MMM yyyy')} ({fmtDate(log.workDate, 'EEE')})</span>
            </div>
            <div className="lrd-fact">
              <span className="lrd-fact-label">Slot</span>
              <span className="lrd-fact-value">{extraWorkTypeLabel(effectiveWorkType, windows)}</span>
            </div>
            <div className="lrd-fact">
              <span className="lrd-fact-label">Reason</span>
              <span className="lrd-fact-value">{log.reason}</span>
            </div>
            {log.description && (
              <div className="lrd-fact">
                <span className="lrd-fact-label">Description</span>
                <span className="lrd-fact-value lrd-fact-multiline">{log.description}</span>
              </div>
            )}
          </div>

          {/* Clock-in/out block. Present for auto-detected requests (always)
              and for any manual request whose date has an attendance row. */}
          {log.attendance && (log.attendance.clockInTime || log.attendance.clockOutTime) && (
            <div className="lrd-card">
              <div className="lrd-card-title">
                <Clock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Attendance for this day
              </div>
              <div className="lrd-calc-rows">
                <div className="lrd-calc-row">
                  <span className="lrd-calc-name">Clock in</span>
                  <span className="lrd-calc-days mono">
                    {log.attendance.clockInTime ? fmtDhakaTime(log.attendance.clockInTime) : '-'}
                  </span>
                </div>
                <div className="lrd-calc-row">
                  <span className="lrd-calc-name">Clock out</span>
                  <span className="lrd-calc-days mono">
                    {log.attendance.clockOutTime ? fmtDhakaTime(log.attendance.clockOutTime) : '-'}
                  </span>
                </div>
                <div className="lrd-calc-row">
                  <span className="lrd-calc-name">Worked</span>
                  <span className="lrd-calc-days mono">{fmtDuration(log.attendance.totalWorkedMinutes)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Slot picker - only for auto-detected requests. Manually-filed
              logs keep the workType the employee explicitly selected. */}
          {log.status === 'PENDING' && isAutoDetected && (
            <div className="lrd-card">
              <div className="lrd-card-title">Credit as</div>
              <div className="lrd-slot-picker">
                {slotOptions.map((opt) => {
                  const on = effectiveWorkType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={cx('lrd-slot-btn', on && 'lrd-slot-btn-on')}
                      onClick={() => setSlotOverride(opt.key)}
                    >
                      <span className="lrd-slot-label">{opt.label}</span>
                      <span className="lrd-slot-hint">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="lrd-card">
            <div className="lrd-card-title">Leave calculation</div>
            <div className="lrd-calc-rows">
              <div className="lrd-calc-row">
                <span className="lrd-calc-name">
                  {effectiveWorkType === 'FULL_DAY' ? 'Full day worked' : effectiveWorkType === 'HALF_DAY_MORNING' ? 'Morning half worked' : 'Afternoon half worked'}
                </span>
                <span className="lrd-calc-days">= {credit} {credit === 1 ? 'day' : 'days'}</span>
              </div>
            </div>
            <div className="lrd-calc-total">
              <span>Credit if approved</span>
              <strong>+{credit} {credit === 1 ? 'day' : 'days'}</strong>
            </div>
          </div>

          {log.status === 'PENDING' && (
            <div className="lrd-section">
              <Field label="Add a note (optional)" hint="Visible to the employee alongside your decision.">
                <TextArea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Thanks for covering the demo!"
                  rows={3}
                />
              </Field>
            </div>
          )}

          {log.status !== 'PENDING' && (
            <div className={cx('lrd-decided', `lrd-decided-${log.status.toLowerCase()}`)}>
              <div className="lrd-decided-title">
                {log.status === 'APPROVED' && `Approved · +${credit} day credited`}
                {log.status === 'REJECTED' && 'Rejected'}
                {log.reviewedAt && ` · ${fmtDate(log.reviewedAt, 'd MMM yyyy')}`}
              </div>
              {log.adminNote && <div className="lrd-decided-note">&quot;{log.adminNote}&quot;</div>}
            </div>
          )}
        </div>

        {log.status === 'PENDING' && (
          <div className="lrd-actions">
            <Button
              variant="secondary"
              leadingIcon={<X size={16} />}
              onClick={() => setShowReject(true)}
              className="lrd-reject"
            >
              Reject
            </Button>
            <Button
              variant="success"
              leadingIcon={<Check size={16} />}
              onClick={() => setShowApprove(true)}
              fullWidth
            >
              Approve (+{credit} day)
            </Button>
          </div>
        )}
      </Drawer>

      <Modal
        open={showApprove}
        onClose={() => setShowApprove(false)}
        title="Approve this replacement leave?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowApprove(false)}>Cancel</Button>
            <Button
              variant="success"
              loading={approve.isPending}
              onClick={() => {
                approve.mutate(
                  {
                    id: log.id,
                    note: note || undefined,
                    // Only send an override when HR actually changed it - avoids
                    // clobbering a manual submission with the picker default.
                    workType: isAutoDetected ? effectiveWorkType : undefined,
                  },
                  {
                    onSuccess: () => { setShowApprove(false); onClose(); },
                  },
                );
              }}
            >
              Yes, approve
            </Button>
          </>
        }
      >
        <p>
          This will credit <strong>{credit} replacement leave day{credit === 1 ? '' : 's'}</strong> to{' '}
          <strong>{log.employee.fullName}&apos;s</strong> balance.
        </p>
      </Modal>

      <Modal
        open={showReject}
        onClose={() => setShowReject(false)}
        title="Reject this replacement leave"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={rejectReason.trim().length < 4}
              loading={reject.isPending}
              onClick={() => {
                reject.mutate({ id: log.id, note: rejectReason.trim() }, {
                  onSuccess: () => { setShowReject(false); setRejectReason(''); onClose(); },
                });
              }}
            >
              Reject log
            </Button>
          </>
        }
      >
        <Field label="Reason (required)" required hint="Shared with the employee so they understand the decision.">
          <TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Not eligible under company policy."
            autoFocus
          />
        </Field>
      </Modal>
    </>
  );
}
