'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Company } from '@/types';
import { format } from 'date-fns';

const BRAND = '#0891b2';
const BRAND_DARK = '#0e7490';
const SLATE = '#475569';
const SLATE_LIGHT = '#64748b';
const SLATE_DARK = '#0f172a';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';

interface OfferLetterPDFProps {
  company: Company;
  candidate: {
    name: string;
    nationality: string;
    passport_no: string;
    designation: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    probation_period: string;
    notice_period: string;
    join_date: string;
    air_ticket_frequency: string;
    additional_points?: string[];
  };
}

export function OfferLetterPDF({ company, candidate }: OfferLetterPDFProps) {
  const totalGross = candidate.basic_salary + candidate.housing_allowance + candidate.transport_allowance + candidate.other_allowance;

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const styles = getStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top accent line */}
        <View style={styles.topLine} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.companyIdentity}>
              <View style={styles.companyLogo}>
                <Text style={styles.logoText}>{company?.name_en?.charAt(0) || 'C'}</Text>
              </View>
              <View style={styles.companyNameBlock}>
                <Text style={styles.companyName}>{company?.name_en || 'COMPANY'}</Text>
                {company?.trade_name && <Text style={styles.companyTrade}>{company.trade_name}</Text>}
              </View>
            </View>
            <View style={styles.metaInfo}>
              <View style={styles.metaWrapper}>
                <Text style={styles.metaLabel}>REF</Text>
                <Text style={styles.metaValue}>OM/HR/{new Date().getFullYear()}/{String(Math.floor(Math.random() * 10000)).padStart(4, '0')}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaWrapper}>
                <Text style={styles.metaLabel}>DATE</Text>
                <Text style={styles.metaValue}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* To */}
          <View style={styles.toBlock}>
            <Text style={styles.toLabel}>TO:</Text>
            <Text style={styles.recipientName}>{candidate.name}</Text>
            <Text style={styles.recipientMeta}>Passport: {candidate.passport_no} · Nationality: {candidate.nationality} · Position: {candidate.designation}</Text>
          </View>

          {/* Subject */}
          <View style={styles.subjectBlock}>
            <Text style={styles.subjectText}>OFFER OF EMPLOYMENT</Text>
          </View>

          {/* Salutation */}
          <Text style={styles.salutation}>Dear {candidate.name.split(' ')[0] || candidate.name},</Text>

          {/* Opening */}
          <Text style={styles.opening}>
            We are pleased to formally offer you the position of{' '}
            <Text style={styles.emphasis}>{candidate.designation}</Text> at{' '}
            <Text style={styles.companyEmphasis}>{company?.name_en}</Text>. Please review the terms and conditions of your employment as outlined below.
          </Text>

          {/* Compensation */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionNumberBg}><Text style={styles.sectionNumber}>01</Text></View>
              <Text style={styles.sectionTitle}>Compensation & Benefits</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Your monthly gross compensation package is as follows:</Text>
            <View style={styles.tableFrame}>
              <View style={styles.compTable}>
                <View style={styles.tableHeaderRow}>
                  <View style={styles.thCell}><Text style={styles.thLabel}>Component</Text></View>
                  <View style={styles.thCellRight}><Text style={styles.thLabel}>Amount (OMR)</Text></View>
                </View>
                <View style={styles.tableRow}><View style={styles.tdCell}><Text style={styles.tdLabel}>Basic Salary</Text></View><View style={styles.tdCellRight}><Text style={styles.tdAmount}>{candidate.basic_salary.toFixed(3)}</Text></View></View>
                <View style={[styles.tableRow, styles.rowShade]}><View style={styles.tdCell}><Text style={styles.tdLabel}>Housing Allowance</Text></View><View style={styles.tdCellRight}><Text style={styles.tdAmount}>{candidate.housing_allowance.toFixed(3)}</Text></View></View>
                <View style={styles.tableRow}><View style={styles.tdCell}><Text style={styles.tdLabel}>Transport Allowance</Text></View><View style={styles.tdCellRight}><Text style={styles.tdAmount}>{candidate.transport_allowance.toFixed(3)}</Text></View></View>
                {candidate.other_allowance > 0 && (
                  <View style={[styles.tableRow, styles.rowShade]}><View style={styles.tdCell}><Text style={styles.tdLabel}>Other Allowance</Text></View><View style={styles.tdCellRight}><Text style={styles.tdAmount}>{candidate.other_allowance.toFixed(3)}</Text></View></View>
                )}
                <View style={[styles.tableRow, styles.totalRow]}><View style={styles.tdCell}><Text style={styles.totalLabel}>TOTAL GROSS</Text></View><View style={styles.tdCellRight}><Text style={styles.totalAmount}>{totalGross.toFixed(3)}</Text></View></View>
              </View>
            </View>
          </View>

          {/* Terms */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionNumberBg}><Text style={styles.sectionNumber}>02</Text></View>
              <Text style={styles.sectionTitle}>Employment Terms</Text>
            </View>

            {/* Terms Grid - Modern Card Layout */}
            <View style={styles.termsGrid}>
              {/* Row 1: Probation Period */}
              <View style={styles.termCard}>
                <View style={styles.termCardHeader}>
                  <View style={styles.termDot} />
                  <Text style={styles.termCardLabel}>Probation Period</Text>
                </View>
                <Text style={styles.termCardValue}>{candidate.probation_period}</Text>
                <Text style={styles.termCardDesc}>From joining date; notice period follows Omani Labor Law</Text>
              </View>

              {/* Row 1: Notice Period */}
              <View style={styles.termCard}>
                <View style={styles.termCardHeader}>
                  <View style={styles.termDot} />
                  <Text style={styles.termCardLabel}>Notice Period</Text>
                </View>
                <Text style={styles.termCardValue}>{candidate.notice_period}</Text>
                <Text style={styles.termCardDesc}>Post-probation for resignation or termination</Text>
              </View>

              {/* Row 2: Medical Coverage */}
              <View style={styles.termCard}>
                <View style={styles.termCardHeader}>
                  <View style={styles.termDot} />
                  <Text style={styles.termCardLabel}>Medical Coverage</Text>
                </View>
                <Text style={styles.termCardValue}>Comprehensive</Text>
                <Text style={styles.termCardDesc}>Company-provided medical insurance throughout employment</Text>
              </View>

              {/* Row 2: Annual Leave */}
              <View style={styles.termCard}>
                <View style={styles.termCardHeader}>
                  <View style={styles.termDot} />
                  <Text style={styles.termCardLabel}>Annual Leave</Text>
                </View>
                <Text style={styles.termCardValue}>30 days/year</Text>
                <Text style={styles.termCardDesc}>Paid leave for each completed year of service</Text>
              </View>

              {/* Row 3: Air Ticket (Full Width) */}
              <View style={[styles.termCard, styles.termCardFull]}>
                <View style={styles.termCardHeader}>
                  <View style={styles.termDot} />
                  <Text style={styles.termCardLabel}>Air Ticket</Text>
                </View>
                <Text style={styles.termCardValue}>Economy class return ticket</Text>
                <Text style={styles.termCardDesc}>To home country {candidate.air_ticket_frequency.toLowerCase()}</Text>
              </View>

              {/* Row 4: Repayment Obligation (Full Width - Darker) */}
              <View style={[styles.termCard, styles.termCardFull, styles.termCardImportant]}>
                <View style={styles.termCardHeader}>
                  <View style={[styles.termDot, { backgroundColor: '#dc2626' }]} />
                  <Text style={[styles.termCardLabel, { color: '#991b1b' }]}>Repayment Obligation</Text>
                </View>
                <Text style={styles.termCardValue}>Reimbursement Required</Text>
                <Text style={styles.termCardDesc}>Resignation within 2 years requires repayment of recruitment fees, visa costs, and flight expenses</Text>
              </View>

              {/* Additional Terms */}
              {candidate.additional_points && candidate.additional_points.length > 0 && candidate.additional_points.map((point, idx) => (
                <View key={idx} style={[styles.termCard, styles.termCardFull, styles.termCardAdditional]}>
                  <View style={styles.termCardHeader}>
                    <View style={styles.termDot} />
                    <Text style={styles.termCardLabel}>Additional Term {idx + 1}</Text>
                  </View>
                  <Text style={styles.termCardDesc}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}><View style={styles.signatureUnderline} /><Text style={styles.sigName}>{company?.name_en}</Text><Text style={styles.sigTitle}>Authorized Signatory</Text></View>
          <View style={styles.sigDivider} />
          <View style={styles.signatureBlock}><View style={[styles.signatureUnderline, { borderBottomColor: BRAND }]} /><Text style={styles.sigName}>{candidate.name}</Text><Text style={styles.sigTitle}>Candidate Acceptance</Text></View>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} {company?.name_en || 'COMPANY'} · Confidential</Text>
        </View>
      </Page>
    </Document>
  );
}

function getStyles() {
  return StyleSheet.create({
    page: {
      padding: 0,
      margin: 0,
      fontFamily: 'Helvetica',
      fontSize: 8,
      lineHeight: 1.35,
      color: SLATE,
      backgroundColor: '#ffffff',
    },

    topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: BRAND },

    header: {
      backgroundColor: GRAY_50,
      paddingTop: 8,
      paddingBottom: 6,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: GRAY_200,
    },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    companyIdentity: { flexDirection: 'row', alignItems: 'center' },
    companyLogo: {
      width: 24, height: 24, borderRadius: 6, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
      marginRight: 6, shadowColor: BRAND, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowBlur: 2,
    },
    logoText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
    companyNameBlock: {},
    companyName: { fontSize: 9, fontWeight: 'bold', color: SLATE_DARK },
    companyTrade: { fontSize: 5, color: SLATE_LIGHT, letterSpacing: 0.8, textTransform: 'uppercase' },
    companyEmphasis: { fontWeight: 'bold' },
    metaInfo: { alignItems: 'flex-end' },
    metaWrapper: { alignItems: 'flex-end', marginBottom: 2 },
    metaLabel: { fontSize: 4, fontWeight: 'bold', color: SLATE_LIGHT, letterSpacing: 0.8, marginBottom: 1 },
    metaValue: { fontSize: 7, fontWeight: 'bold', color: SLATE_DARK, fontFamily: 'Courier', backgroundColor: GRAY_100, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },
    metaDivider: { width: 1, height: 10, backgroundColor: GRAY_200, marginBottom: 2 },

    body: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20 },

    toBlock: { marginBottom: 10 },
    toLabel: { fontSize: 4.5, fontWeight: 'bold', color: BRAND, letterSpacing: 0.8, marginBottom: 1 },
    recipientName: { fontSize: 10, fontWeight: 'bold', color: SLATE_DARK, marginBottom: 1 },
    recipientMeta: { fontSize: 7, color: SLATE_LIGHT },

    subjectBlock: {
      marginBottom: 6, paddingVertical: 3, borderTopWidth: 2, borderTopColor: BRAND, borderBottomWidth: 2, borderBottomColor: BRAND,
      alignItems: 'center', backgroundColor: '#f0f9ff', marginHorizontal: -14, paddingHorizontal: 14,
    },
    subjectText: { fontSize: 10, fontWeight: 'bold', color: SLATE_DARK, letterSpacing: 1.5 },

    salutation: { fontSize: 8, color: SLATE, marginBottom: 6 },
    opening: { fontSize: 7.5, lineHeight: 1.4, marginBottom: 10, textAlign: 'justify', color: SLATE },
    emphasis: { fontWeight: 'bold' },

    section: { marginBottom: 10 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    sectionNumberBg: { backgroundColor: BRAND, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6, shadowColor: BRAND, shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.1, shadowBlur: 1 },
    sectionNumber: { fontSize: 7, fontWeight: 'bold', color: 'white' },
    sectionTitle: { fontSize: 8, fontWeight: 'bold', color: SLATE_DARK },
    sectionSubtitle: { fontSize: 5.5, color: SLATE_LIGHT, fontStyle: 'italic', marginBottom: 4 },

    tableFrame: { borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: GRAY_200, backgroundColor: '#ffffff' },
    compTable: { width: '100%' },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: GRAY_100, borderBottomWidth: 1, borderBottomColor: GRAY_200 },
    thCell: { flex: 2, paddingVertical: 4, paddingHorizontal: 8 },
    thCellRight: { width: 90, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'flex-end' },
    thLabel: { fontSize: 5, fontWeight: 'bold', color: SLATE_LIGHT, textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_100 },
    rowShade: { backgroundColor: '#fafbfc' },
    tdCell: { flex: 2, paddingVertical: 4, paddingHorizontal: 8 },
    tdCellRight: { width: 90, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'flex-end' },
    tdLabel: { fontSize: 7.5, color: SLATE },
    tdAmount: { fontSize: 7.5, fontWeight: 600, color: SLATE_DARK, fontFamily: 'Courier' },
    totalRow: { backgroundColor: '#f0f9ff', borderBottomWidth: 0 },
    totalLabel: { fontSize: 8, fontWeight: 'bold', color: BRAND_DARK },
    totalAmount: { fontSize: 9, fontWeight: 'bold', color: BRAND_DARK },

    clauseBox: { backgroundColor: '#fef2f2', borderLeftWidth: 2, borderLeftColor: '#dc2626', borderRadius: 3, padding: 5, marginTop: 8, marginBottom: 8 },
    clauseHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    clauseBadge: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
    clauseBadgeText: { color: 'white', fontSize: 8, fontWeight: 'bold', fontStyle: 'italic', lineHeight: 1 },
    clauseTitleText: { fontSize: 7, fontWeight: 'bold', color: '#dc2626' },
    clauseBody: { fontSize: 6.5, lineHeight: 1.3, color: SLATE },

    additionalBox: { backgroundColor: '#f0f9ff', borderRadius: 3, padding: 5, marginTop: 6 },
    additionalHeading: { fontSize: 6.5, fontWeight: 'bold', color: BRAND_DARK, letterSpacing: 0.2, marginBottom: 5, textTransform: 'uppercase' },
    additionalRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
    addNumberCircle: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    addNumberText: { color: 'white', fontSize: 5, fontWeight: 'bold' },
    addPointText: { flex: 1, fontSize: 6.5, lineHeight: 1.1, color: SLATE },

    closingBlock: { marginTop: 6, padding: 5, backgroundColor: GRAY_50, borderRadius: 3, borderLeftWidth: 2, borderLeftColor: BRAND },
    closingText: { fontSize: 6.5, lineHeight: 1.3, color: SLATE, textAlign: 'center', fontStyle: 'italic' },

    /* Employment Terms Grid Styles */
    termsGrid: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 5,
    },
    termCard: {
      width: '48%',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: GRAY_200,
      borderRadius: 4,
      padding: 5,
      marginBottom: 0,
    },
    termCardFull: {
      width: '100%',
    },
    termCardImportant: {
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
    },
    termCardAdditional: {
      backgroundColor: '#f0f9ff',
      borderColor: '#bae6fd',
    },
    termCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 3,
    },
    termDot: {
      width: 3.5,
      height: 3.5,
      borderRadius: 1.75,
      backgroundColor: BRAND,
      marginRight: 5,
      flexShrink: 0,
    },
    termCardLabel: {
      fontSize: 5,
      fontWeight: 'bold',
      color: SLATE_LIGHT,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    termCardValue: {
      fontSize: 8,
      fontWeight: 'bold',
      color: SLATE_DARK,
      marginBottom: 2,
    },
    termCardDesc: {
      fontSize: 6,
      lineHeight: 1.3,
      color: SLATE,
    },

    signatureArea: {
      flexDirection: 'row', marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: GRAY_200,
      justifyContent: 'space-between', paddingHorizontal: 10,
    },
    signatureBlock: { alignItems: 'center', flex: 1 },
    signatureUnderline: { width: '55%', borderBottomWidth: 1, borderBottomColor: SLATE_DARK, marginBottom: 2 },
    sigName: { fontSize: 7.5, fontWeight: 'bold', color: SLATE_DARK },
    sigTitle: { fontSize: 5, color: SLATE_LIGHT, letterSpacing: 0.2, textTransform: 'uppercase', marginTop: 1 },
    sigDivider: { width: 1, backgroundColor: GRAY_200 },

    pageFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: SLATE_DARK, paddingVertical: 6 },
    footerText: { fontSize: 5, fontWeight: 'bold', color: '#94a3b8', fontStyle: 'italic', letterSpacing: 0.5, textAlign: 'center' },
  });
}
