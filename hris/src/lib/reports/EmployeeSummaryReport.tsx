import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { brand } from './theme';

// ─── input types ──────────────────────────────────────────

export interface EmployeeSummaryPdfRow {
  employeeIdCode: string;
  employeeName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  lineManager: string;
  joiningDate: Date | null;
  departureDate: Date | null;
}

export interface EmployeeSummaryReportInput {
  rows: EmployeeSummaryPdfRow[];
  logoDataUrl: string;
  generatedAt: string;
}

// ─── helpers ──────────────────────────────────────────────

function fmtDate(d: Date | null): string {
  if (!d) return '-';
  return d.toISOString().slice(0, 10);
}

// ─── column layout (A4 landscape, 769pt usable) ───────────

const COLS = [
  { label: 'Emp ID',       w: '8%'  },
  { label: 'Name',         w: '14%' },
  { label: 'Email',        w: '18%' },
  { label: 'Phone',        w: '9%'  },
  { label: 'Department',   w: '11%' },
  { label: 'Designation',  w: '12%' },
  { label: 'Line Manager', w: '12%' },
  { label: 'Joining Date', w: '8%'  },
  { label: 'Exit Date',    w: '8%'  },
];

// ─── styles ───────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    color: brand.text,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  brandBlock: {
    backgroundColor: '#305496',
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 38, height: 38, objectFit: 'contain' },
  brandWordmark: { color: 'rgba(255,255,255,0.72)', fontSize: 7, letterSpacing: 1.2, marginBottom: 3 },
  brandTitle: { color: '#fff', fontSize: 16, fontFamily: 'Helvetica-Bold' },
  brandRight: { alignItems: 'flex-end' },
  brandMetaLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 7, letterSpacing: 0.8, marginBottom: 2 },
  brandMetaValue: { color: '#fff', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  brandGenerated: { color: 'rgba(255,255,255,0.55)', fontSize: 7, marginTop: 4 },
  accentStripe: { height: 3, backgroundColor: '#7baed4' },
  body: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 20 },
  summary: { flexDirection: 'row', gap: 12, marginBottom: 12, marginTop: 4 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: brand.border, borderRadius: 4, padding: 10, backgroundColor: '#fff' },
  summaryLabel: { fontSize: 7, color: brand.soft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  summaryValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#305496' },
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
  td: { fontSize: 8, color: brand.text },
  tdMuted: { fontSize: 8, color: brand.soft },
  inactive: { opacity: 0.55 },
});

// ─── component ────────────────────────────────────────────

export function EmployeeSummaryReport(input: EmployeeSummaryReportInput) {
  return (
    <Document title="Employee Summary" author="TRACE HRMS">
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* One-time brand block — not fixed */}
        <View style={s.brandBlock}>
          <View style={s.brandLeft}>
            {input.logoDataUrl ? <Image src={input.logoDataUrl} style={s.logo} /> : null}
            <View>
              <Text style={s.brandWordmark}>TRACE HRMS</Text>
              <Text style={s.brandTitle}>Employee Summary</Text>
            </View>
          </View>
          <View style={s.brandRight}>
            <Text style={s.brandMetaLabel}>COMPANY DIRECTORY</Text>
            <Text style={s.brandMetaValue}>All Employees</Text>
            <Text style={s.brandGenerated}>Generated {input.generatedAt}</Text>
          </View>
        </View>
        <View style={s.accentStripe} />

        <View style={s.body}>
          {/* Summary card */}
          <View style={s.summary}>
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>Total Employees</Text>
              <Text style={s.summaryValue}>{input.rows.length}</Text>
            </View>
            <View style={[s.summaryCard, { flex: 3 }]} />
          </View>

          {/* Table */}
          <View style={s.table}>
            <View style={s.thead}>
              {COLS.map((c) => (
                <Text key={c.label} style={[s.th, { width: c.w }]}>{c.label}</Text>
              ))}
            </View>
            {input.rows.map((r, i) => (
              <View key={i} style={[s.trow, i % 2 === 1 ? s.trowAlt : {}]} wrap={false}>
                <Text style={[s.tdMuted, { width: COLS[0].w }]}>{r.employeeIdCode || '-'}</Text>
                <Text style={[s.td, { width: COLS[1].w, fontFamily: 'Helvetica-Bold' }]}>{r.employeeName}</Text>
                <Text style={[s.tdMuted, { width: COLS[2].w }]}>{r.email}</Text>
                <Text style={[s.tdMuted, { width: COLS[3].w }]}>{r.phone || '-'}</Text>
                <Text style={[s.td, { width: COLS[4].w }]}>{r.department || '-'}</Text>
                <Text style={[s.td, { width: COLS[5].w }]}>{r.designation || '-'}</Text>
                <Text style={[s.tdMuted, { width: COLS[6].w }]}>{r.lineManager || '-'}</Text>
                <Text style={[s.tdMuted, { width: COLS[7].w }]}>{fmtDate(r.joiningDate)}</Text>
                <Text style={[s.tdMuted, { width: COLS[8].w }]}>{fmtDate(r.departureDate)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
