/**
 * Seeds fresh demo Daily Scrum entries for TODAY + YESTERDAY, using the
 * current roster (User.dailyScrumIncluded = true, active, not deleted).
 * Meant for a live demo when the historical PDF seed data is stale.
 *
 *   npx tsx --env-file=.env.local scripts/seed-today-scrum.ts           (dry-run)
 *   npx tsx --env-file=.env.local scripts/seed-today-scrum.ts --apply   (writes)
 *
 * Duplicate resolution: when the same fullName resolves to more than one
 * User row, prefer the row whose employeeIdCode matches the new format
 * `TRACE-\d{4}` (e.g. TRACE-0006 wins over the legacy `014`). Falls back
 * to the highest numeric ID if multiple new-format rows exist. Ensures a
 * clean demo lands tasks on the intended profile.
 *
 * Idempotency: skips a (date, employee) entry that already has any tasks.
 * Safe to re-run; will only fill empty slots. To reset, delete the
 * entries in Prisma Studio first.
 *
 * Realism: each employee gets 4-6 tasks per day drawn from a small set of
 * generic office-work templates (department-agnostic). Yesterday's entry
 * gets some DONE + some IN_PROGRESS. Today's entry gets:
 *   - COMPLETED-typed items copied from yesterday's DONE (mirrors the
 *     production carryover rule).
 *   - Fresh TODAY-typed items with mixed priorities + one occasional
 *     "Waiting on decision" so the demo can showcase the blocker UI.
 */
import { PrismaClient } from '@prisma/client';
import type { DailyTaskType, DailyTaskStatus, DailyTaskPriority } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Task templates ─────────────────────────────────────────────────

/** Generic office-work items that read naturally for any role. */
const YESTERDAY_TEMPLATES: string[] = [
  'Cleared inbox and prioritised the follow-ups',
  'Attended the weekly team sync',
  'Reviewed pending approvals in the tracker',
  'Prepared status update for the line manager',
  'Wrapped up documentation for the last sprint',
  'Followed up with vendors on outstanding items',
  'Updated the project tracker with current status',
  'Sat with the team on next quarter planning',
  'Consolidated feedback from stakeholders',
  'Closed out yesterday\'s outstanding requests',
  'Signed off on final drafts pending review',
  'Coordinated logistics for the upcoming workshop',
];

const TODAY_TEMPLATES: string[] = [
  'Wrap up the weekly report for line manager',
  'Follow up on outstanding vendor confirmations',
  'Prep material for the afternoon stakeholder call',
  'Draft next steps on the ongoing initiative',
  'Review and sign off on team deliverables',
  'Sync with counterparts on cross-team dependencies',
  'Finalise the presentation for tomorrow',
  'Complete the compliance checklist for this cycle',
  'Book meeting rooms and send calendar invites',
  'Consolidate this week\'s progress into a summary',
  'Address open action items from Monday\'s planning',
  'Review the draft that was shared over email',
];

const HIGH_PRIORITY_TEMPLATES: string[] = [
  'Finalise slides for the client review tomorrow',
  'Sign off on the audit response before EOD',
  'Push the release build to staging',
  'Approve the budget variance for the ongoing project',
];

const DECISION_TEMPLATES: Array<{ text: string; note: string }> = [
  {
    text: 'Vendor selection for the Q4 procurement',
    note: 'Waiting on final budget approval from CFO to proceed',
  },
  {
    text: 'Move ahead with the new hire recommendation',
    note: 'Awaiting CEO sign-off on the offer terms',
  },
  {
    text: 'Confirm scope of the client engagement',
    note: 'Need direction from the project sponsor on deliverable priority',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

function pickN<T>(pool: readonly T[], n: number, seed: number): T[] {
  // Deterministic pick using a simple LCG so re-runs pick the same items.
  const out: T[] = [];
  const bag = [...pool];
  let s = seed;
  while (out.length < n && bag.length > 0) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const idx = s % bag.length;
    out.push(bag[idx]);
    bag.splice(idx, 1);
  }
  return out;
}

function priorityMix(seed: number): DailyTaskPriority {
  const roll = seed % 10;
  if (roll < 2) return 'HIGH';   // 20%
  if (roll < 7) return 'MEDIUM'; // 50%
  return 'LOW';                  // 30%
}

/** Local YYYY-MM-DD (server timezone). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** UTC-midnight anchor for a YYYY-MM-DD key, matching @db.Date storage. */
function dayKeyToDateOnly(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

interface CandidateUser {
  id: string;
  fullName: string;
  employeeIdCode: string | null;
}

/**
 * Groups active-roster users by fullName and picks a canonical row for
 * each name. Preference:
 *   1. employeeIdCode matches /^TRACE-\d{4}$/  (highest number wins)
 *   2. Otherwise the row that sorts first by employeeIdCode
 */
function dedupeByName(users: CandidateUser[]): CandidateUser[] {
  const byName = new Map<string, CandidateUser[]>();
  for (const u of users) {
    const key = u.fullName.toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(u);
  }
  const out: CandidateUser[] = [];
  for (const group of byName.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    const newFormat = group.filter((u) =>
      u.employeeIdCode && /^TRACE-\d{4}$/.test(u.employeeIdCode),
    );
    if (newFormat.length > 0) {
      newFormat.sort((a, b) => {
        const numA = parseInt(a.employeeIdCode!.replace('TRACE-', ''), 10);
        const numB = parseInt(b.employeeIdCode!.replace('TRACE-', ''), 10);
        return numB - numA;
      });
      out.push(newFormat[0]);
    } else {
      group.sort((a, b) => (a.employeeIdCode ?? '').localeCompare(b.employeeIdCode ?? ''));
      out.push(group[0]);
    }
  }
  return out;
}

interface PlannedTask {
  type: DailyTaskType;
  status: DailyTaskStatus;
  text: string;
  priority: DailyTaskPriority;
  isDecision: boolean;
  decisionNote: string | null;
  order: number;
}

interface DayPlan {
  entryDate: Date;
  tasks: PlannedTask[];
}

interface EmployeePlan {
  user: CandidateUser;
  yesterday: DayPlan;
  today: DayPlan;
}

function planForEmployee(user: CandidateUser, yesterdayKey: string, todayKey: string): EmployeePlan {
  // Deterministic per-user seed so multiple runs stay stable.
  const seed = Math.abs(hash(user.id));

  // Yesterday: 4 tasks, 2 DONE + 2 IN_PROGRESS.
  const yTexts = pickN(YESTERDAY_TEMPLATES, 4, seed);
  const yTasks: PlannedTask[] = yTexts.map((text, i) => ({
    type: 'TODAY',
    status: i < 2 ? 'DONE' : 'IN_PROGRESS',
    text,
    priority: priorityMix(seed + i * 7),
    isDecision: false,
    decisionNote: null,
    order: i,
  }));

  // Today's COMPLETED (yesterday-carryover): the 2 DONE ones from yesterday.
  const carriedOver: PlannedTask[] = yTasks
    .filter((t) => t.status === 'DONE')
    .map((t, i) => ({
      type: 'COMPLETED',
      status: 'DONE',
      text: t.text,
      priority: t.priority,
      isDecision: false,
      decisionNote: null,
      order: i,
    }));

  // Today's new TODAY tasks: 4-5 items with mixed priorities.
  const todayTexts = pickN(TODAY_TEMPLATES, 4, seed + 100);
  const hasHigh = seed % 3 === 0;
  if (hasHigh) todayTexts[0] = pickN(HIGH_PRIORITY_TEMPLATES, 1, seed)[0];
  const todayTasks: PlannedTask[] = todayTexts.map((text, i) => ({
    type: 'TODAY',
    status: i === 0 && seed % 4 === 0 ? 'DONE' : 'IN_PROGRESS',
    text,
    priority: hasHigh && i === 0 ? 'HIGH' : priorityMix(seed + 300 + i * 11),
    isDecision: false,
    decisionNote: null,
    order: carriedOver.length + i,
  }));

  // Every ~3rd person gets a "Waiting on decision" task so blocker UI shows.
  if (seed % 3 === 0) {
    const d = pickN(DECISION_TEMPLATES, 1, seed + 500)[0];
    todayTasks.push({
      type: 'TODAY',
      status: 'IN_PROGRESS',
      text: d.text,
      priority: 'HIGH',
      isDecision: true,
      decisionNote: d.note,
      order: carriedOver.length + todayTasks.length,
    });
  }

  return {
    user,
    yesterday: {
      entryDate: dayKeyToDateOnly(yesterdayKey),
      tasks: yTasks,
    },
    today: {
      entryDate: dayKeyToDateOnly(todayKey),
      tasks: [...carriedOver, ...todayTasks],
    },
  };
}

/** Cheap deterministic string hash. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return h;
}

// ─── Runner ─────────────────────────────────────────────────────────

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLYING ===' : '=== DRY-RUN (add --apply to write) ===\n');

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(yesterday);
  console.log(`Yesterday: ${yesterdayKey}    Today: ${todayKey}\n`);

  // Roster: dailyScrumIncluded + active + not soft-deleted.
  const raw = await prisma.user.findMany({
    where: { dailyScrumIncluded: true, isActive: true, deletedAt: null },
    select: { id: true, fullName: true, employeeIdCode: true },
    orderBy: [{ employeeIdCode: { sort: 'asc', nulls: 'last' } }, { fullName: 'asc' }],
  });

  const roster = dedupeByName(raw);
  console.log(`Roster: ${roster.length} unique employee${roster.length === 1 ? '' : 's'} (from ${raw.length} raw rows)\n`);

  if (roster.length === 0) {
    console.log('No rostered employees. Uncheck/check people in Daily Tracker Config first.');
    return;
  }

  const plans = roster.map((u) => planForEmployee(u, yesterdayKey, todayKey));

  let entriesCreated = 0;
  let entriesSkipped = 0;
  let tasksInserted = 0;

  for (const plan of plans) {
    for (const day of [plan.yesterday, plan.today]) {
      const label = day.entryDate.toISOString().slice(0, 10);
      const existing = await prisma.dailyScrumEntry.findUnique({
        where: { date_employeeId: { date: day.entryDate, employeeId: plan.user.id } },
        include: { tasks: { select: { id: true } } },
      });

      if (existing && existing.tasks.length > 0) {
        entriesSkipped += 1;
        console.log(`  EXISTS   ${plan.user.fullName.padEnd(30)} ${label}   (${existing.tasks.length} tasks — leaving alone)`);
        continue;
      }

      const entryId = existing?.id ?? '(pending)';
      console.log(`  ${apply ? 'INSERT' : 'DRYRUN'}   ${plan.user.fullName.padEnd(30)} ${label}   +${day.tasks.length} tasks`);

      if (!apply) continue;

      const scrumEntryId = existing
        ? existing.id
        : (await prisma.dailyScrumEntry.create({
            data: { date: day.entryDate, employeeId: plan.user.id },
          })).id;

      if (!existing) entriesCreated += 1;

      await prisma.dailyTask.createMany({
        data: day.tasks.map((t) => ({
          entryId: scrumEntryId,
          type: t.type,
          status: t.status,
          text: t.text,
          priority: t.priority,
          isDecision: t.isDecision,
          decisionNote: t.decisionNote,
          carryOver: false,
          order: t.order,
        })),
      });
      tasksInserted += day.tasks.length;

      // Silence the unused-var warning without dropping the field.
      void entryId;
    }
  }

  console.log('\n─── Summary ───');
  console.log(`Roster size:      ${roster.length}`);
  console.log(`Entries created:  ${entriesCreated}`);
  console.log(`Entries skipped:  ${entriesSkipped} (already had tasks)`);
  console.log(`Tasks inserted:   ${tasksInserted}`);
  if (!apply) console.log('\nRun again with --apply to write.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
