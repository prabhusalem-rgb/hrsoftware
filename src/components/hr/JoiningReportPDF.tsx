'use client';

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Employee, Company } from '@/types';
import { format } from 'date-fns';

interface JoiningReportPDFProps {
  employee: Employee;
  company: Company;
  showLogo?: boolean;
  primaryColor?: string;
}

export function JoiningReportPDF({
  employee,
  company,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: JoiningReportPDFProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'NOT RECORDED';
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
            <Text style={[styles.companyName, { color: primaryColor }]}>
              {company?.name_en || 'COMPANY NAME'}
            </Text>
            {company?.trade_name && (
              <Text style={styles.companyTrade}>{company.trade_name}</Text>
            )}
            <Text style={styles.companyAddress}>
              {company?.address || 'PO BOX - 51, POSTAL CODE - 617, MUSCAT, OMAN'}
            </Text>
            {company?.cr_number && (
              <Text style={styles.companyCR}>CR No: {company.cr_number}</Text>
            )}
            {company?.contact_phone && (
              <Text style={styles.companyContact}>Phone: {company.contact_phone}</Text>
            )}
          </View>
          <View style={styles.headerDate}>
            <Text style={styles.reportDateLabel}>Report Date</Text>
            <Text style={styles.reportDateValue}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Joining Report / Assumption of Duties</Text>
        </View>

        {/* Main Body */}
        <View style={styles.content}>
          <Text style={styles.text}>
            This is to formally confirm that:
          </Text>

          <View style={styles.employeeInfoBox}>
            <View style={styles.employeeInfoLeft}>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Employee Name</Text>
                <Text style={styles.infoValue}>{employee.name_en}</Text>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Employee Code</Text>
                <Text style={[styles.infoValue, styles.mono]}>{employee.emp_code}</Text>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Designation</Text>
                <Text style={styles.infoValue}>{employee.designation}</Text>
              </View>
            </View>
            <View style={styles.employeeInfoRight}>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Date of Assumption</Text>
                <Text style={[styles.infoValue, { color: primaryColor }]}>{formatDate(employee.join_date)}</Text>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{employee.department || 'GENERAL OPERATIONS'}</Text>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={[styles.infoValue, { fontStyle: 'italic' }]}>{employee.category}</Text>
              </View>
            </View>
          </View>

          <View style={styles.narrative}>
            <Text style={styles.paragraph}>
              The above-named employee has reported for duty and has officially assumed their assigned responsibilities as of the joining date mentioned above.
            </Text>
            <Text style={styles.paragraph}>
              The employee has been briefed on the company policies, safety protocols, and the terms of the employment contract in accordance with the{' '}
              <Text style={[styles.emphasis, { fontStyle: 'italic', textDecoration: 'underline' }]}>
                Sultanate of Oman Labor Law
              </Text>
              .
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <View style={styles.signatureLabel}>
              <Text style={styles.signatureTitle}>Employee Signature</Text>
              <Text style={styles.signatureSubtitle}>Confirmation of Assumption</Text>
            </View>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <View style={styles.signatureLabel}>
              <Text style={styles.signatureTitle}>Department Head / HR Manager</Text>
              <Text style={styles.signatureSubtitle}>Verified & Approved</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTextLeft}>
            © {new Date().getFullYear()} {company?.name_en || 'COMPANY'} • OFFICIAL PERSONNEL RECORD
          </Text>
          <Text style={styles.footerTextRight}>
            FOR ADMINISTRATIVE USE ONLY
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function getStyles(primaryColor: string) {
  return StyleSheet.create({
    page: {
      padding: 24,
      fontFamily: 'Times-Roman',
      fontSize: 12,
      lineHeight: 1.6,
      color: '#1e293b',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
      borderBottomWidth: 2,
      borderBottomColor: '#000',
      paddingBottom: 16,
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
      flex: 1,
      marginLeft: 16,
    },
    companyName: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    companyTrade: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#64748b',
      marginBottom: 8,
    },
    companyAddress: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      lineHeight: 1.4,
    },
    companyCR: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 4,
    },
    companyContact: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 2,
    },
    headerDate: {
      alignItems: 'flex-end',
    },
    reportDateLabel: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#94a3b8',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    reportDateValue: {
      fontSize: 12,
      fontWeight: 'bold',
      fontFamily: 'Courier',
    },
    titleContainer: {
      marginBottom: 24,
    },
    title: {
      fontSize: 14,
      fontWeight: 'bold',
      textAlign: 'center',
      borderTopWidth: 2,
      borderTopColor: '#000',
      borderBottomWidth: 2,
      borderBottomColor: '#000',
      paddingVertical: 12,
      letterSpacing: 4,
      fontStyle: 'italic',
    },
    content: {
      marginBottom: 40,
    },
    text: {
      marginBottom: 12,
    },
    employeeInfoBox: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      padding: 16,
      borderRadius: 8,
      marginVertical: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    employeeInfoLeft: {
      flex: 1,
      paddingRight: 16,
      borderRightWidth: 1,
      borderRightColor: '#e2e8f0',
    },
    employeeInfoRight: {
      flex: 1,
      paddingLeft: 16,
    },
    infoField: {
      marginBottom: 16,
    },
    infoLabel: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    infoValue: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e293b',
    },
    mono: {
      fontFamily: 'Courier',
    },
    narrative: {
      marginTop: 16,
    },
    paragraph: {
      marginBottom: 16,
      textAlign: 'justify',
    },
    emphasis: {
      fontWeight: 'bold',
    },
    signatureSection: {
      flexDirection: 'row',
      marginTop: 'auto',
      paddingTop: 32,
    },
    signatureBlock: {
      flex: 1,
      alignItems: 'center',
    },
    signatureLine: {
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      marginBottom: 12,
    },
    signatureLabel: {
      alignItems: 'center',
    },
    signatureTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    signatureSubtitle: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#64748b',
      textTransform: 'uppercase',
      marginTop: 4,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#cbd5e1',
      paddingTop: 16,
      marginTop: 'auto',
    },
    footerTextLeft: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#94a3b8',
      fontStyle: 'italic',
    },
    footerTextRight: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#94a3b8',
      fontStyle: 'italic',
    },
  });
}
