'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Timesheet, Employee, Company, Project } from '@/types';

// Timesheet confirmation PDF shows the submitted entry details
interface TimesheetConfirmationPDFProps {
  timesheet: Timesheet & {
    employees: Pick<Employee, 'id' | 'name_en' | 'emp_code' | 'basic_salary' | 'gross_salary'>;
    projects: Pick<Project, 'id' | 'name'> | null;
  };
  company: Company;
  submissionToken: string;
}

export function TimesheetConfirmationPDF({
  timesheet,
  company,
  submissionToken
}: TimesheetConfirmationPDFProps) {
  const { employees, projects } = timesheet;
  const submittedAt = new Date(timesheet.created_at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dayTypeLabels: Record<string, string> = {
    working_day: 'Working Day',
    working_holiday: 'Working Holiday',
    absent: 'Absent',
  };

  const styles = getStyles(company.name_en || 'Company');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>LOGO</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.companyName}>{company.name_en?.toUpperCase() || 'COMPANY'}</Text>
              <Text style={styles.companyAddress}>{company.address || 'Address not available'}</Text>
              <Text style={styles.companyContact}>CR: {company.cr_number || 'N/A'} | Phone: {company.contact_phone || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.title}>TIMESHEET SUBMISSION CONFIRMATION</Text>
          <Text style={styles.subtitle}>Receipt for Public Timesheet Submission</Text>
        </View>

        {/* Submission Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUBMISSION DETAILS</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Reference ID</Text>
              <Text style={styles.value}>{timesheet.id.substring(0, 8).toUpperCase()}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Submitted On</Text>
              <Text style={styles.value}>{submittedAt}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Submission Token</Text>
              <Text style={styles.valueSmall}>{submissionToken.substring(0, 12)}...</Text>
            </View>
          </View>
        </View>

        {/* Employee Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMPLOYEE INFORMATION</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Employee Name</Text>
              <Text style={styles.value}>{employees?.name_en || 'Unknown'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Employee Code</Text>
              <Text style={styles.value}>{employees?.emp_code || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Timesheet Entry */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TIMESHEET ENTRY</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Date</Text>
              <Text style={styles.tableHeaderCell}>Day Type</Text>
              <Text style={styles.tableHeaderCell}>Regular Hours</Text>
              <Text style={styles.tableHeaderCell}>Overtime Hours</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>{timesheet.date}</Text>
              <Text style={styles.tableCell}>{dayTypeLabels[timesheet.day_type] || timesheet.day_type}</Text>
              <Text style={[styles.tableCell, styles.numeric]}>{Number(timesheet.hours_worked || 0).toFixed(1)} h</Text>
              <Text style={[styles.tableCell, styles.numeric]}>{Number(timesheet.overtime_hours || 0).toFixed(1)} h</Text>
            </View>
          </View>
        </View>

        {/* Project & Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROJECT & REASON</Text>
          <View style={styles.infoGrid}>
            <View style={[styles.infoCol, { flex: 2 }]}>
              <Text style={styles.label}>Project</Text>
              <Text style={styles.value}>{projects?.name || 'Not specified'}</Text>
            </View>
            <View style={[styles.infoCol, { flex: 3 }]}>
              <Text style={styles.label}>Reason / Notes</Text>
              <Text style={[styles.value, { fontSize: 9 }]}>{timesheet.reason || 'No reason provided'}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is an electronically generated timesheet confirmation. No signature required.
          </Text>
          <Text style={styles.footerSubtext}>
            Generated: {new Date().toLocaleString('en-GB')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

const getStyles = (companyName: string) =>
  StyleSheet.create({
    page: {
      padding: 30,
      fontSize: 10,
      fontFamily: 'Helvetica',
      backgroundColor: '#ffffff',
    },
    header: {
      marginBottom: 20,
    },
    headerTop: {
      flexDirection: 'row',
      marginBottom: 15,
    },
    logoPlaceholder: {
      width: 70,
      height: 50,
      backgroundColor: '#1e3a5f',
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
    },
    logoText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: 'bold',
    },
    headerText: {
      flex: 1,
      justifyContent: 'center',
    },
    companyName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 2,
    },
    companyAddress: {
      fontSize: 9,
      color: '#374151',
    },
    companyContact: {
      fontSize: 9,
      color: '#374151',
    },
    headerDivider: {
      height: 2,
      backgroundColor: '#1e3a5f',
      marginBottom: 15,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#1e3a5f',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 10,
      textAlign: 'center',
      color: '#6b7280',
    },
    section: {
      marginBottom: 15,
      padding: 10,
      backgroundColor: '#f8fafc',
      borderRadius: 6,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 15,
    },
    infoCol: {
      flex: 1,
      minWidth: '40%',
    },
    label: {
      fontSize: 8,
      color: '#6b7280',
      marginBottom: 2,
      textTransform: 'uppercase',
    },
    value: {
      fontSize: 11,
      fontWeight: 500,
      color: '#111827',
    },
    valueSmall: {
      fontSize: 9,
      color: '#374151',
    },
    table: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 4,
      overflow: 'hidden',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1e3a5f',
      paddingVertical: 6,
    },
    tableHeaderCell: {
      flex: 1,
      fontSize: 8,
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'center',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    tableCell: {
      flex: 1,
      fontSize: 9,
      color: '#374151',
      textAlign: 'center',
    },
    numeric: {
      textAlign: 'right',
      paddingRight: 8,
    },
    note: {
      fontSize: 8,
      color: '#6b7280',
      marginTop: 6,
      fontStyle: 'italic',
    },
    footer: {
      marginTop: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      alignItems: 'center',
    },
    footerText: {
      fontSize: 9,
      color: '#6b7280',
      textAlign: 'center',
    },
    footerSubtext: {
      fontSize: 8,
      color: '#9ca3af',
      marginTop: 4,
    },
  });
