import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, err, parseBody } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

/**
 * POST /api/daily-scrum/generate  { date: 'YYYY-MM-DD' }
 *
 * Reconciles the target day's scrum entries against the current roster
 * (User.dailyScrumIncluded = true). Regeneration semantics — a re-run
 * on the same date is the way HR pushes the latest roster to that day:
 *
 *   * ADD    — creates an empty scrum entry for every rostered employee
 *              who doesn't yet have one, seeded with the prior day's
 *              DONE-tasks as COMPLETED items (see carryover rule below).
 *   * KEEP   — employees already on the board with an entry are left
 *              untouched, so tasks they've written are never lost.
 *   * PRUNE  — employees whose entries exist for the target date but
 *              are NOT in the current roster get their entry (and
 *              cascade its tasks) deleted. This lets a fresh generation
 *              replace old rows for people HR unchecked in Config.
 *
 * Task carryover on new entries: only prior-day TODAY tasks with
 * status = DONE propagate, and they land as type = COMPLETED so they
 * live in tomorrow's Yesterday/Completed column. In-progress work is
 * dropped; the owner can pull anything relevant forward by hand.
 *
 * Only HR / SUPER_ADMIN.
 */
const BodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD.'),
});

export async function POST(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHr = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  if (!isHr) return err(403, 'FORBIDDEN', 'Only HR can generate scrum boards.');

  const [body, bodyErr] = await parseBody(req, BodySchema);
  if (bodyErr) return bodyErr;

  const target = dayKeyToDateOnly(body.date);
  const prior = new Date(target.getTime() - 86_400_000);

  // Roster + prior day's entries in one round trip.
  const [roster, priorEntries] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null, dailyScrumIncluded: true },
      select: { id: true },
    }),
    prisma.dailyScrumEntry.findMany({
      where: { date: prior },
      select: { employeeId: true, tasks: true },
    }),
  ]);

  if (roster.length === 0) {
    return err(400, 'EMPTY_ROSTER', 'No employees are included in the scrum roster. Update the Daily Tracker Config first.');
  }

  const priorByEmp = new Map(priorEntries.map((e) => [e.employeeId, e.tasks]));

  // Everything currently on the board for the target date, regardless of
  // whether the employee is still rostered. `keptIds` = intersection with
  // roster (we don't touch these); `pruneIds` = the difference (deleted
  // below, cascade removes their tasks).
  const allExisting = await prisma.dailyScrumEntry.findMany({
    where: { date: target },
    select: { id: true, employeeId: true },
  });
  const rosterIdSet = new Set(roster.map((r) => r.id));
  const keptIds  = new Set(allExisting.filter((e) => rosterIdSet.has(e.employeeId)).map((e) => e.employeeId));
  const pruneRows = allExisting.filter((e) => !rosterIdSet.has(e.employeeId));
  const toCreate = roster.filter((r) => !keptIds.has(r.id));

  let prunedEntries = 0;
  if (pruneRows.length > 0) {
    const res = await prisma.dailyScrumEntry.deleteMany({
      where: { id: { in: pruneRows.map((r) => r.id) } },
    });
    prunedEntries = res.count;
  }

  // Sequential creates so we can compute per-entry task copies in one shot.
  //
  // Carryover rule: only DONE tasks from the prior day's TODAY column propagate
  // — they land in the new day's Yesterday/Completed column as a record of
  // what was accomplished. IN_PROGRESS work is dropped; if it's still relevant
  // the owner can pull it forward manually. This is per product decision so
  // stale tasks don't linger and clog every board.
  let createdEntries = 0;
  let copiedTasks = 0;
  for (const u of toCreate) {
    const priorTasks = (priorByEmp.get(u.id) ?? [])
      .filter((t) => t.type === 'TODAY' && t.status === 'DONE');
    const seed = priorTasks.map((t, i) => ({
      type: 'COMPLETED' as const,
      text: t.text,
      deadline: t.deadline,
      isDecision: false,
      decisionNote: null,
      carryOver: false,
      priority: t.priority,
      status: 'DONE' as const,
      order: i,
    }));

    await prisma.dailyScrumEntry.create({
      data: {
        date: target,
        employeeId: u.id,
        tasks: seed.length > 0 ? { create: seed } : undefined,
      },
    });
    createdEntries += 1;
    copiedTasks += seed.length;
  }

  return NextResponse.json({
    ok: true,
    createdEntries,
    skippedEntries: keptIds.size,
    prunedEntries,
    copiedTasks,
  });
}
