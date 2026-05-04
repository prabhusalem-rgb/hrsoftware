// 'use client';  // Removed for server-side rendering with renderToBuffer

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Timesheet, Employee, Company, Project } from '@/types';

interface ProjectTimesheetReportPDFProps {
  project: Pick<Project, 'id' | 'name' | 'description'>;
  company: Company;
  date: string; // YYYY-MM-DD format
  timesheets: Array<Timesheet & {
    employees: Pick<Employee, 'id' | 'name_en' | 'emp_code' | 'basic_salary' | 'gross_salary'>;
  }>;
}

export function ProjectTimesheetReportPDF({
  project,
  company,
  date,
  timesheets
}: ProjectTimesheetReportPDFProps) {
  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const dayTypeLabels: Record<string, string> = {
    working_day: 'Working Day',
    working_holiday: 'Working Holiday',
    absent: 'Absent',
  };

  // Calculate totals
  const totalRegularHours = timesheets.reduce((sum, t) => sum + Number(t.hours_worked || 0), 0);
  const totalOvertimeHours = timesheets.reduce((sum, t) => sum + Number(t.overtime_hours || 0), 0);
  const totalEmployees = timesheets.length;

  const styles = getStyles(company.name_en || 'Company');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.companyName}>{company.name_en?.toUpperCase() || 'COMPANY'}</Text>
              <Text style={styles.companyAddress}>{company.address || 'Address not available'}</Text>
              <Text style={styles.companyContact}>CR: {company.cr_number || 'N/A'} | Phone: {company.contact_phone || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.title}>PROJECT TIMESHEET REPORT</Text>
          <Text style={styles.subtitle}>Daily Summary for Project: {project.name}</Text>
        </View>

        {/* Report Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REPORT DETAILS</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Project</Text>
              <Text style={styles.value}>{project.name}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formattedDate}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.label}>Total Employees</Text>
              <Text style={styles.value}>{totalEmployees}</Text>
            </View>
          </View>
          {project.description && project.description.trim() !== '' && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Project Description</Text>
              <Text style={[styles.value, { fontSize: 9 }]}>{project.description}</Text>
            </View>
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.summarySection}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalRegularHours.toFixed(1)} h</Text>
            <Text style={styles.statLabel}>Total Regular Hours</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalOvertimeHours.toFixed(1)} h</Text>
            <Text style={styles.statLabel}>Total Overtime Hours</Text>
          </View>
          <View style={[styles.statBox, { flex: 1.2 }]}>
            <Text style={styles.statValue}>{totalEmployees}</Text>
            <Text style={styles.statLabel}>Employees</Text>
          </View>
        </View>

        {/* Timesheets Table */}
        {timesheets.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIMESHEET ENTRIES</Text>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>Employee</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Code</Text>
                <Text style={styles.tableHeaderCell}>Day Type</Text>
                <Text style={[styles.tableHeaderCell, styles.numeric]}>Regular</Text>
                <Text style={[styles.tableHeaderCell, styles.numeric]}>Overtime</Text>
              </View>
              {/* Table Rows */}
              {timesheets.map((timesheet) => (
                <View key={timesheet.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.8 }]}>{timesheet.employees?.name_en || 'Unknown'}</Text>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>{timesheet.employees?.emp_code || 'N/A'}</Text>
                  <Text style={styles.tableCell}>{dayTypeLabels[timesheet.day_type] || timesheet.day_type}</Text>
                  <Text style={[styles.tableCell, styles.numeric]}>{Number(timesheet.hours_worked || 0).toFixed(1)} h</Text>
                  <Text style={[styles.tableCell, styles.numeric]}>{Number(timesheet.overtime_hours || 0).toFixed(1)} h</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIMESHEET ENTRIES</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No timesheets submitted for this project on {formattedDate}</Text>
            </View>
          </View>
        )}

        {/* Detailed Breakdown - show reasons if there are timesheets */}
        {timesheets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DETAILED BREAKDOWN</Text>
            {timesheets.map((timesheet) => (
              <View key={timesheet.id} style={styles.detailRow}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={styles.employeeName}>{timesheet.employees?.name_en || 'Unknown'} ({timesheet.employees?.emp_code || 'N/A'})</Text>
                </View>
                <View style={styles.detailMeta}>
                  <Text style={styles.detailLabel}>Day Type:</Text>
                  <Text style={styles.detailValue}>{dayTypeLabels[timesheet.day_type] || timesheet.day_type}</Text>
                  <Text style={styles.detailLabel}>Hours:</Text>
                  <Text style={styles.detailValue}>{Number(timesheet.hours_worked || 0).toFixed(1)} reg + {Number(timesheet.overtime_hours || 0).toFixed(1)} ot</Text>
                  {timesheet.reason && (
                    <>
                      <Text style={styles.detailLabel}>Reason:</Text>
                      <Text style={[styles.detailValue, { maxWidth: '80%' }]}>{timesheet.reason}</Text>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is an automatically generated timesheet report.
          </Text>
          <Text style={styles.footerSubtext}>
            Generated: {new Date().toLocaleString('en-GB')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

const getStyles = (companyName: string) =>
  StyleSheet.create({
    page: {
      padding: 30,
      fontSize: 10,
      // fontFamily: 'Helvetica',  // Temporarily disabled - may cause font resolution issues
      backgroundColor: '#ffffff',
    },
    header: {
      marginBottom: 20,
    },
    headerTop: {
      alignItems: 'center',
      marginBottom: 15,
    },
    headerText: {
      alignItems: 'center',
    },
    companyName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 4,
    },
    companyAddress: {
      fontSize: 9,
      color: '#374151',
      textAlign: 'center',
    },
    companyContact: {
      fontSize: 9,
      color: '#374151',
      textAlign: 'center',
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
    summarySection: {
      flexDirection: 'row',
      marginBottom: 15,
      gap: 10,
    },
    statBox: {
      flex: 1,
      backgroundColor: '#1e3a5f',
      padding: 12,
      borderRadius: 6,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    statLabel: {
      fontSize: 8,
      color: '#93c5fd',
      marginTop: 2,
      textAlign: 'center',
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
      minWidth: '30%',
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
    emptyState: {
      padding: 20,
      alignItems: 'center',
      backgroundColor: '#f3f4f6',
      borderRadius: 4,
    },
    emptyStateText: {
      fontSize: 10,
      color: '#6b7280',
      fontStyle: 'italic',
    },
    detailRow: {
      marginBottom: 10,
      padding: 8,
      backgroundColor: '#ffffff',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#e5e7eb',
    },
    employeeName: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#1e3a5f',
      marginBottom: 4,
    },
    detailMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    detailLabel: {
      fontSize: 8,
      color: '#6b7280',
      marginRight: 2,
    },
    detailValue: {
      fontSize: 9,
      color: '#374151',
      marginRight: 12,
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
