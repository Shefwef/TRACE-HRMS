import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { BrandHeader, BrandFooter, styles as shared, statusBadgeStyle, brand } from './theme';

// ─── input types ──────────────────────────────────────────

export interface AttSummaryPdfRow {
  date: string;           // ISO "yyyy-mm-dd"
  weekday: string;        // "Mon", "Tue", …
  clockIn: string | null; // ISO instant (UTC = local wall clock after excelInstant shift)
  clockOut: string | null;
  totalHours: number;
  overtimeHours: number;
  deficitHours: number;
  status: string;
  initialLocation: string;
  finalLocation: string;
}

export interface AttSummaryPdfEmployee {
  employeeIdCode: string;
  employeeName: string;
  designation: string;
  rows: AttSummaryPdfRow[];
}

export interface AttendanceSummaryReportInput {
  period: string;
  employees: AttSummaryPdfEmployee[];
  logoDataUrl: string;
  generatedAt: string;
}

// ─── helpers ──────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12 || 12).toString();
  return `${h12}:${m} ${ampm}`;
}

function fmtHours(n: number): string {
  if (n === 0) return '-';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function statusColor(s: string): { color: string; bg: string } {
  const badge = statusBadgeStyle(s.toUpperCase());
  return { color: badge.color, bg: badge.backgroundColor };
}

// ─── column layout (landscape A4 content ≈ 769pt) ─────────

const COLS = [
  { label: 'Date',         w: '12%' },
  { label: 'Day',          w: '5%'  },
  { label: 'Clock In',     w: '9%'  },
  { label: 'Clock Out',    w: '9%'  },
  { label: 'Worked',       w: '8%'  },
  { label: 'Overtime',     w: '8%'  },
  { label: 'Deficit',      w: '8%'  },
  { label: 'Status',       w: '13%' },
  { label: 'Initial Loc.', w: '14%' },
  { label: 'Final Loc.',   w: '14%' },
];

// ─── local styles ──────────────────────────────────────────

const s = StyleSheet.create({
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brand.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 10,
    borderRadius: 3,
  },
  empName: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginRight: 10,
  },
  empMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  td: {
    fontSize: 8,
    color: brand.text,
  },
  tdMuted: {
    fontSize: 8,
    color: brand.soft,
  },
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

// ─── component ────────────────────────────────────────────

export function AttendanceSummaryReport(input: AttendanceSummaryReportInput) {
  const totalEmployees = input.employees.length;
  const totalRows = input.employees.reduce((sum, e) => sum + e.rows.length, 0);

  return (
    <Document title={`Attendance Summary - ${input.period}`} author="TRACE HRMS">
      <Page size="A4" orientation="landscape" style={shared.page}>
        <BrandHeader
          title="Attendance Summary"
          metaLabel="Period"
          metaValue={input.period}
          logoDataUrl={input.logoDataUrl}
        />

        <View style={[shared.body, { paddingBottom: 70 }]}>
          {/* Summary stats */}
          <View style={[shared.statsRow, { marginBottom: 12, marginTop: 4 }]}>
            <View style={shared.statCard}>
              <Text style={shared.statLabel}>Employees</Text>
              <Text style={shared.statValue}>{totalEmployees}</Text>
            </View>
            <View style={shared.statCard}>
              <Text style={shared.statLabel}>Total Rows</Text>
              <Text style={shared.statValue}>{totalRows}</Text>
            </View>
          </View>

          {/* Per-employee tables */}
          {input.employees.map((emp) => (
            <View key={emp.employeeIdCode + emp.employeeName} wrap={false}>
              {/* Employee header */}
              <View style={s.empHeader}>
                <Text style={s.empName}>{emp.employeeName}</Text>
                <Text style={s.empMeta}>
                  {emp.employeeIdCode !== '-' ? `ID: ${emp.employeeIdCode}` : ''}
                  {emp.designation ? `  ·  ${emp.designation}` : ''}
                </Text>
              </View>

              {/* Table header */}
              <View style={shared.tableHeaderRow}>
                {COLS.map((c) => (
                  <Text key={c.label} style={[s.th, { width: c.w }]}>{c.label}</Text>
                ))}
              </View>

              {/* Daily rows */}
              {emp.rows.map((r, i) => {
                const sc = statusColor(r.status);
                const isDim = r.status === 'Weekend' || r.status === 'Holiday';
                return (
                  <View
                    key={r.date}
                    style={[
                      shared.tableRow,
                      i % 2 === 1 ? shared.tableRowAlt : {},
                      isDim ? { opacity: 0.55 } : {},
                    ]}
                    wrap={false}
                  >
                    <Text style={[s.td, { width: COLS[0].w }]}>{fmtDate(r.date)}</Text>
                    <Text style={[s.tdMuted, { width: COLS[1].w }]}>{r.weekday}</Text>
                    <Text style={[s.td, { width: COLS[2].w }]}>{fmtTime(r.clockIn)}</Text>
                    <Text style={[s.td, { width: COLS[3].w }]}>{fmtTime(r.clockOut)}</Text>
                    <Text style={[s.td, { width: COLS[4].w }]}>{fmtHours(r.totalHours)}</Text>
                    <Text style={[s.td, { width: COLS[5].w, color: r.overtimeHours > 0 ? brand.success : brand.soft }]}>
                      {fmtHours(r.overtimeHours)}
                    </Text>
                    <Text style={[s.td, { width: COLS[6].w, color: r.deficitHours > 0 ? brand.danger : brand.soft }]}>
                      {fmtHours(r.deficitHours)}
                    </Text>
                    <View style={{ width: COLS[7].w }}>
                      <Text style={[s.statusBadge, { color: sc.color, backgroundColor: sc.bg }]}>
                        {r.status}
                      </Text>
                    </View>
                    <Text style={[s.tdMuted, { width: COLS[8].w }]}>{r.initialLocation || '-'}</Text>
                    <Text style={[s.tdMuted, { width: COLS[9].w }]}>{r.finalLocation || '-'}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <BrandFooter generatedAt={input.generatedAt} />
      </Page>
    </Document>
  );
}
