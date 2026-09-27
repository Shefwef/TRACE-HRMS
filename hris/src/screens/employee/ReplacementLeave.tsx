'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, Clock, TrendingUp, Plus, X } from 'lucide-react';
import { useBalance, useMyExtraWork, type ExtraWorkSummary } from '@/lib/hooks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LogExtraWorkModal } from '../../components/attendance/LogExtraWorkModal';
import { cx, fmtDate } from '../../lib/utils';
import { LeavesTabs } from './LeavesTabs';
import './MyLeaves.css';
import './ReplacementLeave.css';

/**
 * Employee's Replacement Leave page. Shows:
 *   * Balance headline cards (current / pending / earned this month)
 *   * Recent credit banner when the most recent approval is fresh
 *   * Full history of submitted extra-work logs, styled to match the
 *     General Leave list (grid rows, hover, status badges).
 *
 * All data comes from existing endpoints (useBalance + useMyExtraWork);
 * no new backend is required for this page.
 */
export function ReplacementLeavePage() {
  const { data: balance } = useBalance();
  const { data: extraWork = [], isLoading } = useMyExtraWork();
  const [logOpen, setLogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const current = Number(balance?.replacementBalance ?? 0);

  const pendingLogs = useMemo(() => extraWork.filter((x) => x.status === 'PENDING'), [extraWork]);
  const pendingDaysCredit = pendingLogs.reduce((s, x) => s + creditOf(x.workType), 0);

  const now = new Date();
  const monthApprovedLogs = extraWork.filter(
    (x) => x.status === 'APPROVED' && sameMonth(new Date(x.reviewedAt ?? x.workDate), now),
  );
  const earnedThisMonth = monthApprovedLogs.reduce((s, x) => s + creditOf(x.workType), 0);

  // The freshest approved log (any month), only shown as a banner if it was
  // decided in the last 7 days. Auto-hides once the user dismisses it.
  const latestApproved = extraWork
    .filter((x) => x.status === 'APPROVED' && x.reviewedAt)
    .sort((a, b) => (a.reviewedAt! < b.reviewedAt! ? 1 : -1))[0];
  const freshApproval =
    latestApproved && Date.now() - new Date(latestApproved.reviewedAt!).getTime() < 7 * 86_400_000
      ? latestApproved
      : null;

  return (
    <div className="rlp">
      <LeavesTabs />

      <header className="rlp-head">
        <div>
          <h1>Replacement Leave</h1>
          <p className="muted">Days you&apos;ve earned by working weekends or public holidays.</p>
        </div>
        <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setLogOpen(true)}>
          Apply for replacement leave
        </Button>
      </header>

      <div className="rlp-stats">
        <StatCard
          icon={<CalendarCheck size={16} />}
          label="Current balance"
          value={<>{formatDays(current)} <span className="rlp-stat-unit">day{current === 1 ? '' : 's'}</span></>}
          tone="brand"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Pending approval"
          value={<>{formatDays(pendingDaysCredit)} <span className="rlp-stat-unit">day{pendingDaysCredit === 1 ? '' : 's'}</span></>}
          tone="warning"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Earned this month"
          value={<>+{formatDays(earnedThisMonth)} <span className="rlp-stat-unit">day{earnedThisMonth === 1 ? '' : 's'}</span></>}
          tone="success"
        />
      </div>

      {freshApproval && !bannerDismissed && (
        <div className="rlp-banner">
          <div className="rlp-banner-icon"><CalendarCheck size={16} /></div>
          <div className="rlp-banner-body">
            <strong>Replacement leave credited</strong>
            <p>
              {formatDays(creditOf(freshApproval.workType))} day{creditOf(freshApproval.workType) === 1 ? '' : 's'} added to your balance for {fmtDate(freshApproval.workDate, 'd MMM yyyy')} - approved by {freshApproval.reviewer?.fullName ?? 'HR'}.
            </p>
          </div>
          <button className="rlp-banner-close" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="card myleaves-loading">Loading…</div>
      ) : extraWork.length === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState
            title="No extra work logged yet"
            body="Worked on a weekend or holiday? Apply for replacement leave and HR will convert it into a leave day."
          />
        </div>
      ) : (
        <div className="myleaves-table rlp-hist">
          <div className="myleaves-thead rlp-hist-row">
            <span>#</span>
            <span>Work date</span>
            <span>Day</span>
            <span>Slot</span>
            <span>Credit</span>
            <span>Status</span>
            <span>Reason</span>
          </div>
          <AnimatePresence initial={false}>
            {extraWork.map((x, idx) => (
              <motion.div
                key={x.id}
                className="myleaves-row rlp-hist-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                layout
              >
                <span className="myleaves-serial mono" data-label="#">{idx + 1}</span>
                <span className="mono" data-label="Work date">{fmtDate(x.workDate, 'd MMM yyyy')}</span>
                <span data-label="Day">{fmtDate(x.workDate, 'EEEE')}</span>
                <span data-label="Slot">{slotLabelOf(x.workType)}</span>
                <span className="mono" data-label="Credit">
                  {x.status === 'APPROVED'
                    ? <strong>+{formatDays(creditOf(x.workType))}</strong>
                    : <span className="muted">{x.status === 'PENDING' ? 'pending' : '-'}</span>}
                </span>
                <span data-label="Status">
                  <Badge variant={statusVariantOf(x.status)}>{x.status.toLowerCase()}</Badge>
                </span>
                <span className="rlp-hist-reason" data-label="Reason" title={x.reason}>{x.reason}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <LogExtraWorkModal open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function StatCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: 'brand' | 'warning' | 'success';
}) {
  return (
    <div className={cx('rlp-stat', `rlp-stat-${tone}`)}>
      <div className="rlp-stat-icon">{icon}</div>
      <div>
        <div className="rlp-stat-label">{label}</div>
        <div className="rlp-stat-value">{value}</div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function creditOf(workType: ExtraWorkSummary['workType']): number {
  return workType === 'FULL_DAY' ? 1 : 0.5;
}

function slotLabelOf(workType: ExtraWorkSummary['workType']): string {
  return workType === 'FULL_DAY' ? 'Full day' : workType === 'HALF_DAY_MORNING' ? 'Half - morning' : 'Half - afternoon';
}

function statusVariantOf(s: ExtraWorkSummary['status']): 'warning' | 'success' | 'danger' {
  return s === 'PENDING' ? 'warning' : s === 'APPROVED' ? 'success' : 'danger';
}

function formatDays(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
