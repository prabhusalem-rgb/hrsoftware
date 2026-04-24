// ============================================================
// SettlementStatementPDF — React PDF Component
// Guaranteed single-page A4 layout.
//
// KEY DESIGN RULE (React-PDF):
//   All flex-row children that need consistent height and
//   borders MUST be <View>, never <Text>.
//   <Text> as a flex child does NOT stretch to row height.
// ============================================================

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { toOmaniWords } from '@/lib/utils/currency';
import type { SettlementStatementData } from '@/types/settlement';

// No extra font registration needed for Helvetica/Courier (built-in)

interface SettlementStatementPDFProps {
  data: SettlementStatementData;
  showWatermark?: boolean;
}

export function SettlementStatementPDF({
  data,
  showWatermark = false,
}: SettlementStatementPDFProps) {
  const { company, employee, settlement } = data;

  const earnings = [
    { label: 'Basic Salary (Pro-Rata)',           amount: settlement.final_month_salary },
    { label: `Leave Encashment (${settlement.leave_days}d)`, amount: settlement.leave_encashment },
    { label: 'End of Service Gratuity (EOSB)',    amount: settlement.eosb_amount },
    ...(settlement.additional_payments > 0
      ? [{ label: 'Additional Payments', amount: settlement.additional_payments }]
      : []),
  ].filter(e => e.amount > 0);

  const deductions = [
    ...(settlement.loan_deduction  > 0 ? [{ label: 'Loan Recovery',    amount: settlement.loan_deduction  }] : []),
    ...(settlement.other_deduction > 0 ? [{ label: 'Other Deductions', amount: settlement.other_deduction }] : []),
  ];

  const totalEarnings   = earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  // Fixed number of rows so table height is always predictable
  const MAX_ROWS = 4;
  const rows = Array.from({ length: MAX_ROWS }).map((_, i) => ({
    earning:   earnings[i]   || null,
    deduction: deductions[i] || null,
  }));

  // ── Helper: one info field (label + value, side-by-side) ─────────────────
  const InfoCell = ({
    label,
    value,
    last = false,
  }: {
    label: string;
    value: string;
    last?: boolean;
  }) => (
    <View style={[s.infoCell, last ? s.infoCellLast : {}]}>
      <View style={s.infoCellLabel}>
        <Text style={s.infoCellLabelText}>{label}</Text>
      </View>
      <View style={s.infoCellValue}>
        <Text style={s.infoCellValueText}>{value}</Text>
      </View>
    </View>
  );

  // ── Helper: one table data row ────────────────────────────────────────────
  const TableRow = ({
    earning,
    deduction,
    shaded,
  }: {
    earning:   { label: string; amount: number } | null;
    deduction: { label: string; amount: number } | null;
    shaded:    boolean;
  }) => (
    <View style={[s.tRow, shaded ? s.tRowShaded : {}]}>
      {/* Earnings label */}
      <View style={[s.tCell, s.colWide, s.cellBorderR]}>
        <Text style={s.tDataText}>{earning ? earning.label : ''}</Text>
      </View>
      {/* Earnings amount */}
      <View style={[s.tCell, s.colNarrow, s.cellBorderR]}>
        <Text style={[s.tAmtText, earning ? s.green : {}]}>
          {earning ? earning.amount.toFixed(3) : ''}
        </Text>
      </View>
      {/* Deductions label */}
      <View style={[s.tCell, s.colWide, s.cellBorderR]}>
        <Text style={s.tDataText}>{deduction ? deduction.label : ''}</Text>
      </View>
      {/* Deductions amount */}
      <View style={[s.tCell, s.colNarrow]}>
        <Text style={[s.tAmtText, deduction ? s.red : {}]}>
          {deduction ? deduction.amount.toFixed(3) : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <Document
      title={`Final Settlement - ${employee.name_en} (${employee.emp_code})`}
      author="HR System"
      subject="Final Settlement Statement"
    >
      <Page size="A4" style={s.page}>
        {/*
          Wrap everything in ONE non-splitting View.
          This is the correct React-PDF way to enforce single-page rendering:
          wrap={false} on the CONTENT view (not the page).
        */}
        <View wrap={false}>

          {/* ── WATERMARK ── */}
          {showWatermark && (
            <View style={s.watermark}>
              <Text style={s.watermarkText}>DRAFT</Text>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════
              HEADER
              Height: company 14 × 1.2 = 16.8 + CR 7×1.2=8.4 + pb5 + mb5 ≈ 35pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              {company.logo_url ? (
                <View style={s.logoContainer}>
                  <Image src={company.logo_url} style={s.logoImage} />
                </View>
              ) : null}
              <View>
                <Text style={s.companyName}>{company.name_en || 'Company'}</Text>
                <Text style={s.crNumber}>CR: {company.cr_number || 'N/A'}</Text>
              </View>
            </View>
            <View style={s.headerRight}>
              <Text style={s.dateLabel}>Statement Date</Text>
              <Text style={s.dateVal}>{format(new Date(), 'dd MMMM yyyy')}</Text>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              TITLE
              Height: pv4×2 + 9×1.2 + mb5 ≈ 24pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.titleBar}>
            <Text style={s.titleText}>FINAL SETTLEMENT STATEMENT</Text>
          </View>

          {/* ══════════════════════════════════════════════════════
              EMPLOYEE INFO — 2 pairs per row, 3 rows
              Using View cells so borders always align.
              Height: 3 rows × 13pt each + mb5 ≈ 44pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.infoBox}>
            {/* Row 1 */}
            <View style={s.infoRow}>
              <InfoCell label="Employee Code"  value={employee.emp_code} />
              <InfoCell label="Employee Name"  value={employee.name_en}  last />
            </View>
            {/* Row 2 */}
            <View style={s.infoRow}>
              <InfoCell label="Joining Date"      value={format(new Date(employee.join_date), 'dd MMM yyyy')} />
              <InfoCell label="Termination Date"  value={format(new Date(settlement.settlement_date), 'dd MMM yyyy')} last />
            </View>
            {/* Row 3 */}
            <View style={[s.infoRow, s.infoRowLast]}>
              <InfoCell label="Department"   value={employee.department  || '-'} />
              <InfoCell label="Designation"  value={employee.designation || '-'} last />
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              META BAR — dark pill with separation reason + notice
              Height: pv4×2 + max(label+val) + mb6 ≈ 30pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.metaBar}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Reason for Separation</Text>
              <Text style={s.metaVal}>{settlement.reason.replace(/_/g, ' ')}</Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Notice Period Served</Text>
              <Text style={s.metaVal}>{settlement.notice_served ? 'Yes' : 'No'}</Text>
            </View>
            {settlement.air_ticket_qty > 0 && (
              <>
                <View style={s.metaDivider} />
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Air Tickets (Info only)</Text>
                  <Text style={s.metaVal}>{settlement.air_ticket_qty.toFixed(2)} ticket(s)</Text>
                </View>
              </>
            )}
          </View>

          {/* ══════════════════════════════════════════════════════
              BREAKDOWN TABLE
              All cells are <View> so heights stretch uniformly.
              Height: header14 + 4 rows × 15pt + totals14 + mb6 ≈ 94pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.table}>
            {/* Table header */}
            <View style={[s.tRow, s.tHeadRow]}>
              <View style={[s.tHeadCell, s.colWide, s.cellBorderR]}>
                <Text style={s.tHeadText}>Earnings &amp; Entitlements</Text>
              </View>
              <View style={[s.tHeadCell, s.colNarrow, s.cellBorderR]}>
                <Text style={[s.tHeadText, s.txtR]}>OMR</Text>
              </View>
              <View style={[s.tHeadCell, s.colWide, s.cellBorderR]}>
                <Text style={s.tHeadText}>Adjustments &amp; Deductions</Text>
              </View>
              <View style={[s.tHeadCell, s.colNarrow]}>
                <Text style={[s.tHeadText, s.txtR]}>OMR</Text>
              </View>
            </View>

            {/* Data rows */}
            {rows.map(({ earning, deduction }, i) => (
              <TableRow
                key={i}
                earning={earning}
                deduction={deduction}
                shaded={i % 2 === 1}
              />
            ))}

            {/* Totals row */}
            <View style={[s.tRow, s.tTotalRow]}>
              <View style={[s.tTotalCell, s.colWide, s.cellBorderR]}>
                <Text style={s.tTotalLabelText}>Total Entitlements</Text>
              </View>
              <View style={[s.tTotalCell, s.colNarrow, s.cellBorderR]}>
                <Text style={[s.tTotalAmtText, s.green]}>{totalEarnings.toFixed(3)}</Text>
              </View>
              <View style={[s.tTotalCell, s.colWide, s.cellBorderR]}>
                <Text style={s.tTotalLabelText}>Total Deductions</Text>
              </View>
              <View style={[s.tTotalCell, s.colNarrow]}>
                <Text style={[s.tTotalAmtText, s.red]}>{totalDeductions.toFixed(3)}</Text>
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              NET AMOUNT BOX + REFERENCE SIDE PANEL
              Height: max(netBox, sidePanel) + mb6 ≈ 72pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.bottomRow}>
            {/* Net amount (left, 2/3 width) */}
            <View style={s.netBox}>
              <Text style={s.netCaption}>NET SETTLEMENT AMOUNT</Text>
              <Text style={s.netAmount}>{settlement.final_total.toFixed(3)}</Text>
              <Text style={s.netCurrency}>Omani Rial (OMR)</Text>
              <View style={s.netDivider} />
              <Text style={s.netWords}>{toOmaniWords(settlement.final_total)}</Text>
            </View>
            {/* Side panel (right, 1/3 width) */}
            <View style={s.sidePanel}>
              <Text style={s.sideLabelText}>Reference No.</Text>
              <Text style={s.sideValText}>{settlement.reference_number || '-'}</Text>
              {settlement.notes ? (
                <View style={s.sideNoteBox}>
                  <Text style={s.sideLabelText}>Remarks</Text>
                  <Text style={s.sideNoteText}>{settlement.notes}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              SIGNATURE BLOCKS — two columns
              Height: space20 + line + label + sub + mb5 ≈ 48pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.sigRow}>
            <View style={s.sigBlock}>
              <View style={s.sigSpace} />
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>Employee Acknowledgement</Text>
              <Text style={s.sigSub}>Accepted and satisfied with this settlement</Text>
            </View>
            <View style={s.sigBlock}>
              <View style={s.sigSpace} />
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>Authorized Signatory</Text>
              <Text style={s.sigSub}>On behalf of {company.name_en}</Text>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              FOOTER
              Height: border + pt4 + text ≈ 12pt
          ══════════════════════════════════════════════════════ */}
          <View style={s.footer}>
            <Text style={s.footerText}>End of Service Settlement — Confidential</Text>
            <Text style={s.footerText}>
              Generated: {format(new Date(), 'dd MMM yyyy')}
            </Text>
          </View>

        </View>{/* End wrap={false} */}
      </Page>
    </Document>
  );
}

// ============================================================
// STYLES — Premium & Elegant
// ============================================================

const DARK      = '#0f172a'; // Deep Navy Slate
const SLATE_600 = '#475569';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';
const SLATE_50  = '#f8fafc';
const GREEN     = '#065f46'; // Emerald
const RED       = '#991b1b'; // Crimson
const WHITE     = '#ffffff';

const s = StyleSheet.create({
  // ── Page
  page: {
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 24,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: DARK,
    backgroundColor: WHITE,
  },

  // ── Watermark (absolute, no layout impact)
  watermark: {
    position: 'absolute',
    top: 250,
    left: 110,
    opacity: 0.05,
  },
  watermarkText: {
    fontSize: 80,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },

  // ══ HEADER ══
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    paddingBottom: 8,
    marginBottom: 8,
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  crNumber: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_400,
    letterSpacing: 0.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  dateVal: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },

  // ══ TITLE ══
  titleBar: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: DARK,
    paddingVertical: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ══ INFO BOX ══
  infoBox: {
    borderWidth: 1,
    borderColor: SLATE_200,
    marginBottom: 10,
    borderRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    // alignItems stretch is default — all cells same height
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  // Each info pair: label + value (fills 50% of row)
  infoCell: {
    flex: 1,
    flexDirection: 'row',
    borderRightWidth: 1,
    borderRightColor: SLATE_200,
  },
  infoCellLast: {
    borderRightWidth: 0,
  },
  infoCellLabel: {
    width: 90,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: SLATE_50,
    borderRightWidth: 0.5,
    borderRightColor: SLATE_200,
    justifyContent: 'center',
  },
  infoCellLabelText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_600,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoCellValue: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  infoCellValueText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },

  metaBar: {
    flexDirection: 'row',
    backgroundColor: DARK,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'stretch',
  },
  metaItem: {
    flex: 1,
    justifyContent: 'center',
  },
  metaDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginVertical: 2,
    marginHorizontal: 8,
  },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
  },

  // ══ TABLE ══
  table: {
    borderWidth: 1,
    borderColor: DARK,
    marginBottom: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tRow: {
    flexDirection: 'row',
  },
  tHeadRow: {
    backgroundColor: DARK,
  },
  tRowShaded: {
    backgroundColor: SLATE_50,
  },
  tTotalRow: {
    borderTopWidth: 1,
    borderTopColor: DARK,
    backgroundColor: SLATE_50,
  },

  // Cell containers
  tHeadCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tCell: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderTopWidth: 0.5,
    borderTopColor: SLATE_200,
  },
  tTotalCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },

  // Cell border separator
  cellBorderR: {
    borderRightWidth: 0.5,
    borderRightColor: SLATE_200,
  },

  // Column flex widths
  colWide:   { flex: 3 },
  colNarrow: { flex: 1.2 },

  // Text inside cells
  tHeadText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tDataText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: DARK,
  },
  tAmtText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  tTotalLabelText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    textTransform: 'uppercase',
  },
  tTotalAmtText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  txtR: { textAlign: 'right' },
  green: { color: GREEN },
  red:   { color: RED },

  // ══ BOTTOM ROW (net + side panel) ══
  bottomRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  netBox: {
    flex: 2,
    backgroundColor: DARK,
    borderRadius: 4,
    padding: 12,
    marginRight: 10,
    justifyContent: 'center',
  },
  netCaption: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  netAmount: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: -0.5,
  },
  netCurrency: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: SLATE_400,
    marginTop: -2,
    marginBottom: 6,
  },
  netDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 6,
  },
  netWords: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: SLATE_400,
    fontStyle: 'italic',
  },
  sidePanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: SLATE_200,
    borderRadius: 4,
    padding: 10,
  },
  sideLabelText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: SLATE_600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sideValText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  sideNoteBox: {
    marginTop: 8,
  },
  sideNoteText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: SLATE_600,
    lineHeight: 1.4,
  },

  // ══ SIGNATURES ══
  sigRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 15,
  },
  sigBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sigSpace: {
    height: 35,
  },
  sigLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: DARK,
    marginBottom: 5,
  },
  sigLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sigSub: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: SLATE_400,
    marginTop: 2,
  },

  // ══ FOOTER ══
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: SLATE_200,
    paddingTop: 8,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: SLATE_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SettlementStatementPDF;
