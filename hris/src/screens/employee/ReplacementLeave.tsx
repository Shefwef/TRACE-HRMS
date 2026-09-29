'use client';
import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, TrendingUp, Plus, X, MessageCircle } from 'lucide-react';
import { useBalance, useMyExtraWork, type ExtraWorkSummary } from '@/lib/hooks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LogExtraWorkModal } from '../../components/attendance/LogExtraWorkModal';
import { cx, fmtDate } from '../../lib/utils';
import { LeavesTabs } from './LeavesTabs';
import './MyLeaves.css';
import './ReplacementLeave.css';

export function ReplacementLeavePage() {
  const { data: balance } = useBalance();
  const { data: extraWork = [], isLoading } = useMyExtraWork();
  const [logOpen, setLogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [detail, setDetail] = useState<ExtraWorkSummary | null>(null);

  const current = Number(balance?.replacementBalance ?? 0);
  const replacementUsed = Number(balance?.replacementUsed ?? 0);
  const replacementTotal = current + replacementUsed;

  const pendingLogs = useMemo(() => extraWork.filter((x) => x.status === 'PENDING'), [extraWork]);
  const pendingDaysCredit = pendingLogs.reduce((s, x) => s + creditOf(x.workType), 0);

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
          label="Total"
          value={<>{formatDays(replacementTotal)} <span className="rlp-stat-unit">day{replacementTotal === 1 ? '' : 's'}</span></>}
          tone="brand"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Used"
          value={<>{formatDays(replacementUsed)} <span className="rlp-stat-unit">day{replacementUsed === 1 ? '' : 's'}</span></>}
          tone="success"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Pending"
          value={<>{formatDays(pendingDaysCredit)} <span className="rlp-stat-unit">day{pendingDaysCredit === 1 ? '' : 's'}</span></>}
          tone="warning"
        />
      </div>

      {freshApproval && !bannerDismissed && (
        <div className="rlp-banner">
          <div className="rlp-banner-icon"><CalendarCheck size={16} /></div>
          <div className="rlp-banner-body">
            <strong>Replacement leave credited</strong>
            <p>
              {formatDays(creditOf(freshApproval.workType))} day{creditOf(freshApproval.workType) === 1 ? '' : 's'} added to your balance for {fmtDate(freshApproval.workDate, 'd MMM yyyy')} &mdash; approved by {freshApproval.reviewer?.fullName ?? 'HR'}.
            </p>
          </div>
          <button className="rlp-banner-close" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <section className="card rlp-history">
        <header className="rlp-history-head">
          <h2>Replacement leave history</h2>
        </header>
        {isLoading ? (
          <div className="rlp-loading">Loading&hellip;</div>
        ) : extraWork.length === 0 ? (
          <EmptyState
            title="No extra work logged yet"
            body="Worked on a weekend or holiday? Log it and HR will convert it into replacement leave."
          />
        ) : (
          <div className="rlp-table-wrap">
            <table className="rlp-table">
              <thead>
                <tr>
                  <th>Work date</th>
                  <th>Day</th>
                  <th>Slot</th>
                  <th className="rlp-num">Leave credited</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Note</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {extraWork.map((x) => (
                  <tr key={x.id}>
                    <td className="mono">{fmtDate(x.workDate, 'd MMM yyyy')}</td>
                    <td>{fmtDate(x.workDate, 'EEEE')}</td>
                    <td>{slotLabelOf(x.workType)}</td>
                    <td className="rlp-num mono">
                      {x.status === 'APPROVED' ? (
                        <strong>+{formatDays(creditOf(x.workType))}</strong>
                      ) : x.status === 'PENDING' ? (
                        <span className="muted">-</span>
                      ) : (
                        <span className="muted">&mdash;</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={statusVariantOf(x.status)}>{x.status.toLowerCase()}</Badge>
                    </td>
                    <td className="rlp-truncate" title={x.reason}>{x.reason}</td>
                    <td className="rlp-truncate rlp-note" title={x.adminNote ?? undefined}>
                      {x.adminNote ?? <span className="muted">&mdash;</span>}
                    </td>
                    <td className="rlp-details-cell">
                      <button
                        type="button"
                        className="myleaves-details-btn"
                        onClick={() => setDetail(x)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LogExtraWorkModal open={logOpen} onClose={() => setLogOpen(false)} />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${fmtDate(detail.workDate, 'd MMM yyyy')} · ${slotLabelOf(detail.workType)}` : ''}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <div className="myleaves-detail">
            <div className="myleaves-detail-row">
              <span className="myleaves-detail-label">Work date</span>
              <span>{fmtDate(detail.workDate, 'EEEE, d MMM yyyy')}</span>
            </div>
            <div className="myleaves-detail-row">
              <span className="myleaves-detail-label">Slot</span>
              <span>{slotLabelOf(detail.workType)}</span>
            </div>
            <div className="myleaves-detail-row">
              <span className="myleaves-detail-label">Reason</span>
              <span>{detail.reason}</span>
            </div>
            {detail.description && (
              <div className="myleaves-detail-row">
                <span className="myleaves-detail-label">Description</span>
                <span>{detail.description}</span>
              </div>
            )}
            <div className="myleaves-detail-row">
              <span className="myleaves-detail-label">Submitted</span>
              <span className="muted">{fmtDate(detail.createdAt, 'd MMM yyyy · h:mm a')}</span>
            </div>
            {detail.status !== 'PENDING' && (detail.reviewer || detail.reviewedAt || detail.adminNote) && (
              <div className={cx('myleaves-detail-decision', `myleaves-detail-decision-${detail.status.toLowerCase()}`)}>
                <div className="myleaves-detail-decision-head">
                  <Badge variant={statusVariantOf(detail.status)}>{detail.status.toLowerCase()}</Badge>
                  {detail.reviewer && (
                    <span className="myleaves-detail-decision-by">
                      by <strong>{detail.reviewer.fullName}</strong>
                    </span>
                  )}
                  {detail.reviewedAt && (
                    <span className="muted myleaves-detail-decision-when">
                      {fmtDate(detail.reviewedAt, 'd MMM yyyy · h:mm a')}
                    </span>
                  )}
                </div>
                {detail.adminNote && (
                  <div className="myleaves-detail-note">
                    <MessageCircle size={14} />
                    <div>
                      <strong>Note from reviewer</strong>
                      <p>{detail.adminNote}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

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

function creditOf(workType: ExtraWorkSummary['workType']): number {
  return workType === 'FULL_DAY' ? 1 : 0.5;
}

function slotLabelOf(workType: ExtraWorkSummary['workType']): string {
  return workType === 'FULL_DAY' ? 'Full day' : workType === 'HALF_DAY_MORNING' ? 'Half – morning' : 'Half – afternoon';
}

function statusVariantOf(s: ExtraWorkSummary['status']): 'warning' | 'success' | 'danger' {
  return s === 'PENDING' ? 'warning' : s === 'APPROVED' ? 'success' : 'danger';
}

function formatDays(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

