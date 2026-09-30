/**
 * Auto-generate the next day's Daily Scrum board.
 *
 * Runs at 00:00 Dhaka (18:00 UTC) every day. If tomorrow (the day that just
 * started at Dhaka midnight) is a workday — Sun-Thu AND not a Holiday — this
 * mirrors the manual "Generate" button in Daily Tracker Config:
 *
 *   * Creates an empty DailyScrumEntry for every dailyScrumIncluded employee
 *     (idempotent: skips employees who already have an entry for the date).
 *   * Copies forward the DONE tasks from the prior day's TODAY column as
 *     COMPLETED items on the new day (the same carryover rule the manual
 *     Generate endpoint uses).
 *
 * If tomorrow is Fri/Sat (BD weekend) or a Holiday, the run no-ops so the
 * team isn't handed a scrum for a day nobody works. Vercel invokes the route
 * with Authorization: Bearer <CRON_SECRET>.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { localDayKey, dayKeyToDateOnly } from '@/lib/workday';

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = localDayKey();
  const target = nextDayKey(today);
  const targetDate = dayKeyToDateOnly(target);

  // Bangladesh weekend: Fri (5), Sat (6). Skip both.
  const dow = targetDate.getUTCDay();
  if (dow === 5 || dow === 6) {
    return NextResponse.json({
      ok: true, target, skipped: 'weekend', dow,
    });
  }

  // Holiday check — Holiday.date is @db.Date so we compare against the
  // UTC-midnight anchor produced by dayKeyToDateOnly().
  const holiday = await prisma.holiday.findFirst({
    where: { date: targetDate },
    select: { id: true, name: true },
  });
  if (holiday) {
    return NextResponse.json({
      ok: true, target, skipped: 'holiday', holiday: holiday.name,
    });
  }

  // Roster + prior day's entries (mirrors /api/daily-scrum/generate).
  const priorDate = dayKeyToDateOnly(today);
  const [roster, priorEntries] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null, dailyScrumIncluded: true },
      select: { id: true },
    }),
    prisma.dailyScrumEntry.findMany({
      where: { date: priorDate },
      select: { employeeId: true, tasks: true },
    }),
  ]);

  if (roster.length === 0) {
    return NextResponse.json({
      ok: true, target, skipped: 'empty_roster',
    });
  }

  const priorByEmp = new Map(priorEntries.map((e) => [e.employeeId, e.tasks]));

  const existing = await prisma.dailyScrumEntry.findMany({
    where: { date: targetDate, employeeId: { in: roster.map((r) => r.id) } },
    select: { employeeId: true },
  });
  const existingIds = new Set(existing.map((e) => e.employeeId));
  const toCreate = roster.filter((r) => !existingIds.has(r.id));

  let createdEntries = 0;
  let copiedTasks = 0;
  for (const u of toCreate) {
    const priorDone = (priorByEmp.get(u.id) ?? [])
      .filter((t) => t.type === 'TODAY' && t.status === 'DONE');
    const seed = priorDone.map((t, i) => ({
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
        date: targetDate,
        employeeId: u.id,
        tasks: seed.length > 0 ? { create: seed } : undefined,
      },
    });
    createdEntries += 1;
    copiedTasks += seed.length;
  }

  return NextResponse.json({
    ok: true,
    target,
    dow,
    rosterSize: roster.length,
    createdEntries,
    skippedExisting: existingIds.size,
    copiedTasks,
  });
}
