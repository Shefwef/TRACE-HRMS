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
    decisionNote?: unknown; order?: unknown;
  };

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
      ...(typeof patch.order === 'number' ? { order: patch.order } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id, entryId: updated.entryId, type: updated.type, text: updated.text,
    deadline: updated.deadline ? updated.deadline.toISOString().slice(0, 10) : null,
    isDecision: updated.isDecision, decisionNote: updated.decisionNote, order: updated.order,
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
