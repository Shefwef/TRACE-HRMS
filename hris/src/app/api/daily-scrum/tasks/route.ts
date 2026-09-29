import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';
import type { DailyTaskType } from '@prisma/client';

export async function POST(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const { entryId, type, text, deadline, order } = body as {
    entryId?: unknown; type?: unknown; text?: unknown; deadline?: unknown; order?: unknown;
  };

  if (typeof entryId !== 'string') return err(400, 'BAD_REQUEST', 'entryId is required.');
  if (type !== 'TODAY' && type !== 'COMPLETED') return err(400, 'BAD_TYPE', 'type must be TODAY or COMPLETED.');
  if (typeof text !== 'string' || !text.trim()) return err(400, 'BAD_TEXT', 'text is required.');

  const entry = await prisma.dailyScrumEntry.findUnique({ where: { id: entryId } });
  if (!entry) return err(404, 'NOT_FOUND', 'Entry not found.');

  if (!(await canEditEmployee(user, entry.employeeId)))
    return err(403, 'FORBIDDEN', 'You do not have permission to edit this entry.');

  const deadlineDate =
    typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)
      ? dayKeyToDateOnly(deadline)
      : null;

  const task = await prisma.dailyTask.create({
    data: {
      entryId,
      type: type as DailyTaskType,
      text: text.trim(),
      deadline: deadlineDate,
      order: typeof order === 'number' ? order : 0,
    },
  });

  return NextResponse.json({
    id: task.id, entryId: task.entryId, type: task.type, text: task.text,
    deadline: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
    isDecision: task.isDecision, decisionNote: task.decisionNote, order: task.order,
    createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
  }, { status: 201 });
}

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
