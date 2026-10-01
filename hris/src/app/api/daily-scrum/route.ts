import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, err } from '@/lib/api';
import { dayKeyToDateOnly } from '@/lib/workday';

export async function GET(req: Request) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date');
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam))
    return err(400, 'BAD_DATE', 'date query param must be YYYY-MM-DD.');

  const dateOnly = dayKeyToDateOnly(dateParam);
  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHrOrAdmin = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  const isLineManager = roles.includes('LINE_MANAGER');
  // canEditAll / canEditTeam are returned so the client can show/hide edit UI.
  // View access is unrestricted — everyone sees the full board. Edit permissions are enforced separately
  // per task via canEditEntry() on the client and canEditEmployee() on the server.
  const entries = await prisma.dailyScrumEntry.findMany({
    where: {
      date: dateOnly,
      // Only show entries for employees currently in the scrum roster.
      // Excluded / soft-deleted / deactivated people are hidden even if
      // their old entries are still in the DB (a cleanup action in the
      // Daily Tracker Config physically removes those rows).
      employee: { dailyScrumIncluded: true, isActive: true, deletedAt: null },
    },
    include: {
      employee: {
        select: {
          id: true, fullName: true, department: true, designation: true,
          avatarUrl: true, employeeIdCode: true,
        },
      },
      tasks: { orderBy: { order: 'asc' } },
    },
    orderBy: { employee: { employeeIdCode: { sort: 'asc', nulls: 'last' } } },
  });

  return NextResponse.json({
    date: dateParam,
    entries: entries.map(serializeEntry),
    canEditAll: isHrOrAdmin,
    canEditTeam: isHrOrAdmin || isLineManager,
  });
}

function serializeEntry(e: {
  id: string; date: Date; status: string; employeeId: string;
  createdAt: Date; updatedAt: Date;
  employee: { id: string; fullName: string; department: string | null; designation: string | null; avatarUrl: string | null; employeeIdCode: string | null };
  tasks: { id: string; entryId: string; type: string; text: string; deadline: Date | null; isDecision: boolean; decisionNote: string | null; carryOver: boolean; order: number; priority: string; status: string; createdAt: Date; updatedAt: Date }[];
}) {
  return {
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    status: e.status,
    employeeId: e.employeeId,
    employee: e.employee,
    tasks: e.tasks.map((t) => ({
      id: t.id,
      entryId: t.entryId,
      type: t.type,
      text: t.text,
      deadline: t.deadline ? t.deadline.toISOString().slice(0, 10) : null,
      isDecision: t.isDecision,
      decisionNote: t.decisionNote,
      carryOver: t.carryOver,
      order: t.order,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
