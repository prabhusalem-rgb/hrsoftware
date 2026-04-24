'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Employee, Company } from '@/types';
import { format } from 'date-fns';
import { toOmaniWords } from '@/lib/utils/currency';

interface LeaveSettlementPDFProps {
  employee: Employee;
  company: Company;
  settlementData: {
    leave_from: string;
    leave_to: string;
    days_in_month: number;
    leave_days: number;
    working_days: number;
    last_salary_month: string;
    settlement_date: string;
    earnings: { label: string; full: number; actual: number }[];
    deductions: { label: string; actual: number }[];
    net_pay: number;
    notes?: string;
  };
  showLogo?: boolean;
  primaryColor?: string;
}

export function LeaveSettlementPDF({
  employee,
  company,
  settlementData,
  showLogo = true,
  primaryColor = '#1a1a1a'
}: LeaveSettlementPDFProps) {
  const { leave_from, leave_to, days_in_month, leave_days, working_days, last_salary_month, earnings, deductions, net_pay, notes } = settlementData;

  const formatOMR = (val: number) => Number(val || 0).toFixed(3);

  const styles = getStyles(primaryColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== HEADER - Professional Top Section ===== */}
        <View style={styles.headerSection}>
          <View style={styles.headerLine} />
          <View style={styles.headerContent}>
            {showLogo && (
              company?.logo_url ? (
                <View style={styles.logoContainer}>
                  <Image src={company.logo_url} style={styles.logoImage} />
                </View>
              ) : company?.name_en ? (
                <View style={styles.logoLetterContainer}>
                  <Text style={styles.logoLetter}>{company.name_en.charAt(0).toUpperCase()}</Text>
                </View>
              ) : null
            )}
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{company?.name_en || 'BRIGHTFLOWERS TRADING LLC'}</Text>
              <Text style={styles.companyAddressLine}>{company?.address || 'PO Box - 51, Postal Code - 617, Muscat, Sultanate of Oman'}</Text>
              <View style={styles.contactRow}>
                {company?.contact_phone && <Text style={styles.contactText}>Tel: {company.contact_phone}</Text>}
                {company?.contact_email && <Text style={styles.contactText}> • Email: {company.contact_email}</Text>}
              </View>
            </View>
          </View>
        </View>

        {/* ===== DOCUMENT TITLE ===== */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>LEAVE SETTLEMENT STATEMENT</Text>
          <Text style={styles.docRef}>Ref: LS-{employee.emp_code}-{format(new Date(), 'yyyyMMdd')}</Text>
        </View>

        {/* ===== EMPLOYEE & SETTLEMENT INFO - Two Column ===== */}
        <View style={styles.infoGrid}>
          {/* Employee Information */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderText}>EMPLOYEE INFORMATION</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Employee Code</Text>
                <Text style={styles.fieldValue}>{employee.emp_code}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <Text style={[styles.fieldValue, styles.fieldValueBold]}>{employee.name_en}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Designation</Text>
                <Text style={styles.fieldValue}>{employee.designation || '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Department</Text>
                <Text style={styles.fieldValue}>{employee.department || '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date of Joining</Text>
                <Text style={styles.fieldValue}>{employee.join_date ? format(new Date(employee.join_date), 'dd/MM/yyyy') : '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Category</Text>
                <Text style={[styles.fieldValue, { textTransform: 'capitalize' }]}>{employee.category?.replace('_', ' ') || '-'}</Text>
              </View>
            </View>
          </View>

          {/* Settlement Details */}
          <View style={styles.card}>
            <View style={[styles.cardHeader, { backgroundColor: '#374151' }]}>
              <Text style={styles.cardHeaderText}>SETTLEMENT DETAILS</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Leave From</Text>
                <Text style={styles.fieldValue}>{settlementData.leave_from ? format(new Date(settlementData.leave_from), 'dd/MM/yyyy') : '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Leave To</Text>
                <Text style={styles.fieldValue}>{settlementData.leave_to ? format(new Date(settlementData.leave_to), 'dd/MM/yyyy') : '-'}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Leave Days</Text>
                <Text style={[styles.fieldValue, styles.fieldValueBold, { color: '#1a1a1a' }]}>{settlementData.leave_days} Days</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Working Days</Text>
                <Text style={[styles.fieldValue, styles.fieldValueBold]}>{settlementData.working_days} Days</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Days in Month</Text>
                <Text style={styles.fieldValue}>{settlementData.days_in_month}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Last Paid Month</Text>
                <Text style={styles.fieldValue}>{settlementData.last_salary_month}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Settlement Date</Text>
                <Text style={styles.fieldValue}>{format(new Date(settlementData?.settlement_date || new Date()), 'dd/MM/yyyy')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== EARNINGS TABLE ===== */}
        <View style={styles.tableSection}>
          <View style={styles.tableTitleRow}>
            <Text style={styles.tableTitleText}>EARNINGS BREAKDOWN</Text>
          </View>
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Component</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Full</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Pro-rata</Text>
          </View>
          {/* Table Rows */}
          {earnings.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2.5, fontWeight: 500 }]}>{item.label}</Text>
              <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right' }]}>{formatOMR(item.full)}</Text>
              <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right', fontWeight: 700 }]}>{formatOMR(item.actual)}</Text>
            </View>
          ))}
          {/* Deductions Section (if any) */}
          {deductions && deductions.length > 0 && (
            <View>
              <View style={styles.tableTitleRow}>
                <Text style={styles.tableTitleText}>DEDUCTIONS</Text>
              </View>
              {deductions.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2.5, fontWeight: 500 }]}>{item.label}</Text>
                  <Text style={[styles.tableCell, styles.mono, { flex: 1 }]}></Text>
                  <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right', fontWeight: 700, color: '#DC2626' }]}>-{formatOMR(item.actual)}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { flex: 2.5 }]}>NET SETTLEMENT</Text>
            <Text style={[styles.totalValue, { flex: 1 }]}>{formatOMR(settlementData.net_pay)}</Text>
            <Text style={[styles.totalValue, { flex: 1, fontWeight: 700 }]}>{formatOMR(settlementData.net_pay)}</Text>
          </View>
        </View>

        {/* ===== NET AMOUNT - Prominent Banner ===== */}
        <View style={styles.netBanner}>
          <View>
            <Text style={styles.netLabel}>NET SETTLEMENT AMOUNT</Text>
            <Text style={styles.netValue}>OMR {formatOMR(settlementData.net_pay)}</Text>
          </View>
          <View style={styles.netWordsContainer}>
            <Text style={styles.netWordsLabel}>In Words:</Text>
            <Text style={styles.netWordsText}>{toOmaniWords(settlementData.net_pay)} Only</Text>
          </View>
        </View>

        {/* ===== DECLARATION ===== */}
        <View style={styles.declarationBox}>
          <Text style={styles.declTitle}>DECLARATION</Text>
          <Text style={styles.declText}>
            This settlement is computed as per company policy and Omani Labour Law
            (Royal Decree No. 53/2023). The amount stated above is final and conclusive
            for the specified leave period.
          </Text>
        </View>

        {/* ===== SIGNATURES ===== */}
        <View style={styles.signatureSection}>
          <View style={styles.sigRow}>
            <View style={styles.sigCol}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Prepared By</Text>
              <Text style={styles.sigRole}>HR Department</Text>
            </View>
            <View style={styles.sigCol}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Verified By</Text>
              <Text style={styles.sigRole}>Finance Department</Text>
            </View>
            <View style={styles.sigCol}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Approved By</Text>
              <Text style={styles.sigRole}>Management</Text>
            </View>
          </View>
        </View>

        {/* ===== PAGE FOOTER ===== */}
        <View style={styles.pageFooter}>
          <Text style={styles.footerTextLeft}>Generated: {format(new Date(), 'dd/MM/yyyy • HH:mm')}</Text>
          <Text style={styles.footerTextRight}>HR Software • WPS Compliant</Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================
// MODERN ELEGANT STYLES
// Optimized for B&W printing - high contrast
// ============================================
const getStyles = (primaryColor: string) =>
  StyleSheet.create({
    page: {
      padding: 0,
      fontFamily: 'Helvetica',
      fontSize: 9,
      lineHeight: 1.35,
      backgroundColor: '#FFFFFF',
    },

    // ===== Header Section =====
    headerSection: {
      paddingBottom: 10,
    },
    headerLine: {
      height: 3,
      backgroundColor: '#1a1a1a',
      marginBottom: 12,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 22,
      gap: 14,
    },
    logoContainer: {
      width: 50,
      height: 50,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    },
    logoLetterContainer: {
      width: 42,
      height: 42,
      borderRadius: 8,
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    logoLetter: {
      fontSize: 24,
      fontWeight: 700,
      color: '#FFFFFF',
      fontFamily: 'Helvetica-Bold',
    },
    companyDetails: {
      flex: 1,
    },
    companyName: {
      fontSize: 14.5,
      fontWeight: 700,
      color: '#1a1a1a',
      letterSpacing: 0.2,
    },
    companyAddressLine: {
      fontSize: 8.5,
      color: '#555555',
      marginTop: 2,
    },
    contactRow: {
      flexDirection: 'row',
      marginTop: 2,
      gap: 4,
    },
    contactText: {
      fontSize: 8,
      color: '#555555',
    },

    // ===== Title Section =====
    titleSection: {
      marginHorizontal: 18,
      marginTop: 14,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderWidth: 2,
      borderColor: '#1a1a1a',
      backgroundColor: '#F9FAFB',
    },
    titleText: {
      fontSize: 12.5,
      fontWeight: 700,
      color: '#1a1a1a',
      letterSpacing: 1.5,
      textAlign: 'center',
    },
    docRef: {
      fontSize: 7.5,
      color: '#555555',
      fontFamily: 'Courier',
      textAlign: 'right',
      marginTop: 3,
    },

    // ===== Info Grid =====
    infoGrid: {
      flexDirection: 'row',
      gap: 11,
      marginHorizontal: 18,
      marginTop: 12,
    },
    card: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 6,
      overflow: 'hidden',
    },
    cardHeader: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: '#1a1a1a',
    },
    cardHeaderText: {
      fontSize: 7.5,
      fontWeight: 700,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    cardBody: {
      padding: 10,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
      alignItems: 'flex-end',
    },
    fieldLabel: {
      fontSize: 7.5,
      color: '#555555',
      fontWeight: 500,
    },
    fieldValue: {
      fontSize: 8.5,
      color: '#1a1a1a',
      fontWeight: 500,
      textAlign: 'right',
    },
    fieldValueBold: {
      fontWeight: 700,
    },

    // ===== Table Section =====
    tableSection: {
      marginHorizontal: 18,
      marginTop: 12,
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 4,
      overflow: 'hidden',
    },
    tableTitleRow: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#1a1a1a',
      backgroundColor: '#F3F4F6',
    },
    tableTitleText: {
      fontSize: 8,
      fontWeight: 700,
      color: '#1a1a1a',
      letterSpacing: 0.5,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#1a1a1a',
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    tableHeaderCell: {
      fontSize: 7.5,
      fontWeight: 700,
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
      minHeight: 18,
    },
    tableCell: {
      fontSize: 8,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    mono: {
      fontFamily: 'Courier',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 10,
      backgroundColor: '#F9FAFB',
      borderTopWidth: 2,
      borderTopColor: '#1a1a1a',
    },
    totalLabel: {
      fontSize: 8,
      fontWeight: 700,
      color: '#1a1a1a',
    },
    totalValue: {
      fontSize: 9,
      fontWeight: 700,
      color: '#1a1a1a',
    },

    // ===== Net Banner =====
    netBanner: {
      marginHorizontal: 18,
      marginTop: 12,
      padding: 12,
      borderWidth: 2,
      borderColor: '#1a1a1a',
      borderRadius: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
    },
    netLabel: {
      fontSize: 8,
      fontWeight: 700,
      color: '#1a1a1a',
      letterSpacing: 1,
    },
    netValue: {
      fontSize: 20,
      fontWeight: 700,
      color: '#1a1a1a',
      fontFamily: 'Courier-Bold',
    },
    netWordsContainer: {
      alignItems: 'flex-end',
    },
    netWordsLabel: {
      fontSize: 7,
      color: '#555555',
      fontWeight: 700,
    },
    netWordsText: {
      fontSize: 8,
      color: '#1a1a1a',
      fontStyle: 'italic',
      maxWidth: 200,
    },

    // ===== Declaration =====
    declarationBox: {
      marginHorizontal: 18,
      marginTop: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 4,
      backgroundColor: '#F9FAFB',
    },
    declTitle: {
      fontSize: 7.5,
      fontWeight: 700,
      color: '#1a1a1a',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    declText: {
      fontSize: 8,
      color: '#374151',
      lineHeight: 1.4,
    },

    // ===== Signatures =====
    signatureSection: {
      marginHorizontal: 18,
      marginTop: 30,
      paddingTop: 12,
    },
    sigRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sigCol: {
      width: '30%',
      alignItems: 'center',
    },
    sigLine: {
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: '#1a1a1a',
      marginBottom: 6,
    },
    sigLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: '#1a1a1a',
      letterSpacing: 0.5,
    },
    sigRole: {
      fontSize: 6.5,
      color: '#555555',
      marginTop: 2,
    },

    // ===== Page Footer =====
    pageFooter: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      borderTopWidth: 0.5,
      borderTopColor: '#D1D5DB',
      paddingTop: 6,
    },
    footerTextLeft: {
      fontSize: 6.5,
      color: '#6B7280',
      fontFamily: 'Courier',
    },
    footerTextRight: {
      fontSize: 6.5,
      color: '#6B7280',
      fontFamily: 'Courier',
      letterSpacing: 0.2,
    },
  });
