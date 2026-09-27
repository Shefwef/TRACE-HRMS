/**
 * Given a notification, produce the URL a user should be sent to when they
 * click it. Kept as a pure function so it can be tested and used in both
 * the topbar and any inline notification list we add later.
 *
 * Routing rules:
 *   • *_PENDING          → approver's queue at /admin/requests
 *   • LEAVE_*             → employee's own leave list at /leaves
 *   • EXTRA_WORK_APPROVED/REJECTED, REPLACEMENT_EARNED → /attendance
 *   • HOLIDAY_NOTICE      → /calendar
 *   • Anything else       → home (/)
 *
 * `highlight` query param lets the destination page scroll to / expand the
 * relevant row; pages that ignore it still render correctly.
 */
export interface HrefableNotification {
  type: string;
  referenceType: string | null;
  referenceId: string | null;
}

export function notificationHref(n: HrefableNotification): string {
  const ref = n.referenceId ? `highlight=${encodeURIComponent(n.referenceId)}` : '';
  const withRef = (base: string, extra: string) => {
    const parts = [extra, ref].filter(Boolean).join('&');
    return parts ? `${base}?${parts}` : base;
  };

  // Explicit override: managers get audit copies of grants they issued (or an
  // HR user gets a copy of a LM-issued grant). Route them to the admin queue
  // so the click is useful, not the employee's own list.
  if (n.referenceType === 'admin_requests') return withRef('/admin/requests', 'tab=leaves');

  switch (n.type) {
    // Approver-facing: someone submitted a leave, please review.
    case 'LEAVE_PENDING':
      return withRef('/admin/requests', 'tab=leaves');

    // Approver-facing: replacement-leave (extra work) request needs review.
    case 'EXTRA_WORK_PENDING':
      return withRef('/admin/requests', 'tab=extra');

    // Employee-facing: your leave request was decided.
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED':
      return withRef('/leaves', '');

    // Employee-facing: replacement-leave outcome shows on the Replacement tab
    // inside My Leaves (not the Attendance page anymore).
    case 'EXTRA_WORK_APPROVED':
    case 'EXTRA_WORK_REJECTED':
    case 'REPLACEMENT_EARNED':
      return withRef('/leaves/replacement', '');

    case 'HOLIDAY_NOTICE':
      return '/calendar';

    case 'ATTENDANCE_REMINDER':
      return '/attendance';

    default:
      return '/';
  }
}
