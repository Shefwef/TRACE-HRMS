import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand, BrandHeader, BrandFooter, statusBadgeStyle } from './theme';

// ─── input types ──────────────────────────────────────────

export interface AttSummaryPdfRow {
  date: string;
  weekday: string;
  clockIn: string | null;
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
  return `${(h % 12 || 12)}:${m} ${ampm}`;
}

function fmtHours(n: number): string {
  if (n === 0) return '-';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── column layout (A4 landscape, 769pt usable) ───────────
// Labels mirror the Excel sheet (ATTENDANCE_SUMMARY_COLS in builders.ts).

const COLS = [
  { label: 'Employee ID',       w: '7%'  },
  { label: 'Employee Name',     w: '11%' },
  { label: 'Designation',       w: '9%'  },
  { label: 'Date',              w: '8%'  },
  { label: 'Day',               w: '4%'  },
  { label: 'Clock In',          w: '6%'  },
  { label: 'Clock Out',         w: '6%'  },
  { label: 'Total Hours',       w: '5%'  },
  { label: 'Overtime Hours',    w: '6%'  },
  { label: 'Deficit Hours',     w: '6%'  },
  { label: 'Attendance Status', w: '9%'  },
  { label: 'Initial Location',  w: '8%'  },
  { label: 'Final Location',    w: '8%'  },
  { label: 'Off-site Workplace',w: '7%'  },
];

// ─── local styles ──────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingBottom: 60,
    fontSize: 9,
    color: brand.text,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  body: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 20 },
  table: { borderWidth: 1, borderColor: brand.border, borderRadius: 3 },
  thead: {
    flexDirection: 'row',
    backgroundColor: brand.bgSoft,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  trow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: brand.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  trowAlt: { backgroundColor: '#FAFBFC' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: brand.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { fontSize: 7, color: brand.text },
  tdMuted: { fontSize: 7, color: brand.soft },
  badge: {
    paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2,
    fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3,
    alignSelf: 'flex-start',
  },
});

// ─── component ────────────────────────────────────────────

export function AttendanceSummaryReport(input: AttendanceSummaryReportInput) {
  return (
    <Document title={`Attendance Summary - ${input.period}`} author="TRACE HRMS">
      <Page size="A4" orientation="landscape" style={s.page}>
        <BrandHeader
          title="Attendance Summary"
          metaLabel="PERIOD"
          metaValue={input.period}
          extraMeta={`Generated ${input.generatedAt}`}
          logoDataUrl={input.logoDataUrl}
        />

        <View style={s.body}>
          <View style={s.table}>
            <View style={s.thead} fixed>
              {COLS.map((c) => (
                <Text key={c.label} style={[s.th, { width: c.w }]}>{c.label}</Text>
              ))}
            </View>
            {input.employees.map((emp) =>
              emp.rows.map((r, rowIdx) => {
                const badge = statusBadgeStyle(r.status);
                const isDim = r.status === 'Weekend' || r.status === 'Holiday';
                const isFirst = rowIdx === 0;
                return (
                  <View
                    key={`${emp.employeeIdCode}-${r.date}`}
                    style={[s.trow, rowIdx % 2 === 1 ? s.trowAlt : {}, isDim ? { opacity: 0.5 } : {}]}
                    wrap={false}
                  >
                    <Text style={[isFirst ? s.td : s.tdMuted, { width: COLS[0].w }]}>
                      {isFirst ? emp.employeeIdCode : ''}
                    </Text>
                    <Text style={[isFirst ? s.td : s.tdMuted, { width: COLS[1].w, fontFamily: isFirst ? 'Helvetica-Bold' : 'Helvetica' }]}>
                      {isFirst ? emp.employeeName : ''}
                    </Text>
                    <Text style={[isFirst ? s.td : s.tdMuted, { width: COLS[2].w }]}>
                      {isFirst ? emp.designation : ''}
                    </Text>
                    <Text style={[s.td, { width: COLS[3].w }]}>{fmtDate(r.date)}</Text>
                    <Text style={[s.tdMuted, { width: COLS[4].w }]}>{r.weekday}</Text>
                    <Text style={[s.td, { width: COLS[5].w }]}>{fmtTime(r.clockIn)}</Text>
                    <Text style={[s.td, { width: COLS[6].w }]}>{fmtTime(r.clockOut)}</Text>
                    <Text style={[s.td, { width: COLS[7].w }]}>{fmtHours(r.totalHours)}</Text>
                    <Text style={[s.td, { width: COLS[8].w, color: r.overtimeHours > 0 ? brand.success : brand.soft }]}>
                      {fmtHours(r.overtimeHours)}
                    </Text>
                    <Text style={[s.td, { width: COLS[9].w, color: r.deficitHours > 0 ? brand.danger : brand.soft }]}>
                      {fmtHours(r.deficitHours)}
                    </Text>
                    <View style={{ width: COLS[10].w }}>
                      <Text style={[s.badge, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
                        {r.status}
                      </Text>
                    </View>
                    <Text style={[s.tdMuted, { width: COLS[11].w }]}>{r.initialLocation || '-'}</Text>
                    <Text style={[s.tdMuted, { width: COLS[12].w }]}>{r.finalLocation || '-'}</Text>
                    <Text style={[s.tdMuted, { width: COLS[13].w }]}>-</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <BrandFooter generatedAt={input.generatedAt} />
      </Page>
    </Document>
  );
}
