'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Employee, Company } from '@/types';
import { format } from 'date-fns';

interface RejoiningReportPDFProps {
  employee: Employee;
  company: Company;
  rejoinDate: string;
  showLogo?: boolean;
  primaryColor?: string;
}

export function RejoiningReportPDF({
  employee,
  company,
  rejoinDate,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: RejoiningReportPDFProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const styles = getStyles(primaryColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showLogo && (
              company?.logo_url ? (
                <View style={styles.logoContainer}>
                  <Image src={company.logo_url} style={styles.logoImage} />
                </View>
              ) : company?.name_en?.charAt(0) ? (
                <View style={[styles.logo, { backgroundColor: primaryColor }]}>
                  <Text style={styles.logoText}>{company.name_en.charAt(0)}</Text>
                </View>
              ) : null
            )}
            <View style={styles.headerText}>
              <Text style={styles.companyName}>{company?.name_en || 'COMPANY NAME'}</Text>
              {company?.trade_name && <Text style={styles.companyTrade}>{company.trade_name}</Text>}
              <Text style={styles.companyAddress}>{company?.address || 'PO BOX - 51, POSTAL CODE - 617, MUSCAT, OMAN'}</Text>
              {company?.contact_phone && <Text style={styles.companyContact}>Tel: {company.contact_phone}</Text>}
              {company?.cr_number && <Text style={styles.companyCR}>CR No: {company.cr_number}</Text>}
            </View>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.badgeTitle}>RE-JOINING REPORT</Text>
            <Text style={styles.badgeDate}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.title}>Employee Rejoining Confirmation</Text>
          <Text style={styles.subtitle}>Return from Leave / Assumption of Duties</Text>
        </View>

        {/* 1. Employee Identification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. EMPLOYEE DETAILS</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Employee Code</Text><Text style={[styles.value, styles.mono]}>{employee.emp_code}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Full Name</Text><Text style={[styles.value, styles.bold]}>{employee.name_en}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{employee.designation}</Text></View>
            </View>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Department</Text><Text style={styles.value}>{employee.department || 'GENERAL OPERATIONS'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Category</Text><Text style={[styles.value, styles.italic]}>{employee.category.toUpperCase()}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Nationality</Text><Text style={styles.value}>{employee.nationality}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Previous Status</Text><Text style={styles.badge}>{employee.status.replace('_', ' ').toUpperCase()}</Text></View>
            </View>
          </View>
        </View>

        {/* 2. Rejoining Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. REJOINING PARTICULARS</Text>
          <View style={styles.narrative}>
            <Text style={styles.paragraph}>
              This is to certify that the above-named employee has resumed active duty on{' '}
              <Text style={[styles.value, styles.bold, { color: primaryColor }]}>{formatDate(rejoinDate)}</Text>{' '}
              following an authorized leave period.
            </Text>
            <Text style={styles.paragraph}>
              The employee has returned to their assigned responsibilities in compliance with company policies and
              the Sultanate of Oman Labor Law regulations regarding leave and rejoining procedures.
            </Text>
          </View>

          <View style={[styles.infoBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={[styles.infoBoxTitle, { color: '#15803d' }]}>RETURN TO SERVICE CONFIRMED</Text>
            <Text style={styles.infoBoxText}>
              Employee has physically reported for duty and resumed all assigned tasks. Employment status has been
              updated to ACTIVE effective from {formatDate(rejoinDate)}.
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>HR Manager</Text>
            <Text style={styles.signatureSubtitle}>Authorized Rejoining Approval</Text>
            <Text style={styles.signatureDate}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={[styles.signatureLine, { borderBottomColor: primaryColor }]} />
            <Text style={styles.signatureTitle}>Employee</Text>
            <Text style={styles.signatureSubtitle}>Confirmation of Return</Text>
            <Text style={styles.signatureDate}>Date: _________________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>© {new Date().getFullYear()} {company?.name_en || 'COMPANY'} • REJOINING RECORD</Text>
          <Text style={styles.footerRight}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
        </View>
      </Page>
    </Document>
  );
}

function getStyles(primaryColor: string) {
  return StyleSheet.create({
    page: {
      padding: 25,
      fontFamily: 'Helvetica',
      fontSize: 9,
      lineHeight: 1.35,
      color: '#1e293b',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
      borderBottomWidth: 2,
      borderBottomColor: '#000',
      paddingBottom: 10,
    },
    headerLeft: {
      flex: 1,
      paddingRight: 10,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    logoText: {
      color: 'white',
      fontSize: 20,
      fontWeight: 'bold',
    },
    logoContainer: {
      width: 60,
      height: 60,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    },
    headerText: {
      marginTop: 8,
    },
    companyName: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    companyTrade: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      marginBottom: 3,
    },
    companyAddress: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      lineHeight: 1.3,
    },
    companyContact: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 2,
    },
    companyCR: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 2,
    },
    headerBadge: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      backgroundColor: primaryColor,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
    },
    badgeTitle: {
      color: 'white',
      fontSize: 9,
      fontWeight: 'bold',
      textAlign: 'right',
      marginBottom: 2,
    },
    badgeDate: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    },
    titleBox: {
      marginBottom: 12,
      alignItems: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
      borderTopWidth: 2,
      borderBottomWidth: 2,
      borderColor: primaryColor,
      paddingVertical: 6,
      letterSpacing: 1,
      width: '100%',
    },
    subtitle: {
      fontSize: 9,
      color: '#64748b',
      marginTop: 4,
      textAlign: 'center',
    },
    section: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      marginBottom: 6,
      backgroundColor: '#f8fafc',
      padding: '3 6',
      borderRadius: 3,
    },
    row: {
      flexDirection: 'row',
    },
    col: {
      paddingRight: 15,
    },
    field: {
      marginBottom: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 7,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      marginRight: 8,
      flexShrink: 0,
    },
    value: {
      fontSize: 8,
      color: '#1e293b',
      textAlign: 'right',
      flex: 1,
    },
    bold: {
      fontWeight: 'bold',
    },
    uppercase: {
      textTransform: 'uppercase',
    },
    italic: {
      fontStyle: 'italic',
    },
    rtl: {
      direction: 'rtl',
    },
    mono: {
      fontFamily: 'Courier',
      fontSize: 8,
    },
    badge: {
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
      fontSize: 7,
      fontWeight: 'bold',
      color: '#475569',
      textTransform: 'uppercase',
    },
    narrative: {
      marginVertical: 10,
    },
    paragraph: {
      marginBottom: 10,
      textAlign: 'justify',
      fontSize: 9,
      lineHeight: 1.4,
    },
    infoBox: {
      padding: 10,
      borderRadius: 6,
      borderWidth: 1,
      marginVertical: 10,
    },
    infoBoxTitle: {
      fontSize: 9,
      fontWeight: 'bold',
      marginBottom: 4,
      textAlign: 'center',
    },
    infoBoxText: {
      fontSize: 8,
      textAlign: 'center',
      lineHeight: 1.4,
    },
    table: {
      width: '100%',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 5,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      padding: 5,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      padding: 4,
    },
    tableTotal: {
      backgroundColor: '#f8fafc',
      borderBottomWidth: 0,
    },
    tableCell: {
      fontSize: 8,
      color: '#374151',
      paddingHorizontal: 6,
    },
    totalLabel: {
      fontWeight: 'bold',
      fontSize: 9,
    },
    totalValue: {
      fontWeight: 'bold',
      fontSize: 9,
      color: primaryColor,
    },
    signatureSection: {
      flexDirection: 'row',
      marginTop: 40,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
    },
    signatureBlock: {
      flex: 1,
      alignItems: 'center',
    },
    signatureLine: {
      width: '60%',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      marginBottom: 6,
      marginTop: 25,
    },
    signatureTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    signatureSubtitle: {
      fontSize: 8,
      fontWeight: 'normal',
      color: '#64748b',
      textTransform: 'uppercase',
      marginTop: 2,
    },
    signatureDate: {
      fontSize: 7,
      fontStyle: 'italic',
      color: '#64748b',
      marginTop: 4,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#cbd5e1',
      paddingTop: 8,
      marginTop: 10,
      position: 'absolute',
      bottom: 15,
      left: 25,
      right: 25,
    },
    footerLeft: {
      fontSize: 7,
      fontWeight: 'bold',
      color: '#94a3b8',
      fontStyle: 'italic',
    },
    footerRight: {
      fontSize: 7,
      fontWeight: 'bold',
      color: '#94a3b8',
    },
  });
}
