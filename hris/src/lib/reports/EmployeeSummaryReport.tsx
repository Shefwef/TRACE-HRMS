import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { brand, BrandHeader, BrandFooter } from './theme';

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
// Labels mirror the Excel sheet (EMPLOYEE_DIRECTORY_COLS in builders.ts).

const COLS = [
  { label: 'Employee ID',   w: '8%'  },
  { label: 'Employee Name', w: '14%' },
  { label: 'Email',         w: '18%' },
  { label: 'Phone Number',  w: '9%'  },
  { label: 'Department',    w: '11%' },
  { label: 'Designation',   w: '12%' },
  { label: 'Line Manager',  w: '12%' },
  { label: 'Joining Date',  w: '8%'  },
  { label: 'Exit Date',     w: '8%'  },
];

// ─── styles ───────────────────────────────────────────────

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
  td: { fontSize: 8, color: brand.text },
  tdMuted: { fontSize: 8, color: brand.soft },
});

// ─── component ────────────────────────────────────────────

export function EmployeeSummaryReport(input: EmployeeSummaryReportInput) {
  return (
    <Document title="Employee Summary" author="TRACE HRMS">
      <Page size="A4" orientation="landscape" style={s.page}>
        <BrandHeader
          title="Employee Summary"
          metaLabel="COMPANY DIRECTORY"
          metaValue="All Employees"
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

        <BrandFooter generatedAt={input.generatedAt} />
      </Page>
    </Document>
  );
}
