import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

export async function POST(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const { date, employeeId: rawEmployeeId } = body as { date?: unknown; employeeId?: unknown };
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return err(400, 'BAD_DATE', 'date must be YYYY-MM-DD.');

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHrOrAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  const isLineManager = roles.includes('LINE_MANAGER');

  const targetId = typeof rawEmployeeId === 'string' ? rawEmployeeId : user.id;

  if (targetId !== user.id) {
    if (isHrOrAdmin) {
      // allowed
    } else if (isLineManager) {
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { reports: { select: { id: true } } },
      });
      const teamIds = me?.reports.map((r) => r.id) ?? [];
      if (!teamIds.includes(targetId))
        return err(403, 'FORBIDDEN', 'You can only create entries for your team members.');
    } else {
      return err(403, 'FORBIDDEN', 'You can only create your own entry.');
    }
  }

  const dateOnly = dayKeyToDateOnly(date);
  const entry = await prisma.dailyScrumEntry.upsert({
    where: { date_employeeId: { date: dateOnly, employeeId: targetId } },
    create: { date: dateOnly, employeeId: targetId },
    update: {},
    include: {
      employee: {
        select: {
          id: true, fullName: true, department: true, designation: true,
          avatarUrl: true, employeeIdCode: true,
        },
      },
      tasks: { orderBy: { order: 'asc' } },
    },
  });

  return NextResponse.json({
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    status: entry.status,
    employeeId: entry.employeeId,
    employee: entry.employee,
    tasks: entry.tasks.map((t) => ({
      id: t.id, entryId: t.entryId, type: t.type, text: t.text,
      deadline: t.deadline ? t.deadline.toISOString().slice(0, 10) : null,
      isDecision: t.isDecision, decisionNote: t.decisionNote, order: t.order,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    })),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }, { status: 201 });
}
