'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '../../lib/utils';
import './LeavesTabs.css';

/**
 * Top tabs shared by /leaves and /leaves/replacement. Active tab is derived
 * from the current pathname so each URL stays deep-linkable - no client state.
 */
export function LeavesTabs() {
  const pathname = usePathname() ?? '';
  const active: 'general' | 'replacement' = pathname.startsWith('/leaves/replacement')
    ? 'replacement'
    : 'general';
  return (
    <div className="lvtabs" role="tablist">
      <Link
        href="/leaves"
        role="tab"
        aria-selected={active === 'general'}
        className={cx('lvtabs-tab', active === 'general' && 'lvtabs-tab-active')}
      >
        General Leave
      </Link>
      <Link
        href="/leaves/replacement"
        role="tab"
        aria-selected={active === 'replacement'}
        className={cx('lvtabs-tab', active === 'replacement' && 'lvtabs-tab-active')}
      >
        Replacement Leave
      </Link>
    </div>
  );
}
