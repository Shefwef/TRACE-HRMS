import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';

/**
 * POST /api/daily-scrum/prune
 *
 * Deletes every DailyScrumEntry (and, via cascade, its tasks) belonging to
 * an employee who is no longer in the scrum roster — i.e.
 * `User.dailyScrumIncluded = false`, deactivated, or soft-deleted.
 * Use case: HR unchecks people in the Daily Tracker Config and wants to
 * clean up the old boards that still have their rows.
 *
 * HR / SUPER_ADMIN only.
 */
export async function POST(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  if (!(roles.includes('HR') || roles.includes('SUPER_ADMIN')))
    return err(403, 'FORBIDDEN', 'Only HR can prune scrum entries.');

  const result = await prisma.dailyScrumEntry.deleteMany({
    where: {
      OR: [
        { employee: { dailyScrumIncluded: false } },
        { employee: { isActive: false } },
        { employee: { deletedAt: { not: null } } },
      ],
    },
  });

  return NextResponse.json({ ok: true, removed: result.count });
}
