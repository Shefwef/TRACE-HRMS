/**
 * Business rules for leave duration and balance math.
 */
import type { CreateLeaveInput } from './validation';

/**
 * Compute the leave duration (in days) for a request. Weekends (Sat/Sun) are
 * excluded from multi-day ranges.
 *
 * - Full-day range: number of weekdays inclusive.
 * - Half-day (single day): 0.5.
 * - Time-range (single day, timeFrom-timeTo): fraction of an 8-hour day.
 */
export function computeDurationDays(input: CreateLeaveInput): number {
  const start = new Date(input.startDate + 'T00:00:00Z');
  const end = new Date(input.endDate + 'T00:00:00Z');

  if (input.isHalfDay) return 0.5;

  if (input.timeFrom && input.timeTo) {
    const [fh, fm] = input.timeFrom.split(':').map(Number);
    const [th, tm] = input.timeTo.split(':').map(Number);
    const minutes = (th * 60 + tm) - (fh * 60 + fm);
    if (minutes <= 0) return 0;
    // Standard 8-hour workday = 480 minutes. Round to 0.5 for readability.
    const days = minutes / 480;
    return Math.round(days * 2) / 2;
  }

  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay(); // 0 = Sun, 6 = Sat
    // Bangladesh work week is Sun-Thu; weekends are Fri (5) and Sat (6).
    if (dow !== 5 && dow !== 6) days += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

/**
 * Compute the total duration in days from an approver's allocation.
 * Each entry: FULL = 1, HALF_MORNING = 0.5, HALF_AFTERNOON = 0.5.
 */
export type AllocationSlot = 'FULL' | 'HALF_MORNING' | 'HALF_AFTERNOON';
export interface AllocationEntry {
  date: string; // YYYY-MM-DD
  slot: AllocationSlot;
}
export function slotDays(slot: AllocationSlot): number {
  return slot === 'FULL' ? 1 : 0.5;
}
export function computeDurationFromAllocation(entries: AllocationEntry[]): number {
  return entries.reduce((sum, e) => sum + slotDays(e.slot), 0);
}
export function slotLabel(slot: AllocationSlot): string {
  return slot === 'FULL'
    ? 'Full'
    : slot === 'HALF_MORNING'
    ? 'Morning half'
    : 'Afternoon half';
}
export function slotShort(slot: AllocationSlot): string {
  return slot === 'FULL' ? 'Full' : slot === 'HALF_MORNING' ? '½ AM' : '½ PM';
}

/** Given the fields on a leave request, produce a default per-day allocation. */
export function defaultAllocationFor(input: {
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDaySlot?: 'MORNING' | 'AFTERNOON' | null;
  timeFrom?: string | null;
  timeTo?: string | null;
}): AllocationEntry[] {
  const start = new Date(input.startDate + 'T00:00:00Z');
  const end = new Date(input.endDate + 'T00:00:00Z');
  const entries: AllocationEntry[] = [];

  // Time-range partial (single-day, treated as half day toward the closer slot)
  if (input.timeFrom && input.timeTo && input.startDate === input.endDate) {
    const [fh] = input.timeFrom.split(':').map(Number);
    const slot: AllocationSlot = fh < 12 ? 'HALF_MORNING' : 'HALF_AFTERNOON';
    entries.push({ date: input.startDate, slot });
    return entries;
  }

  if (input.isHalfDay) {
    const slot: AllocationSlot =
      input.halfDaySlot === 'AFTERNOON' ? 'HALF_AFTERNOON' : 'HALF_MORNING';
    entries.push({ date: input.startDate, slot });
    return entries;
  }

  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      entries.push({ date: cur.toISOString().slice(0, 10), slot: 'FULL' });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return entries;
}

export function extraWorkCredit(
  workType: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON'
): number {
  return workType === 'FULL_DAY' ? 1 : 0.5;
}

export function leaveTypeLabel(t: 'CASUAL' | 'SICK' | 'REPLACEMENT'): string {
  return t === 'CASUAL' ? 'Casual Leave' : t === 'SICK' ? 'Sick Leave' : 'Replacement Leave';
}

/**
 * Format an "HH:mm" wall-clock string as "h:mm AM" / "h AM" for display.
 * Drops the ":00" so "09:00" reads "9 AM" and "13:30" reads "1:30 PM".
 */
export function formatWorkTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Derive the Full / Half-morning / Half-afternoon windows from the admin's
 * configured workStartTime and workEndTime. The half-day split is the exact
 * midpoint of the window - so a 8:30-17:30 window splits at 13:00 and a
 * 9:00-18:00 window splits at 13:30.
 */
export interface WorkWindowSlots {
  fullDay: string;      // e.g. "9 AM - 5 PM"
  morningHalf: string;  // e.g. "9 AM - 1 PM"
  afternoonHalf: string;// e.g. "1 PM - 5 PM"
  /** Midpoint as "HH:mm" - exposed so callers can render it in text if needed. */
  midpoint: string;
}
export function workWindowSlots(workStartTime: string, workEndTime: string): WorkWindowSlots {
  const [sh = 9, sm = 0] = workStartTime.split(':').map(Number);
  const [eh = 17, em = 0] = workEndTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const midMin   = Math.round((startMin + endMin) / 2);
  const midH = Math.floor(midMin / 60) % 24;
  const midM = midMin % 60;
  const midStr = `${String(midH).padStart(2, '0')}:${String(midM).padStart(2, '0')}`;
  return {
    fullDay:       `${formatWorkTime(workStartTime)} - ${formatWorkTime(workEndTime)}`,
    morningHalf:   `${formatWorkTime(workStartTime)} - ${formatWorkTime(midStr)}`,
    afternoonHalf: `${formatWorkTime(midStr)} - ${formatWorkTime(workEndTime)}`,
    midpoint:      midStr,
  };
}

/**
 * Human-readable label for an extra-work slot. When `windows` is provided
 * (e.g. from SystemSettings.workStartTime/workEndTime) the label reflects
 * the configured office hours; otherwise it falls back to a fixed 9-5
 * default so pre-existing emails / server code still render sensibly.
 */
export function extraWorkTypeLabel(
  t: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON',
  windows?: WorkWindowSlots,
): string {
  const w = windows ?? workWindowSlots('09:00', '17:00');
  if (t === 'FULL_DAY') return `Full day (${w.fullDay})`;
  if (t === 'HALF_DAY_MORNING') return `Half day, morning (${w.morningHalf})`;
  return `Half day, afternoon (${w.afternoonHalf})`;
}

/** Format a leave period for humans. */
export function formatLeavePeriod(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
  halfDaySlot: 'MORNING' | 'AFTERNOON' | null | undefined,
  timeFrom: string | null | undefined,
  timeTo: string | null | undefined
): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  if (timeFrom && timeTo) return `${fmt(startDate)} · ${timeFrom}-${timeTo}`;
  if (isHalfDay) return `${fmt(startDate)} · ${halfDaySlot === 'MORNING' ? 'morning' : 'afternoon'} half`;
  if (startDate === endDate) return fmt(startDate);
  return `${fmt(startDate)} - ${fmt(endDate)}`;
}
