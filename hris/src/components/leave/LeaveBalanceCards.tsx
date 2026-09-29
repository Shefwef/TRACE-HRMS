import { motion } from 'framer-motion';
import { ArcRing } from '../ui/ArcRing';
import './LeaveBalanceCards.css';

interface BalanceLike {
  casualTotal: number;
  casualUsed: number;
  casualPending: number;
  sickTotal: number;
  sickUsed: number;
  sickPending: number;
  replacementBalance: number;
  replacementUsed?: number;
}

interface Props {
  balance: BalanceLike;
}

export function LeaveBalanceCards({ balance }: Props) {
  const casualLeft = balance.casualTotal - balance.casualUsed - balance.casualPending;
  const sickLeft = balance.sickTotal - balance.sickUsed - balance.sickPending;
  const replacementUsed = balance.replacementUsed ?? 0;
  const replacementTotal = balance.replacementBalance + replacementUsed;

  const cards = [
    {
      title: 'Casual Leave',
      code: 'CL',
      value: casualLeft,
      total: balance.casualTotal,
      used: balance.casualUsed,
      pending: balance.casualPending,
      color: 'var(--color-leave-casual)',
      bg: 'var(--color-leave-casual-light)',
    },
    {
      title: 'Sick Leave',
      code: 'SL',
      value: sickLeft,
      total: balance.sickTotal,
      used: balance.sickUsed,
      pending: balance.sickPending,
      color: 'var(--color-leave-sick)',
      bg: 'var(--color-leave-sick-light)',
    },
    {
      title: 'Replacement Leave',
      code: 'RL',
      value: balance.replacementBalance,
      total: replacementTotal,
      used: replacementUsed,
      pending: 0,
      color: 'var(--color-leave-replacement)',
      bg: 'var(--color-leave-replacement-light)',
    },
  ];

  return (
    <div className="lbc">
      {cards.map((c, i) => (
        <motion.div
          key={c.code}
          className="lbc-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.05 }}
        >
          <div className="lbc-header">
            <span className="lbc-code" style={{ background: c.bg, color: c.color }}>
              {c.code}
            </span>
            <span className="lbc-title">{c.title}</span>
          </div>
          <div className="lbc-arc">
            <ArcRing
              value={Math.max(0, c.value)}
              total={Math.max(c.total, 1)}
              color={c.value < 0 ? 'var(--color-danger)' : c.color}
              centerLabel={c.value.toString()}
              centerLabelColor={c.value < 0 ? 'var(--color-danger)' : undefined}
              centerSublabel={c.value === 1 ? 'day left' : 'days left'}
              delay={i * 0.15}
              size={128}
            />
          </div>
          <dl className="lbc-meta lbc-meta-two">
            <div>
              <dt>Used</dt>
              <dd>{c.used}</dd>
            </div>
            <div>
              <dt>Current Balance</dt>
              <dd>{c.value}</dd>
            </div>
          </dl>
        </motion.div>
      ))}
    </div>
  );
}
