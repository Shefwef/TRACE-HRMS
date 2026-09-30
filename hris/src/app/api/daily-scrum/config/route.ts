import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, err, parseBody } from '@/lib/api';

/**
 * Daily Tracker configuration — the set of employees included when HR generates
 * a scrum board for a given date. The flag lives on the User row itself
 * (`dailyScrumIncluded`) so we don't need a separate join table.
 *
 * Only HR / SUPER_ADMIN can read or change the roster.
 */
function requireHr(user: { role: string; roles: string[] }): boolean {
  const roles = user.roles.length > 0 ? user.roles : [user.role];
  return roles.includes('HR') || roles.includes('SUPER_ADMIN');
}

export async function GET(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;
  if (!requireHr(user)) return err(403, 'FORBIDDEN', 'Only HR can view scrum config.');

  const employees = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeIdCode: true,
      department: true,
      designation: true,
      avatarUrl: true,
      dailyScrumIncluded: true,
    },
    orderBy: [{ employeeIdCode: { sort: 'asc', nulls: 'last' } }, { fullName: 'asc' }],
  });

  return NextResponse.json({ employees });
}

const PutSchema = z.object({
  includedIds: z.array(z.string().min(1)),
});

export async function PUT(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;
  if (!requireHr(user)) return err(403, 'FORBIDDEN', 'Only HR can update scrum config.');

  const [body, bodyErr] = await parseBody(req, PutSchema);
  if (bodyErr) return bodyErr;

  const includedSet = new Set(body.includedIds);

  // Two updateMany calls: one to include (flag = true) the picked users and one
  // to exclude everyone else. Scoped to active, non-deleted users so soft-deleted
  // accounts stay untouched.
  const [included, excluded] = await Promise.all([
    prisma.user.updateMany({
      where: { isActive: true, deletedAt: null, id: { in: [...includedSet] } },
      data: { dailyScrumIncluded: true },
    }),
    prisma.user.updateMany({
      where: { isActive: true, deletedAt: null, id: { notIn: [...includedSet] } },
      data: { dailyScrumIncluded: false },
    }),
  ]);

  return NextResponse.json({ ok: true, included: included.count, excluded: excluded.count });
}
