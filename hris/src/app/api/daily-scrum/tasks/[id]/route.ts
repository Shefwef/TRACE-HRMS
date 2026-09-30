import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';
import type { DailyTaskPriority, DailyTaskStatus } from '@prisma/client';

const PRIORITIES: readonly DailyTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
const STATUSES: readonly DailyTaskStatus[] = ['IN_PROGRESS', 'DONE'];

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const { id } = await params;

  const task = await prisma.dailyTask.findUnique({
    where: { id },
    include: { entry: { select: { employeeId: true } } },
  });
  if (!task) return err(404, 'NOT_FOUND', 'Task not found.');

  if (!(await canEditEmployee(user, task.entry.employeeId)))
    return err(403, 'FORBIDDEN', 'You do not have permission to edit this task.');

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const patch = body as {
    text?: unknown; deadline?: unknown; isDecision?: unknown;
    decisionNote?: unknown; order?: unknown; carryOver?: unknown;
    priority?: unknown; status?: unknown;
  };
  if (patch.priority !== undefined && !PRIORITIES.includes(patch.priority as DailyTaskPriority))
    return err(400, 'BAD_PRIORITY', 'priority must be LOW | MEDIUM | HIGH.');
  if (patch.status !== undefined && !STATUSES.includes(patch.status as DailyTaskStatus))
    return err(400, 'BAD_STATUS', 'status must be IN_PROGRESS | DONE.');

  const updated = await prisma.dailyTask.update({
    where: { id },
    data: {
      ...(typeof patch.text === 'string' && patch.text.trim() ? { text: patch.text.trim() } : {}),
      ...(patch.deadline === null
        ? { deadline: null }
        : typeof patch.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.deadline)
          ? { deadline: dayKeyToDateOnly(patch.deadline) }
          : {}),
      ...(typeof patch.isDecision === 'boolean' ? { isDecision: patch.isDecision } : {}),
      ...(patch.decisionNote === null
        ? { decisionNote: null }
        : typeof patch.decisionNote === 'string'
          ? { decisionNote: patch.decisionNote }
          : {}),
      ...(typeof patch.carryOver === 'boolean' ? { carryOver: patch.carryOver } : {}),
      ...(typeof patch.order === 'number' ? { order: patch.order } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority as DailyTaskPriority } : {}),
      ...(patch.status !== undefined ? { status: patch.status as DailyTaskStatus } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id, entryId: updated.entryId, type: updated.type, text: updated.text,
    deadline: updated.deadline ? updated.deadline.toISOString().slice(0, 10) : null,
    isDecision: updated.isDecision, decisionNote: updated.decisionNote,
    carryOver: updated.carryOver, order: updated.order,
    priority: updated.priority, status: updated.status,
    createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const { id } = await params;

  const task = await prisma.dailyTask.findUnique({
    where: { id },
    include: { entry: { select: { employeeId: true } } },
  });
  if (!task) return err(404, 'NOT_FOUND', 'Task not found.');

  if (!(await canEditEmployee(user, task.entry.employeeId)))
    return err(403, 'FORBIDDEN', 'You do not have permission to delete this task.');

  await prisma.dailyTask.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
