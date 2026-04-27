'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Company, Employee } from '@/types';
import { format } from 'date-fns';

const BRAND = '#0f172a';
const SLATE = '#475569';
const SLATE_LIGHT = '#64748b';
const GRAY_200 = '#e2e8f0';

interface ContractRenewalPDFProps {
  company: Company;
  employee: Employee;
  renewalData: {
    renewal_period_years: number;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    food_allowance: number;
    special_allowance: number;
    site_allowance: number;
    other_allowance: number;
    gross_salary: number;
    employee_signature_url?: string;
    employee_signed_at?: string;
    manager_signature_url?: string;
    manager_approved_at?: string;
    supervisor_comments?: string;
    hr_signature_url?: string;
    hr_signed_at?: string;
  };
}

export function ContractRenewalPDF({ company, employee, renewalData }: ContractRenewalPDFProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd-MMM-yyyy');
    } catch {
      return dateStr;
    }
  };

  const styles = getStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{company?.name_en || 'BRIGHT FLOWERS TRADING LLC'}</Text>
          <Text style={styles.companyAddress}>{company?.address || 'PB-51, PC-617, Sultanate of Oman'}</Text>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>CONTRACT RENEWAL FORM</Text>
        </View>

        {/* Employee Details Section */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Employee Name:</Text>
              <Text style={styles.value}>{employee.name_en}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Employee ID:</Text>
              <Text style={styles.value}>{employee.emp_code}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Designation:</Text>
              <Text style={styles.value}>{employee.designation}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Date of Joining (DOJ):</Text>
              <Text style={styles.value}>{formatDate(employee.join_date)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Resident ID Expiry:</Text>
              <Text style={styles.value}>{formatDate(employee.passport_expiry || undefined)}</Text>
            </View>
          </View>
        </View>

        {/* Salary Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary Breakdown:</Text>
          <View style={styles.salaryGrid}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Basic Salary:</Text>
              <Text style={styles.salaryValue}>{renewalData.basic_salary.toFixed(3)} OMR</Text>
            </View>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Allowances:</Text>
              <Text style={styles.salaryValue}>{(renewalData.housing_allowance + renewalData.transport_allowance + renewalData.food_allowance + renewalData.special_allowance + renewalData.site_allowance + renewalData.other_allowance).toFixed(3)} OMR</Text>
            </View>
            <View style={[styles.salaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Pay (Basic + Allowances):</Text>
              <Text style={styles.totalValue}>{renewalData.gross_salary.toFixed(3)} OMR</Text>
            </View>
          </View>
        </View>

        {/* Declaration Section */}
        <View style={styles.declarationContainer}>
          <Text style={styles.declarationTitle}>Declaration:</Text>
          <Text style={styles.declarationText}>
            {"I hereby agree and I am willing to work at "}
            <Text style={styles.declarationEmphasis}>{company?.name_en || 'Bright Flowers Trading LLC'}</Text>
            {" and therefore I am requesting you to kindly renew my contract for a further period of "}
            <Text style={styles.declarationEmphasis}>{renewalData.renewal_period_years} years</Text>
            {"."}
          </Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureGrid}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Employee Signature:</Text>
            {renewalData.employee_signature_url ? (
              <Image src={renewalData.employee_signature_url} style={styles.signatureImage} />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <Text style={styles.signatureDate}>Date: {formatDate(renewalData.employee_signed_at)}</Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Immediate Supervisor Comments:</Text>
            <Text style={styles.commentsText}>{renewalData.supervisor_comments || '_______________________'}</Text>
          </View>
        </View>

        <View style={styles.signatureGrid}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>HOD/Project Manager Signature:</Text>
            {renewalData.manager_signature_url ? (
              <Image src={renewalData.manager_signature_url} style={styles.signatureImage} />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <Text style={styles.signatureDate}>Date: {formatDate(renewalData.manager_approved_at)}</Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>HR Department Signature:</Text>
            {renewalData.hr_signature_url ? (
              <Image src={renewalData.hr_signature_url} style={styles.signatureImage} />
            ) : (
              <View style={styles.signaturePlaceholder} />
            )}
            <Text style={styles.signatureDate}>Date: {formatDate(renewalData.hr_signed_at)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated on {format(new Date(), 'dd-MMM-yyyy HH:mm')} · Secure Digital Document</Text>
        </View>
      </Page>
    </Document>
  );
}

function getStyles() {
  return StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: BRAND,
    },
    header: {
      marginBottom: 20,
      textAlign: 'center',
    },
    companyName: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    companyAddress: {
      fontSize: 10,
      color: SLATE,
    },
    titleContainer: {
      borderTopWidth: 2,
      borderBottomWidth: 2,
      borderColor: BRAND,
      paddingVertical: 10,
      marginBottom: 20,
      alignItems: 'center',
    },
    title: {
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: 1,
    },
    section: {
      marginBottom: 15,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    col: {
      flex: 1,
    },
    label: {
      fontSize: 9,
      color: SLATE_LIGHT,
      marginBottom: 2,
    },
    value: {
      fontSize: 11,
      fontWeight: 'bold',
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 10,
      textDecoration: 'underline',
    },
    salaryGrid: {
      borderWidth: 1,
      borderColor: GRAY_200,
      padding: 10,
    },
    salaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: GRAY_200,
    },
    salaryLabel: {
      fontSize: 10,
    },
    salaryValue: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    totalRow: {
      backgroundColor: '#f8fafc',
      borderBottomWidth: 0,
      marginTop: 5,
      paddingTop: 10,
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: 'bold',
    },
    totalValue: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#0f172a',
    },
    declarationContainer: {
      marginTop: 20,
      marginBottom: 30,
      padding: 15,
      backgroundColor: '#f1f5f9',
      borderRadius: 5,
    },
    declarationTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    declarationText: {
      fontSize: 10,
      lineHeight: 1.5,
      fontStyle: 'italic',
      textAlign: 'justify',
    },
    declarationEmphasis: {
      fontWeight: 'bold',
      fontStyle: 'normal',
    },
    signatureGrid: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 20,
    },
    signatureBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: GRAY_200,
      padding: 10,
      minHeight: 100,
    },
    signatureLabel: {
      fontSize: 9,
      fontWeight: 'bold',
      marginBottom: 10,
      color: SLATE,
    },
    signatureImage: {
      width: '100%',
      height: 60,
      objectFit: 'contain',
    },
    signaturePlaceholder: {
      height: 60,
    },
    signatureDate: {
      fontSize: 8,
      color: SLATE_LIGHT,
      marginTop: 5,
      textAlign: 'right',
    },
    commentsText: {
      fontSize: 10,
      fontStyle: 'italic',
      color: SLATE,
    },
    footer: {
      position: 'absolute',
      bottom: 40,
      left: 40,
      right: 40,
      borderTopWidth: 1,
      borderTopColor: GRAY_200,
      paddingTop: 10,
      textAlign: 'center',
    },
    footerText: {
      fontSize: 8,
      color: SLATE_LIGHT,
    },
  });
}
