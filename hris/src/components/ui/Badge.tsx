import type { ReactNode } from 'react';
import { cx } from '../../lib/utils';
import './Badge.css';

type Variant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'casual'
  | 'sick'
  | 'replacement'
  | 'holiday';

interface Props {
  children: ReactNode;
  variant?: Variant;
  soft?: boolean;
  className?: string;
  leadingIcon?: ReactNode;
  title?: string;
}

export function Badge({ children, variant = 'default', soft = true, className, leadingIcon, title }: Props) {
  return (
    <span
      title={title}
      className={cx(
        'badge',
        `badge-${variant}`,
        soft ? 'badge-soft' : 'badge-solid',
        className
      )}
    >
      {leadingIcon && <span className="badge-icon">{leadingIcon}</span>}
      {children}
    </span>
  );
}
