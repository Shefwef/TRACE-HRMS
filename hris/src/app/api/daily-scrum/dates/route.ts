import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/api';

export async function GET(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHrOrAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  const isLineManager = roles.includes('LINE_MANAGER');

  let employeeIdFilter: string[] | undefined;
  if (!isHrOrAdmin) {
    if (isLineManager) {
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { reports: { select: { id: true } } },
      });
      employeeIdFilter = [user.id, ...(me?.reports.map((r) => r.id) ?? [])];
    } else {
      employeeIdFilter = [user.id];
    }
  }

  const entries = await prisma.dailyScrumEntry.findMany({
    where: employeeIdFilter ? { employeeId: { in: employeeIdFilter } } : {},
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  const dates = entries.map((e) => e.date.toISOString().slice(0, 10));
  return NextResponse.json({ dates });
}
