import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

export async function POST(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHrOrAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  if (!isHrOrAdmin) return err(403, 'FORBIDDEN', 'Only HR can generate scrum weeks.');

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const { weekStart } = body as { weekStart?: unknown };
  if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart))
    return err(400, 'BAD_DATE', 'weekStart must be YYYY-MM-DD.');

  const start = dayKeyToDateOnly(weekStart);
  if (start.getUTCDay() !== 0)
    return err(400, 'BAD_DATE', 'weekStart must be a Sunday.');

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });

  let created = 0;
  for (let offset = 0; offset < 5; offset++) {
    const date = new Date(start.getTime() + offset * 86_400_000);
    for (const u of activeUsers) {
      const result = await prisma.dailyScrumEntry.upsert({
        where: { date_employeeId: { date, employeeId: u.id } },
        create: { date, employeeId: u.id },
        update: {},
        select: { createdAt: true, updatedAt: true },
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
