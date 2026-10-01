import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand, BrandHeader, BrandFooter, styles as shared, statusBadgeStyle, SummarySection } from './theme';
import type { PerformanceLeaveSummaryData } from './data';

// ─── input types ──────────────────────────────────────────

export interface PerformanceLeaveSummaryReportInput {
  employee: {
    fullName: string;
    employeeIdCode: string | null;
    department: string | null;
    designation: string | null;
    email: string;
  };
  lineManagerName: string;
  period: string;
  generatedAt: string;
  logoDataUrl: string;
  data: PerformanceLeaveSummaryData;
}

// ─── leave request table columns (A4 landscape) ───────────
// Labels mirror the Excel sheet (PERF_LEAVE_REQUEST_COLS in builders.ts).

const LR_COLS = [
  { label: 'Sl',               w: '3%'  },
  { label: 'Employee ID',      w: '6%'  },
  { label: 'Employee Name',    w: '9%'  },
  { label: 'Leave Type',       w: '7%'  },
  { label: 'Start Date',       w: '6%'  },
  { label: 'End Date',         w: '6%'  },
  { label: 'Duration (days)',  w: '5%'  },
  { label: 'Half Day',         w: '4%'  },
  { label: 'Time From',        w: '5%'  },
  { label: 'Time To',          w: '5%'  },
  { label: 'Reason',           w: '10%' },
  { label: 'Status',           w: '6%'  },
  { label: 'Reviewed By',      w: '8%'  },
  { label: 'Reviewed At',      w: '6%'  },
  { label: 'Applied On',       w: '6%'  },
  { label: 'Admin Note',       w: '8%'  },
];

// ─── helpers ──────────────────────────────────────────────

function fmtDate(d: Date | null): string {
  if (!d) return '-';
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function fmtHours(n: number): string {
  if (n == null || n === 0) return '-';
  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── local styles ──────────────────────────────────────────

const s = StyleSheet.create({
  summaryPage: { paddingBottom: 60, fontSize: 9, color: brand.text, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  tablePage: { paddingBottom: 60, fontSize: 9, color: brand.text, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  body: { paddingHorizontal: 36, paddingTop: 16, paddingBottom: 16 },
  tableBody: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 70 },
  table: { borderWidth: 1, borderColor: brand.border, borderRadius: 3 },
  thead: {
    flexDirection: 'row',
    backgroundColor: brand.bgSoft,
    borderBottomWidth: 1, borderBottomColor: brand.border,
    paddingVertical: 6, paddingHorizontal: 5,
  },
  trow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: brand.border,
    paddingVertical: 4, paddingHorizontal: 5,
  },
  trowAlt: { backgroundColor: '#FAFBFC' },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: brand.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  td: { fontSize: 7, color: brand.text },
  tdMuted: { fontSize: 7, color: brand.soft },
  badge: {
    paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2,
    fontSize: 5.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3,
    alignSelf: 'flex-start',
  },
});

// ─── component ────────────────────────────────────────────

export function PerformanceLeaveSummaryReport({
  employee, lineManagerName, period, generatedAt, logoDataUrl, data,
}: PerformanceLeaveSummaryReportInput) {
  const b = data.balance;
  const p = data.performance;

  // Sheet 1 content (mirrors Excel's "Performance Summary" sheet)
  const perfReport: [string, string | number][] = [
    ['Report Type',  'Performance summary'],
    ['Period',       period],
    ['Generated on', generatedAt],
    ['Source',       'TRACE HRMS'],
  ];
  const perfEmployee: [string, string | number][] = [
    ['Employee ID',  employee.employeeIdCode ?? '-'],
    ['Name',         employee.fullName],
    ['Email',        employee.email],
    ['Department',   employee.department ?? '-'],
    ['Designation',  employee.designation ?? '-'],
    ['Line Manager', lineManagerName],
  ];
  const perfAttendance: [string, string | number][] = [
    ['Working Days',             p.workingDays],
    ['Half Days',                p.halfDays],
    ['Leave Days',               p.leaveDays],
    ['Hours worked',             fmtHours(p.hoursWorked)],
    ['Overtime Hours',           fmtHours(p.overtimeHours)],
    ['Days with off-site work',  p.offsiteDays],
  ];

  // Sheet 2 content (mirrors Excel's "Leave History Summary" sheet)
  const leaveReport: [string, string | number][] = [
    ['Report',       'Leave history'],
    ['Period',       period],
    ['Generated on', generatedAt],
    ['Source',       'TRACE HRMS'],
  ];
  const leaveEmployee: [string, string | number][] = perfEmployee;
  const leaveBalance: [string, string | number][] = [
    ['Casual - Entitled',          b.casualTotal],
    ['Casual - Used',              b.casualUsed],
    ['Casual - Remaining',         round2(b.casualTotal - b.casualUsed - b.casualPending)],
    ['Sick - Entitled',            b.sickTotal],
    ['Sick - Used',                b.sickUsed],
    ['Sick - Remaining',           round2(b.sickTotal - b.sickUsed - b.sickPending)],
    ['Replacement Leave Balance',  b.replacementBalance],
    ['Replacement Leave - Used',   b.replacementUsed ?? 0],
  ];
  const leaveRequests: [string, string | number][] = [
    ['Approved', data.requestCounts.approved],
    ['Pending',  data.requestCounts.pending],
    ['Rejected', data.requestCounts.rejected],
  ];

  return (
    <Document title={`Performance & Leave Summary - ${employee.fullName}`} author="TRACE HRMS">

      {/* ── Page 1: Performance Summary (mirrors Excel Sheet 1) ─ */}
      <Page size="A4" style={s.summaryPage}>
        <BrandHeader
          title="Performance Summary"
          metaLabel="EMPLOYEE"
          metaValue={employee.fullName}
          extraMeta={`Period: ${period}`}
          logoDataUrl={logoDataUrl}
        />

        <View style={s.body}>
          <SummarySection heading="Report"               rows={perfReport} />
          <SummarySection heading="Employee Information" rows={perfEmployee} />
          <SummarySection heading={`Attendance - ${period}`} rows={perfAttendance} />
        </View>

        <BrandFooter generatedAt={generatedAt} />
      </Page>

      {/* ── Page 2: Leave History Summary (mirrors Excel Sheet 2) ─ */}
      <Page size="A4" style={s.summaryPage}>
        <BrandHeader
          title="Leave History Summary"
          metaLabel="EMPLOYEE"
          metaValue={employee.fullName}
          extraMeta={`Period: ${period}`}
          logoDataUrl={logoDataUrl}
        />

        <View style={s.body}>
          <SummarySection heading="Report"               rows={leaveReport} />
          <SummarySection heading="Employee"             rows={leaveEmployee} />
          <SummarySection heading="Leave balance"        rows={leaveBalance} />
          <SummarySection heading="Requests this cycle"  rows={leaveRequests} />
        </View>

        <BrandFooter generatedAt={generatedAt} />
      </Page>

      {/* ── Page 3+: Leave Request table (mirrors Excel Sheet 3) ─ */}
      <Page size="A4" orientation="landscape" style={s.tablePage}>
        <BrandHeader
          title="Leave Request"
          metaLabel="EMPLOYEE"
          metaValue={employee.fullName}
          extraMeta={`Period: ${period}`}
          logoDataUrl={logoDataUrl}
        />

        <View style={s.tableBody}>
          {data.leaveRequests.length === 0 ? (
            <Text style={shared.emptyState}>No leave requests found for this period.</Text>
          ) : (
            <View style={s.table}>
              <View style={s.thead} fixed>
                {LR_COLS.map((c) => (
                  <Text key={c.label} style={[s.th, { width: c.w }]}>{c.label}</Text>
                ))}
              </View>
              {data.leaveRequests.map((r, i) => {
                const badge = statusBadgeStyle(r.status);
                return (
                  <View key={i} style={[s.trow, i % 2 === 1 ? s.trowAlt : {}]} wrap={false}>
                    <Text style={[s.tdMuted, { width: LR_COLS[0].w }]}>{r.sl}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[1].w }]}>{r.employeeIdCode}</Text>
                    <Text style={[s.td, { width: LR_COLS[2].w }]}>{r.employeeName}</Text>
                    <Text style={[s.td, { width: LR_COLS[3].w }]}>{r.leaveType}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[4].w }]}>{fmtDate(r.startDate)}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[5].w }]}>{fmtDate(r.endDate)}</Text>
                    <Text style={[s.td, { width: LR_COLS[6].w }]}>{r.durationDays}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[7].w }]}>{r.halfDay || '-'}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[8].w }]}>{r.timeFrom || '-'}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[9].w }]}>{r.timeTo || '-'}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[10].w }]}>{r.reason || '-'}</Text>
                    <View style={{ width: LR_COLS[11].w }}>
                      <Text style={[s.badge, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
                        {r.status}
                      </Text>
                    </View>
                    <Text style={[s.tdMuted, { width: LR_COLS[12].w }]}>{r.reviewer || '-'}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[13].w }]}>{fmtDate(r.reviewedAt)}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[14].w }]}>{fmtDate(r.appliedOn)}</Text>
                    <Text style={[s.tdMuted, { width: LR_COLS[15].w }]}>{r.adminNote || '-'}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <BrandFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
