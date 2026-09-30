import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, err, parseBody } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

/**
 * POST /api/daily-scrum/generate  { date: 'YYYY-MM-DD' }
 *
 * Creates a scrum entry for the given date for every currently-selected
 * employee (User.dailyScrumIncluded = true). Idempotent — employees who
 * already have an entry for that date are left untouched, so HR can safely
 * run this again after adding a mid-week joiner to the roster.
 *
 * Task carryover from the prior day's entry:
 *   • Only source tasks with type='TODAY' are considered (source COMPLETED
 *     tasks stayed on that older day).
 *   • If carryOver=true on the source, the copy lands as type='TODAY' on
 *     the new day (appears in tomorrow's Today column).
 *   • Otherwise it lands as type='COMPLETED' (appears in tomorrow's
 *     Yesterday/Completed column).
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

  // Which employees already have an entry for the target date? Those we skip.
  const existing = await prisma.dailyScrumEntry.findMany({
    where: { date: target, employeeId: { in: roster.map((r) => r.id) } },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((e) => e.employeeId));
  const toCreate = roster.filter((r) => !existingIds.has(r.id));

  // Sequential creates so we can compute per-entry task copies in one shot.
  let createdEntries = 0;
  let copiedTasks = 0;
  for (const u of toCreate) {
    const priorTasks = (priorByEmp.get(u.id) ?? []).filter((t) => t.type === 'TODAY');
    const seed = priorTasks.map((t, i) => ({
      type: t.carryOver ? ('TODAY' as const) : ('COMPLETED' as const),
      text: t.text,
      deadline: t.deadline,
      isDecision: t.isDecision,
      decisionNote: t.decisionNote,
      // The new copy shouldn't auto-cascade a second time; HR can re-enable it.
      carryOver: false,
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
    skippedEntries: existingIds.size,
    copiedTasks,
  });
}
