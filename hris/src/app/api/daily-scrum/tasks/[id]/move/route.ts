import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

async function canEditEmployee(
  user: { id: string; role: string; roles: string[] },
  employeeId: string,
): Promise<boolean> {
  const roles = user.roles.length > 0 ? user.roles : [user.role];
  if (roles.includes('HR') || roles.includes('SUPER_ADMIN')) return true;
  if (user.id === employeeId) return true;
  if (roles.includes('LINE_MANAGER')) {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { reports: { select: { id: true } } },
    });
    return (me?.reports.map((r) => r.id) ?? []).includes(employeeId);
  }
  return false;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const { id } = await params;

  const task = await prisma.dailyTask.findUnique({
    where: { id },
    include: { entry: { select: { employeeId: true, date: true } } },
  });
  if (!task) return err(404, 'NOT_FOUND', 'Task not found.');

  if (!(await canEditEmployee(user, task.entry.employeeId)))
    return err(403, 'FORBIDDEN', 'You do not have permission to move this task.');

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const { deadline: deadlineParam } = body as { deadline?: unknown };

  // Calculate next day
  const entryDate = task.entry.date;
  const nextDay = new Date(entryDate.getTime() + 86_400_000);
  const nextDayKey = nextDay.toISOString().slice(0, 10);
  const nextDateOnly = dayKeyToDateOnly(nextDayKey);

  const deadlineDate =
    typeof deadlineParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadlineParam)
      ? dayKeyToDateOnly(deadlineParam)
      : null;

  const { newEntry, newTask } = await prisma.$transaction(async (tx) => {
    const nextEntry = await tx.dailyScrumEntry.upsert({
      where: { date_employeeId: { date: nextDateOnly, employeeId: task.entry.employeeId } },
      create: { date: nextDateOnly, employeeId: task.entry.employeeId },
      update: {},
    });

    const created = await tx.dailyTask.create({
      data: {
        entryId: nextEntry.id,
        type: 'TODAY',
        text: task.text,
        deadline: deadlineDate,
        order: 0,
      },
    });

    await tx.dailyTask.delete({ where: { id: task.id } });

    return { newEntry: nextEntry, newTask: created };
  });

  return NextResponse.json({ newEntryId: newEntry.id, newTaskId: newTask.id });
}
