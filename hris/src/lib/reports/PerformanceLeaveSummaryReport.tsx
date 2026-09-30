import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand, BrandHeader, BrandFooter, styles as shared, statusBadgeStyle, Kv } from './theme';
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

const LR_COLS = [
  { label: '#',            w: '3%'  },
  { label: 'Emp ID',       w: '6%'  },
  { label: 'Name',         w: '9%'  },
  { label: 'Leave Type',   w: '7%'  },
  { label: 'Start',        w: '6%'  },
  { label: 'End',          w: '6%'  },
  { label: 'Days',         w: '4%'  },
  { label: 'Half Day',     w: '4%'  },
  { label: 'From',         w: '5%'  },
  { label: 'To',           w: '5%'  },
  { label: 'Reason',       w: '10%' },
  { label: 'Status',       w: '6%'  },
  { label: 'Reviewer',     w: '8%'  },
  { label: 'Reviewed At',  w: '6%'  },
  { label: 'Applied On',   w: '6%'  },
  { label: 'Admin Note',   w: '9%'  },
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
  kvPage: { paddingTop: 0, paddingBottom: 60, fontSize: 10, color: brand.text, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  tablePage: { paddingTop: 0, paddingBottom: 60, fontSize: 9, color: brand.text, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  body: { paddingHorizontal: 36, paddingTop: 18, paddingBottom: 16 },
  sectionDivider: { marginTop: 18, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: brand.border },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#305496', textTransform: 'uppercase', letterSpacing: 0.8 },
  empMeta: { fontSize: 8, color: brand.soft, marginBottom: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  kvCard: { flex: 1, borderWidth: 1, borderColor: brand.border, borderRadius: 5, padding: 12, backgroundColor: '#fff' },
  kvCardTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: brand.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
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
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: brand.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
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

  return (
    <Document title={`Performance & Leave Summary - ${employee.fullName}`} author="TRACE HRMS">

      {/* ── Page 1: KV sections (portrait) ─────────────────── */}
      <Page size="A4" style={s.kvPage}>
        <BrandHeader
          title="Performance & Leave Summary"
          metaLabel="Employee"
          metaValue={employee.fullName}
          logoDataUrl={logoDataUrl}
        />

        <View style={s.body}>
          {/* Employee info strip */}
          <View style={s.empMeta}>
            {employee.employeeIdCode ? <Text>ID: {employee.employeeIdCode}</Text> : null}
            {employee.department ? <Text>Dept: {employee.department}</Text> : null}
            {employee.designation ? <Text>{employee.designation}</Text> : null}
            {lineManagerName ? <Text>Manager: {lineManagerName}</Text> : null}
            <Text>Period: {period}</Text>
          </View>

          {/* ── Tab 1: Performance Summary ── */}
          <View style={s.sectionDivider}><Text style={s.sectionTitle}>Performance Summary</Text></View>

          <View style={s.twoCol}>
            <View style={s.kvCard}>
              <Text style={s.kvCardTitle}>Attendance</Text>
              <Kv label="Working Days"    value={String(p.workingDays)} />
              <Kv label="Half Days"       value={String(p.halfDays)} />
              <Kv label="Leave Days"      value={String(p.leaveDays)} />
              <Kv label="Hours Worked"    value={fmtHours(p.hoursWorked)} />
              <Kv label="Overtime Hours"  value={fmtHours(p.overtimeHours)} />
              <Kv label="Off-site Days"   value={String(p.offsiteDays)} />
            </View>
            <View style={s.kvCard}>
              <Text style={s.kvCardTitle}>Leave Requests (cycle year)</Text>
              <Kv label="Approved"  value={String(data.requestCounts.approved)} />
              <Kv label="Pending"   value={String(data.requestCounts.pending)} />
              <Kv label="Rejected"  value={String(data.requestCounts.rejected)} />
            </View>
          </View>

          {/* ── Tab 2: Leave History Summary ── */}
          <View style={[s.sectionDivider, { marginTop: 14 }]}><Text style={s.sectionTitle}>Leave History Summary</Text></View>

          <View style={s.twoCol}>
            <View style={s.kvCard}>
              <Text style={s.kvCardTitle}>Casual Leave</Text>
              <Kv label="Total"     value={String(b.casualTotal)} />
              <Kv label="Used"      value={String(b.casualUsed)} />
              <Kv label="Pending"   value={String(b.casualPending)} />
              <Kv label="Remaining" value={String(round2(b.casualTotal - b.casualUsed - b.casualPending))} />
            </View>
            <View style={s.kvCard}>
              <Text style={s.kvCardTitle}>Sick Leave</Text>
              <Kv label="Total"     value={String(b.sickTotal)} />
              <Kv label="Used"      value={String(b.sickUsed)} />
              <Kv label="Pending"   value={String(b.sickPending)} />
              <Kv label="Remaining" value={String(round2(b.sickTotal - b.sickUsed - b.sickPending))} />
            </View>
            <View style={s.kvCard}>
              <Text style={s.kvCardTitle}>Replacement Leave</Text>
              <Kv label="Balance"   value={String(b.replacementBalance)} />
              <Kv label="Used"      value={String(b.replacementUsed ?? 0)} />
            </View>
          </View>
        </View>

        <BrandFooter generatedAt={generatedAt} />
      </Page>

      {/* ── Page 2+: Leave Request table (landscape) ────────── */}
      <Page size="A4" orientation="landscape" style={s.tablePage}>
        <BrandHeader
          title="Leave Requests"
          metaLabel="Employee"
          metaValue={employee.fullName}
          logoDataUrl={logoDataUrl}
        />

        <View style={[s.body, { paddingBottom: 70 }]}>
          <View style={[s.sectionDivider, { marginTop: 4 }]}><Text style={s.sectionTitle}>Leave Request</Text></View>

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
