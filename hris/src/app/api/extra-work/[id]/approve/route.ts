import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, canApproveRequest, err, parseBody } from '@/lib/api';
import { checkPermission } from '@/lib/permissions';
import { ApproveLeaveSchema } from '@/lib/validation';
import { extraWorkCredit, extraWorkTypeLabel, workWindowSlots } from '@/lib/leave';
import { notifyIfPermitted } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { extraWorkDecisionEmail } from '@/emails/templates';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const hasPerm = await checkPermission(user, 'extra_work.approve');
  if (!hasPerm) return err(403, 'FORBIDDEN', 'You do not have permission to approve extra work.');

  const { id } = await ctx.params;
  const [input, badReq] = await parseBody(req, ApproveLeaveSchema);
  if (badReq) return badReq;

  const log = await prisma.extraWorkLog.findUnique({ where: { id } });
  if (!log) return err(404, 'NOT_FOUND', 'Extra work log not found.');
  if (log.status !== 'PENDING')
    return err(409, 'ALREADY_DECIDED', `Log is already ${log.status.toLowerCase()}.`);

  // Self-approval guard
  if (user.id === log.employeeId)
    return err(403, 'SELF_APPROVE', 'You cannot approve your own extra work log.');

  // Hierarchical authorization check
  const applicant = await prisma.user.findUnique({ where: { id: log.employeeId } });
  if (!applicant) return err(500, 'APPLICANT_MISSING', 'Applicant user not found.');
  const hierarchyError = canApproveRequest(user, applicant);
  if (hierarchyError) return err(403, 'HIERARCHY_VIOLATION', hierarchyError);

  // HR can override the workType at approval time - used on auto-detected
  // requests where the slot was picked by the system and the reviewer wants
  // Full vs Half based on the actual clock-in/out. Falls back to whatever
  // was stored on submission.
  const finalWorkType = input.workType ?? log.workType;
  const credit = extraWorkCredit(finalWorkType);
  const year = new Date().getFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.extraWorkLog.update({
      where: { id },
      data: {
        status: 'APPROVED',
        workType: finalWorkType,
        adminNote: input.note,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    await tx.leaveBalance.upsert({
      where: {
        employeeId_cycleYear: { employeeId: log.employeeId, cycleYear: year },
      },
      create: {
        employeeId: log.employeeId,
        cycleYear: year,
        cycleStartDate: new Date(year, 0, 1),
        cycleEndDate: new Date(year, 11, 31),
        replacementBalance: credit,
      },
      update: { replacementBalance: { increment: credit } },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'EXTRA_WORK_APPROVED',
        targetType: 'extra_work_log',
        targetId: id,
        metadata: {
          credit,
          note: input.note ?? null,
          originalWorkType: log.workType,
          finalWorkType,
          workTypeOverridden: finalWorkType !== log.workType,
        },
      },
    });
  });

  const employee = await prisma.user.findUnique({ where: { id: log.employeeId } });
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  await notifyIfPermitted(applicant, 'notifications.leave_decision', {
    type: 'EXTRA_WORK_APPROVED',
    title: 'Your replacement leave was approved',
    body: `${user.fullName} approved your request. You've earned ${credit} replacement leave day${credit === 1 ? '' : 's'}.`,
    referenceType: 'extra_work_log',
    referenceId: id,
  });

  if (employee) {
    const historyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/attendance`;
    const windows = workWindowSlots(settings.workStartTime, settings.workEndTime);
    const { subject, html } = extraWorkDecisionEmail(
      {
        employeeName: employee.fullName,
        workDate: log.workDate.toISOString().slice(0, 10),
        workType: extraWorkTypeLabel(finalWorkType, windows),
        decision: 'APPROVED',
        reviewerName: user.fullName,
        note: input.note,
        creditDays: credit,
        historyUrl,
      },
      { senderName: settings.senderName }
    );
    void sendEmail({
      to: [employee.email],
      subject,
      html,
      referenceType: 'extra_work_log',
      referenceId: id,
    });
  }

  return NextResponse.json({ ok: true });
}
