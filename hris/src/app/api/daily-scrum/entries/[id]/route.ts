import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import type { DailyScrumStatus } from '@prisma/client';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const { id } = await params;

  const entry = await prisma.dailyScrumEntry.findUnique({ where: { id } });
  if (!entry) return err(404, 'NOT_FOUND', 'Entry not found.');

  if (!(await canEditEmployee(user, entry.employeeId)))
    return err(403, 'FORBIDDEN', 'You do not have permission to edit this entry.');

  let body: unknown;
  try { body = await req.json(); } catch { return err(400, 'BAD_JSON', 'Invalid JSON body.'); }

  const { status } = body as { status?: unknown };
  const validStatuses: DailyScrumStatus[] = ['ON_TRACK', 'ATTENTION_NEEDED', 'BLOCKED'];
  if (typeof status !== 'string' || !validStatuses.includes(status as DailyScrumStatus))
    return err(400, 'BAD_STATUS', 'status must be ON_TRACK, ATTENTION_NEEDED, or BLOCKED.');

  const updated = await prisma.dailyScrumEntry.update({
    where: { id },
    data: { status: status as DailyScrumStatus },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
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
