import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/db';
import { requireAuth, err, type ApiUser } from '@/lib/api';
import { checkPermission } from '@/lib/permissions';
import { resolveVisibleEmployeeIds } from '@/lib/workLocation';
import { AttendanceReport, type AttendanceRecord } from '@/lib/reports/AttendanceReport';
import { LeavesReport, type LeaveRecord } from '@/lib/reports/LeavesReport';
import { SummaryReport } from '@/lib/reports/SummaryReport';
import { AllEmployeesReport, type EmployeeRow } from '@/lib/reports/AllEmployeesReport';
import { AttendanceSummaryReport, type AttSummaryPdfEmployee } from '@/lib/reports/AttendanceSummaryReport';
import { EmployeeSummaryReport } from '@/lib/reports/EmployeeSummaryReport';
import { PerformanceLeaveSummaryReport } from '@/lib/reports/PerformanceLeaveSummaryReport';
import {
  getAttendanceReportData, getCompanyReportData, getLeaveReportData,
  getOffsiteRows, getSummaryReportData, monthPeriod, yearPeriod,
  getAttendanceSummaryRows, getEmployeeDirectoryRows, getPerformanceLeaveSummaryData,
  type Period,
} from '@/lib/reports/data';
import {
  buildAttendanceWorkbook, buildCompanyWorkbook, buildLeavesWorkbook,
  buildOffsiteWorkbook, buildSummaryWorkbook,
  buildAttendanceSummaryWorkbook, buildEmployeeSummaryWorkbook, buildPerformanceLeaveSummaryWorkbook,
} from '@/lib/reports/builders';
import { xlsxResponse } from '@/lib/reports/workbook';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Reads the Trace logo from the public folder and returns a base64 data URL
 * that @react-pdf/renderer can embed inline. Cached at module scope.
 */
let cachedLogo: string | null = null;
async function getLogoDataUrl(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  try {
    const buf = await readFile(path.join(process.cwd(), 'public', 'Trace Consulting Logo Dark.png'));
    cachedLogo = `data:image/png;base64,${buf.toString('base64')}`;
    return cachedLogo;
  } catch {
    return '';
  }
}

function fmtGeneratedAt(): string {
  return new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function pdfResponse(buf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

/**
 * Builds a Period from explicit startDate/endDate query params when present,
 * falling back to monthPeriod(year, month). Lets the front-end pass a custom
 * date range without the API needing to know which month to clamp to.
 */
function resolvePeriod(url: URL, year: number, month: number): Period {
  const s = url.searchParams.get('startDate');
  const e = url.searchParams.get('endDate');
  if (s && e && /^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(e) && s <= e) {
    const from = new Date(s + 'T00:00:00Z');
    const to = new Date(new Date(e + 'T00:00:00Z').getTime() + 86_400_000);
    return { year, month: null, from, to, label: `${s} to ${e}`, fileRange: `${s}-to-${e}` };
  }
  return monthPeriod(year, month);
}

/**
 * GET /api/reports/attendance?year=YYYY&month=MM
 * GET /api/reports/leaves?year=YYYY
 * GET /api/reports/summary?year=YYYY&month=MM
 * GET /api/reports/all-employees?year=YYYY&month=MM   (reports.company)
 * GET /api/reports/offsite?year=YYYY&month=MM         (work_location.view_all/_team)
 *
 * `?format=xlsx` (the default) returns a formatted workbook; `?format=pdf`
 * returns the print-ready PDF. Excel leads because these reports get filtered,
 * pivoted and pasted into payroll sheets - a PDF is the exception, not the norm.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  const [user, error] = await requireAuth(req);
  if (error) return error;

  const { type } = await ctx.params;
  const url = new URL(req.url);
  const now = new Date();
  const year = Number(url.searchParams.get('year') ?? now.getFullYear());
  const month = Number(url.searchParams.get('month') ?? now.getMonth() + 1);
  const formatParam = url.searchParams.get('format');
  const format = formatParam === 'pdf' ? 'pdf' : formatParam === 'preview' ? 'preview' : 'xlsx';
  const employeeId = url.searchParams.get('employeeId');

  if (!Number.isFinite(year) || year < 2000 || year > 2100)
    return err(400, 'BAD_YEAR', 'Invalid year.');
  const usesMonth = type === 'attendance' || type === 'summary'
    || type === 'all-employees' || type === 'offsite'
    || type === 'attendance-summary' || type === 'performance-leave-summary';
  if (usesMonth) {
    if (!Number.isFinite(month) || month < 1 || month > 12)
      return err(400, 'BAD_MONTH', 'Invalid month.');
  }

  // Resolve the report subject: the requesting user, or a specified employee.
  const callerRoles: string[] = user.roles?.length ? user.roles : [user.role];
  const callerIsAdmin = callerRoles.some((r) => r === 'HR' || r === 'SUPER_ADMIN');
  const callerIsManager = callerIsAdmin || callerRoles.includes('LINE_MANAGER');

  let subject: ApiUser = user;
  if (employeeId && employeeId !== user.id) {
    if (!callerIsManager)
      return err(403, 'FORBIDDEN', 'You do not have permission to view another employee\'s reports.');
    const target = await prisma.user.findUnique({ where: { id: employeeId, deletedAt: null } });
    if (!target)
      return err(404, 'NOT_FOUND', 'Employee not found.');
    if (!callerIsAdmin && target.lineManagerId !== user.id)
      return err(403, 'FORBIDDEN', 'You can only view reports for your direct reports.');
    subject = target;
  }

  try {
    if (format === 'preview') return await renderPreview(user, subject, type, year, month, url, callerIsAdmin, callerIsManager);
    if (format === 'xlsx') return await renderXlsx(user, subject, type, year, month, url, callerIsAdmin, callerIsManager);

    const logoDataUrl = await getLogoDataUrl();
    const generatedAt = fmtGeneratedAt();
    switch (type) {
      case 'attendance':
        return await renderAttendance(subject, year, month, logoDataUrl, generatedAt);
      case 'leaves':
        return await renderLeaves(subject, year, logoDataUrl, generatedAt);
      case 'summary':
        return await renderSummary(subject, year, month, logoDataUrl, generatedAt);
      case 'all-employees':
        // Reads the runtime permission matrix rather than the denormalised
        // primary role: a COO holding ADMIN + EMPLOYEE has EMPLOYEE nowhere in
        // sight but every right to this report, and a Line Manager whose
        // reports.company key was toggled on would otherwise be refused.
        if (!(await checkPermission(user, 'reports.company')))
          return err(403, 'FORBIDDEN', 'You do not have permission to export company reports.');
        return await renderAllEmployees(year, month, logoDataUrl, generatedAt);
      case 'offsite':
        return err(
          400, 'PDF_UNAVAILABLE',
          'The off-site work report is Excel-only - 14 columns of coordinates do not fit a page.',
        );
      case 'performance-leave-summary':
        return await renderPerformanceLeaveSummaryPdf(subject, year, month, logoDataUrl, generatedAt);
      case 'attendance-summary':
        if (!callerIsManager)
          return err(403, 'FORBIDDEN', 'You do not have permission to export attendance summaries.');
        return await renderAttendanceSummaryPdf(user, year, month, url, callerIsAdmin, callerIsManager, logoDataUrl, generatedAt);
      case 'employee-summary':
        if (!callerIsManager)
          return err(403, 'FORBIDDEN', 'You do not have permission to export employee summaries.');
        return await renderEmployeeSummaryPdf(logoDataUrl, generatedAt);
      default:
        return err(404, 'UNKNOWN_REPORT', `Unknown report type "${type}".`);
    }
  } catch (e) {
    console.error('[reports] render error', e);
    return NextResponse.json(
      { error: 'RENDER_FAILED', message: `Could not generate the ${format.toUpperCase()}.` },
      { status: 500 },
    );
  }
}

// ─── Excel ─────────────────────────────────────────────────

/**
 * `user` is the authenticated requester (used for permission checks).
 * `subject` is the employee whose data to export — defaults to `user` when
 * no ?employeeId= is provided; resolved and validated in the GET handler.
 */
async function renderXlsx(
  user: ApiUser,
  subject: ApiUser,
  type: string,
  year: number,
  month: number,
  url: URL,
  callerIsAdmin: boolean,
  callerIsManager: boolean,
): Promise<Response> {
  const slug = (subject.employeeIdCode ?? subject.fullName).replace(/\s+/g, '-').toLowerCase();

  switch (type) {
    case 'attendance': {
      const period = monthPeriod(year, month);
      const data = await getAttendanceReportData(subject, period);
      return xlsxResponse(
        buildAttendanceWorkbook(subject, period, data),
        `attendance-report-${slug}-${period.fileRange}.xlsx`,
      );
    }

    case 'leaves': {
      const period = yearPeriod(year);
      const data = await getLeaveReportData(subject, year);
      return xlsxResponse(
        buildLeavesWorkbook(subject, period, data),
        `leave-history-${slug}-${period.fileRange}.xlsx`,
      );
    }

    case 'summary': {
      const period = monthPeriod(year, month);
      const data = await getSummaryReportData(subject, period);
      return xlsxResponse(
        buildSummaryWorkbook(subject, period, data),
        `performance-summary-${slug}-${period.fileRange}.xlsx`,
      );
    }

    case 'all-employees': {
      if (!(await checkPermission(user, 'reports.company')))
        return err(403, 'FORBIDDEN', 'You do not have permission to export company reports.');
      const period = monthPeriod(year, month);
      const data = await getCompanyReportData(period, 'ALL');
      return xlsxResponse(
        buildCompanyWorkbook(period, data, 'All active employees'),
        `company-report-${period.fileRange}.xlsx`,
      );
    }

    case 'offsite': {
      // Same scope resolution the location board uses: 'ALL' for HR/Admin, the
      // direct reports for a Line Manager, and own-rows-only for everyone else.
      const scope = await resolveVisibleEmployeeIds(user);
      const period = monthPeriod(year, month);
      const ids = scope === 'ALL' ? await allActiveIds() : (scope ?? [user.id]);
      const rows = await getOffsiteRows(ids, period);
      const label =
        scope === 'ALL' ? 'All active employees'
        : scope === null ? 'Your own records'
        : 'Your direct reports';
      return xlsxResponse(
        buildOffsiteWorkbook(period, rows, label),
        `offsite-work-report-${period.fileRange}.xlsx`,
      );
    }

    case 'attendance-summary': {
      if (!callerIsManager)
        return err(403, 'FORBIDDEN', 'You do not have permission to export attendance summaries.');
      const period = resolvePeriod(url, year, month);
      const empIdsParam = url.searchParams.get('employeeIds')?.split(',').filter(Boolean) ?? [];
      let empIds: string[];
      if (empIdsParam.length === 0) {
        if (callerIsManager) {
          empIds = await allActiveIds();
        } else {
          empIds = [user.id];
        }
      } else {
        if (callerIsAdmin) {
          empIds = empIdsParam;
        } else {
          // Line manager: restrict to direct reports
          const directReports = await prisma.user.findMany({
            where: { lineManagerId: user.id, isActive: true },
            select: { id: true },
          });
          const directIds = new Set(directReports.map((r) => r.id));
          empIds = empIdsParam.filter((id) => directIds.has(id));
        }
      }
      const rows = await getAttendanceSummaryRows(empIds, period);
      return xlsxResponse(
        buildAttendanceSummaryWorkbook(period, rows),
        `attendance-summary-${period.fileRange}.xlsx`,
      );
    }

    case 'employee-summary': {
      if (!callerIsManager)
        return err(403, 'FORBIDDEN', 'You do not have permission to export employee summaries.');
      const rows = await getEmployeeDirectoryRows();
      return xlsxResponse(
        buildEmployeeSummaryWorkbook(rows),
        `employee-summary.xlsx`,
      );
    }

    case 'performance-leave-summary': {
      const period = monthPeriod(year, month);
      const identity = {
        id: subject.id,
        fullName: subject.fullName,
        email: subject.email,
        role: subject.role,
        employeeIdCode: subject.employeeIdCode ?? null,
        department: subject.department ?? null,
        designation: subject.designation ?? null,
      };
      const data = await getPerformanceLeaveSummaryData(identity, period);
      const subjectSlug = (subject.employeeIdCode ?? subject.fullName).replace(/\s+/g, '-').toLowerCase();
      return xlsxResponse(
        buildPerformanceLeaveSummaryWorkbook(identity, period, data),
        `performance-leave-summary-${subjectSlug}-${period.fileRange}.xlsx`,
      );
    }

    default:
      return err(404, 'UNKNOWN_REPORT', `Unknown report type "${type}".`);
  }
}

async function allActiveIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ─── preview ───────────────────────────────────────────────

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Format a clock-in/out Date (already shifted by excelInstant) as HH:MM for preview. */
function fmtPreviewTime(d: Date | null): string {
  if (!d) return '';
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fmtNum(n: number | null | undefined): number | string {
  return n ?? '';
}

async function renderPreview(
  user: ApiUser,
  subject: ApiUser,
  type: string,
  year: number,
  month: number,
  url: URL,
  callerIsAdmin: boolean,
  callerIsManager: boolean,
): Promise<Response> {
  const json = (body: unknown) =>
    NextResponse.json(body, { status: 200, headers: { 'cache-control': 'no-store' } });

  switch (type) {
    case 'attendance-summary': {
      if (!callerIsManager)
        return err(403, 'FORBIDDEN', 'You do not have permission to preview attendance summaries.');
      const period = resolvePeriod(url, year, month);
      const empIdsParam = url.searchParams.get('employeeIds')?.split(',').filter(Boolean) ?? [];
      let empIds: string[];
      if (empIdsParam.length === 0) {
        empIds = callerIsManager ? await allActiveIds() : [user.id];
      } else if (callerIsAdmin) {
        empIds = empIdsParam;
      } else {
        const directReports = await prisma.user.findMany({
          where: { lineManagerId: user.id, isActive: true },
          select: { id: true },
        });
        const directIds = new Set(directReports.map((r) => r.id));
        empIds = empIdsParam.filter((id) => directIds.has(id));
      }
      const rows = await getAttendanceSummaryRows(empIds, period);
      const columns = [
        'Employee ID', 'Employee Name', 'Designation', 'Date', 'Day',
        'Clock In', 'Clock Out', 'Total Hours', 'Overtime Hours', 'Deficit Hours',
        'Attendance Status', 'Initial Location', 'Final Location', 'Off-site Workplace',
      ];
      const tableRows = rows.slice(0, 100).map((r) => [
        r.employeeIdCode, r.employeeName, r.designation,
        fmtDate(r.date), r.weekday,
        fmtPreviewTime(r.clockIn),
        fmtPreviewTime(r.clockOut),
        fmtNum(r.totalHours), fmtNum(r.overtimeHours), fmtNum(r.deficitHours),
        r.status, r.initialLocation, r.finalLocation, r.offsiteWorkPlace,
      ]);
      return json({ columns, rows: tableRows });
    }

    case 'employee-summary': {
      if (!callerIsManager)
        return err(403, 'FORBIDDEN', 'You do not have permission to preview employee summaries.');
      const rows = await getEmployeeDirectoryRows();
      const columns = [
        'Employee ID', 'Employee Name', 'Email', 'Phone Number',
        'Department', 'Designation', 'Line Manager', 'Joining Date', 'Exit Date',
      ];
      const tableRows = rows.map((r) => [
        r.employeeIdCode, r.employeeName, r.email, r.phone,
        r.department, r.designation, r.lineManager,
        fmtDate(r.joiningDate), fmtDate(r.departureDate),
      ]);
      return json({ columns, rows: tableRows });
    }

    case 'performance-leave-summary': {
      const period = monthPeriod(year, month);
      const identity = {
        id: subject.id,
        fullName: subject.fullName,
        email: subject.email,
        role: subject.role,
        employeeIdCode: subject.employeeIdCode ?? null,
        department: subject.department ?? null,
        designation: subject.designation ?? null,
      };
      const data = await getPerformanceLeaveSummaryData(identity, period);
      const bal = data.balance;
      const tab1 = {
        kind: 'kv',
        title: 'Performance Summary',
        sections: [
          {
            heading: 'Attendance',
            pairs: [
              ['Working Days', data.performance.workingDays],
              ['Half Days', data.performance.halfDays],
              ['Leave Days', data.performance.leaveDays],
              ['Hours Worked', data.performance.hoursWorked],
              ['Overtime Hours', data.performance.overtimeHours],
              ['Off-site Days', data.performance.offsiteDays],
            ],
          },
          {
            heading: 'Leave Requests (cycle year)',
            pairs: [
              ['Approved', data.requestCounts.approved],
              ['Pending', data.requestCounts.pending],
              ['Rejected', data.requestCounts.rejected],
            ],
          },
        ],
      };
      const tab2 = {
        kind: 'kv',
        title: 'Leave History Summary',
        sections: [
          {
            heading: 'Casual Leave',
            pairs: [
              ['Total', bal.casualTotal],
              ['Used', bal.casualUsed],
              ['Pending', bal.casualPending],
              ['Remaining', Math.max(0, bal.casualTotal - bal.casualUsed - bal.casualPending)],
            ],
          },
          {
            heading: 'Sick Leave',
            pairs: [
              ['Total', bal.sickTotal],
              ['Used', bal.sickUsed],
              ['Pending', bal.sickPending],
              ['Remaining', Math.max(0, bal.sickTotal - bal.sickUsed - bal.sickPending)],
            ],
          },
          {
            heading: 'Replacement Leave',
            pairs: [
              ['Balance', bal.replacementBalance],
              ['Used', bal.replacementUsed ?? 0],
            ],
          },
        ],
      };
      const leaveColumns = [
        'Sl', 'Employee ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date',
        'Duration (days)', 'Half Day', 'Time From', 'Time To', 'Reason', 'Status',
        'Reviewed By', 'Reviewed At', 'Applied On', 'Admin Note',
      ];
      const leaveRows = data.leaveRequests.map((r) => [
        r.sl, r.employeeIdCode, r.employeeName, r.leaveType,
        fmtDate(r.startDate), fmtDate(r.endDate),
        fmtNum(r.durationDays), r.halfDay, r.timeFrom, r.timeTo,
        r.reason, r.status, r.reviewer,
        fmtDate(r.reviewedAt), fmtDate(r.appliedOn), r.adminNote,
      ]);
      const tab3 = {
        kind: 'table',
        title: 'Leave Request',
        columns: leaveColumns,
        rows: leaveRows,
      };
      return json({ tabs: [tab1, tab2, tab3] });
    }

    default:
      return err(404, 'UNKNOWN_REPORT', `Unknown report type "${type}".`);
  }
}

// ─── attendance summary (PDF) ─────────────────────────────────

async function renderAttendanceSummaryPdf(
  user: ApiUser,
  year: number,
  month: number,
  url: URL,
  callerIsAdmin: boolean,
  callerIsManager: boolean,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const period = resolvePeriod(url, year, month);
  const empIdsParam = url.searchParams.get('employeeIds')?.split(',').filter(Boolean) ?? [];
  let empIds: string[];
  if (empIdsParam.length === 0) {
    empIds = callerIsManager ? await allActiveIds() : [user.id];
  } else if (callerIsAdmin) {
    empIds = empIdsParam;
  } else {
    const directReports = await prisma.user.findMany({
      where: { lineManagerId: user.id, isActive: true },
      select: { id: true },
    });
    const directIds = new Set(directReports.map((r) => r.id));
    empIds = empIdsParam.filter((id) => directIds.has(id));
  }

  const rows = await getAttendanceSummaryRows(empIds, period);

  // Group rows by employee (preserve the sorted order from data layer)
  const empMap = new Map<string, AttSummaryPdfEmployee>();
  for (const r of rows) {
    const key = `${r.employeeIdCode}:${r.employeeName}`;
    if (!empMap.has(key)) {
      empMap.set(key, {
        employeeIdCode: r.employeeIdCode,
        employeeName: r.employeeName,
        designation: r.designation,
        rows: [],
      });
    }
    empMap.get(key)!.rows.push({
      date: (r.date as Date).toISOString().slice(0, 10),
      weekday: r.weekday,
      clockIn: r.clockIn ? (r.clockIn as Date).toISOString() : null,
      clockOut: r.clockOut ? (r.clockOut as Date).toISOString() : null,
      totalHours: r.totalHours,
      overtimeHours: r.overtimeHours,
      deficitHours: r.deficitHours,
      status: r.status,
      initialLocation: r.initialLocation,
      finalLocation: r.finalLocation,
    });
  }

  const buf = await renderToBuffer(
    AttendanceSummaryReport({
      period: period.label,
      employees: [...empMap.values()],
      logoDataUrl,
      generatedAt,
    }),
  );
  return pdfResponse(buf, `attendance-summary-${period.fileRange}.pdf`);
}

// ─── employee summary (PDF) ────────────────────────────────────

async function renderEmployeeSummaryPdf(
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const rows = await getEmployeeDirectoryRows();
  const buf = await renderToBuffer(
    EmployeeSummaryReport({ rows, logoDataUrl, generatedAt }),
  );
  return pdfResponse(buf, `employee-summary.pdf`);
}

// ─── performance & leave summary (PDF) ────────────────────────

async function renderPerformanceLeaveSummaryPdf(
  subject: ApiUser,
  year: number,
  month: number,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const period = monthPeriod(year, month);
  const identity = {
    id: subject.id,
    fullName: subject.fullName,
    email: subject.email,
    role: subject.role,
    employeeIdCode: subject.employeeIdCode ?? null,
    department: subject.department ?? null,
    designation: subject.designation ?? null,
  };

  const [userWithManager, data] = await Promise.all([
    prisma.user.findUnique({
      where: { id: subject.id },
      select: { lineManager: { select: { fullName: true } } },
    }),
    getPerformanceLeaveSummaryData(identity, period),
  ]);

  const lineManagerName = userWithManager?.lineManager?.fullName ?? '';
  const buf = await renderToBuffer(
    PerformanceLeaveSummaryReport({
      employee: {
        fullName: subject.fullName,
        employeeIdCode: subject.employeeIdCode ?? null,
        department: subject.department ?? null,
        designation: subject.designation ?? null,
        email: subject.email,
      },
      lineManagerName,
      period: period.label,
      generatedAt,
      logoDataUrl,
      data,
    }),
  );
  const slug = (subject.employeeIdCode ?? subject.fullName).replace(/\s+/g, '-').toLowerCase();
  return pdfResponse(buf, `performance-leave-summary-${slug}-${period.fileRange}.pdf`);
}

// ─── attendance ────────────────────────────────────────────────

async function renderAttendance(
  user: { id: string; fullName: string; email: string; role: string; employeeIdCode: string | null },
  year: number,
  month: number,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: user.id, date: { gte: from, lt: to } },
    orderBy: { date: 'asc' },
  });

  const shaped: AttendanceRecord[] = records.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    clockInTime: r.clockInTime?.toISOString() ?? null,
    clockOutTime: r.clockOutTime?.toISOString() ?? null,
    totalWorkedMinutes: r.totalWorkedMinutes,
    totalBreakMinutes: r.totalBreakMinutes,
    overtimeMinutes: r.overtimeMinutes,
    status: r.status,
  }));

  const buf = await renderToBuffer(
    AttendanceReport({
      employeeName: user.fullName,
      employeeEmail: user.email,
      employeeIdCode: user.employeeIdCode,
      role: user.role,
      year,
      month,
      records: shaped,
      logoDataUrl,
      generatedAt,
    }),
  );
  return pdfResponse(
    buf,
    `attendance_${user.fullName.replace(/\s+/g, '_')}_${year}-${String(month).padStart(2, '0')}.pdf`,
  );
}

// ─── leaves ────────────────────────────────────────────────

async function renderLeaves(
  user: { id: string; fullName: string; email: string; role: string; employeeIdCode: string | null },
  year: number,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const [balance, requests] = await Promise.all([
    prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: user.id, cycleYear: year } },
      create: {
        employeeId: user.id,
        cycleYear: year,
        cycleStartDate: new Date(year, 0, 1),
        cycleEndDate: new Date(year, 11, 31),
      },
      update: {},
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: user.id,
        startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      include: { reviewer: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const shaped: LeaveRecord[] = requests.map((r) => ({
    leaveType: r.leaveType,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    durationDays: Number(r.durationDays),
    isHalfDay: r.isHalfDay,
    halfDaySlot: r.halfDaySlot,
    timeFrom: r.timeFrom,
    timeTo: r.timeTo,
    reason: r.reason,
    status: r.status,
    adminNote: r.adminNote,
    reviewerName: r.reviewer?.fullName ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const buf = await renderToBuffer(
    LeavesReport({
      employeeName: user.fullName,
      employeeEmail: user.email,
      employeeIdCode: user.employeeIdCode,
      role: user.role,
      cycleYear: year,
      balance: {
        casualTotal: Number(balance.casualTotal),
        casualUsed: Number(balance.casualUsed),
        casualPending: Number(balance.casualPending),
        sickTotal: Number(balance.sickTotal),
        sickUsed: Number(balance.sickUsed),
        sickPending: Number(balance.sickPending),
        replacementBalance: Number(balance.replacementBalance),
      },
      records: shaped,
      logoDataUrl,
      generatedAt,
    }),
  );
  return pdfResponse(
    buf,
    `leaves_${user.fullName.replace(/\s+/g, '_')}_${year}.pdf`,
  );
}

// ─── summary ────────────────────────────────────────────────

async function renderSummary(
  user: { id: string; fullName: string; email: string; role: string; employeeIdCode: string | null; department: string | null; designation: string | null },
  year: number,
  month: number,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const [balance, records, requests] = await Promise.all([
    prisma.leaveBalance.upsert({
      where: { employeeId_cycleYear: { employeeId: user.id, cycleYear: year } },
      create: {
        employeeId: user.id,
        cycleYear: year,
        cycleStartDate: new Date(year, 0, 1),
        cycleEndDate: new Date(year, 11, 31),
      },
      update: {},
    }),
    prisma.attendanceRecord.findMany({
      where: { employeeId: user.id, date: { gte: from, lt: to } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: user.id,
        startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
    }),
  ]);

  const presentDays = records.filter((r) => r.status === 'PRESENT').length;
  const workDays = records.filter((r) => r.status !== 'WEEKEND' && r.status !== 'HOLIDAY').length;
  const workedMinutes = records.reduce((s, r) => s + r.totalWorkedMinutes, 0);
  const overtimeMinutes = records.reduce((s, r) => s + r.overtimeMinutes, 0);
  const absentDays = records.filter((r) => r.status === 'ABSENT').length;
  const approved = requests.filter((r) => r.status === 'APPROVED');
  const totalDaysUsed = approved.reduce((s, r) => s + Number(r.durationDays), 0);

  const buf = await renderToBuffer(
    SummaryReport({
      employeeName: user.fullName,
      employeeEmail: user.email,
      employeeIdCode: user.employeeIdCode,
      role: user.role,
      department: user.department,
      designation: user.designation,
      cycleYear: year,
      balance: {
        casualTotal: Number(balance.casualTotal),
        casualUsed: Number(balance.casualUsed),
        casualPending: Number(balance.casualPending),
        sickTotal: Number(balance.sickTotal),
        sickUsed: Number(balance.sickUsed),
        sickPending: Number(balance.sickPending),
        replacementBalance: Number(balance.replacementBalance),
      },
      attendance: {
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        presentDays,
        workDays,
        workedMinutes,
        overtimeMinutes,
        absentDays,
      },
      leaves: {
        approved: approved.length,
        pending: requests.filter((r) => r.status === 'PENDING').length,
        rejected: requests.filter((r) => r.status === 'REJECTED').length,
        totalDaysUsed,
      },
      logoDataUrl,
      generatedAt,
    }),
  );
  return pdfResponse(
    buf,
    `summary_${user.fullName.replace(/\s+/g, '_')}_${year}.pdf`,
  );
}

// ─── all employees (admin) ────────────────────────────────────

async function renderAllEmployees(
  year: number,
  month: number,
  logoDataUrl: string,
  generatedAt: string,
): Promise<Response> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    include: {
      leaveBalances: { where: { cycleYear: year } },
      leaveRequests: {
        where: {
          startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        },
      },
      attendance: { where: { date: { gte: from, lt: to } } },
    },
  });

  const rows: EmployeeRow[] = employees.map((e) => {
    const bal = e.leaveBalances[0];
    const monthRecords = e.attendance;
    const present = monthRecords.filter((r) => r.status === 'PRESENT').length;
    const workDays = monthRecords.filter((r) => r.status !== 'WEEKEND' && r.status !== 'HOLIDAY').length;
    const overtimeMinutes = monthRecords.reduce((s, r) => s + r.overtimeMinutes, 0);
    return {
      name: e.fullName,
      email: e.email,
      role: e.role,
      department: e.department,
      casualUsed: bal ? Number(bal.casualUsed) : 0,
      casualTotal: bal ? Number(bal.casualTotal) : 12,
      sickUsed: bal ? Number(bal.sickUsed) : 0,
      sickTotal: bal ? Number(bal.sickTotal) : 12,
      replacementBalance: bal ? Number(bal.replacementBalance) : 0,
      approvedLeaves: e.leaveRequests.filter((r) => r.status === 'APPROVED').length,
      pendingLeaves: e.leaveRequests.filter((r) => r.status === 'PENDING').length,
      attendanceRate: workDays === 0 ? null : Math.round((present / workDays) * 100),
      overtimeMinutes,
    };
  });

  const totalActiveLeaves = rows.reduce((s, r) => s + r.approvedLeaves, 0);
  const totalPendingRequests = rows.reduce((s, r) => s + r.pendingLeaves, 0);

  const buf = await renderToBuffer(
    AllEmployeesReport({
      cycleYear: year,
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      totalEmployees: rows.length,
      totalActiveLeaves,
      totalPendingRequests,
      rows,
      logoDataUrl,
      generatedAt,
    }),
  );
  return pdfResponse(buf, `trace_hris_all_employees_${year}.pdf`);
}
