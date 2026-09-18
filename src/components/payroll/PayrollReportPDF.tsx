'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PayrollReportData, getLeaveDaysInMonth } from '@/lib/payroll-reports';

// Standard PDF fonts like Helvetica, Courier, and Times-Roman are built-in 
// and do not require external registration.

interface PayrollReportPDFProps {
  data: PayrollReportData;
  reportType: 'register'; // Summary removed as per request
  showLogo?: boolean;
  primaryColor?: string;
}

export function PayrollReportPDF({
  data,
  reportType = 'register',
  showLogo = true,
  primaryColor = '#0f172a' // Sleek slate/navy
}: PayrollReportPDFProps) {
  const { company, payrollRun, items, employees, period } = data;

  const formatNumber = (val: number) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Format IBAN with spaces for readability
  const formatIban = (iban: string) => {
    if (!iban || iban === '-') return '-';
    const cleaned = iban.replace(/\s/g, '');
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const styles = StyleSheet.create({
    page: {
      padding: 16,
      paddingBottom: 24,
      fontFamily: 'Helvetica',
      fontSize: 7.5,
      lineHeight: 1.15,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      paddingBottom: 6,
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    logoContainer: {
      width: 42,
      height: 42,
      marginRight: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    },
    companyInfo: {
      flex: 1,
    },
    companyName: {
      fontSize: 14,
      fontWeight: 'bold',
      color: primaryColor,
      marginBottom: 2,
      lineHeight: 1.1,
    },
    companyDetail: {
      fontSize: 7,
      color: '#64748b',
      marginBottom: 1,
    },
    reportMeta: {
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    reportTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    metaText: {
      fontSize: 6.5,
      color: '#64748b',
    },
    currencyDeclaration: {
      fontSize: 7,
      fontStyle: 'italic',
      color: primaryColor,
      marginTop: 3,
      fontWeight: 'bold',
    },
    table: {
      width: '100%',
      marginTop: 4,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      minHeight: 18,
      alignItems: 'center',
    },
    tableHeaderText: {
      fontSize: 5.8,
      fontWeight: 'bold',
      color: '#334155',
      paddingHorizontal: 2,
      textTransform: 'uppercase',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#f1f5f9',
      minHeight: 16,
      alignItems: 'center',
    },
    tableRowAlt: {
      backgroundColor: '#fdfdfd',
    },
    tableCell: {
      fontSize: 6.5,
      paddingHorizontal: 2,
      color: '#0f172a',
    },
    tableCellBold: {
      fontWeight: 'bold',
    },
    totalRow: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      borderTopWidth: 1.5,
      borderTopColor: primaryColor,
      borderBottomWidth: 0.5,
      borderBottomColor: primaryColor,
      minHeight: 20,
      alignItems: 'center',
    },
    totalText: {
      fontSize: 7,
      fontWeight: 'bold',
      color: primaryColor,
    },
    signatures: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      marginBottom: 4,
    },
    signatureBox: {
      width: '28%',
      alignItems: 'center',
    },
    signatureLine: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: '#475569',
      marginTop: 14,
      marginBottom: 3,
    },
    signatureLabel: {
      fontSize: 6.5,
      color: '#64748b',
      fontWeight: 'bold',
    },
    footer: {
      position: 'absolute',
      bottom: 8,
      left: 16,
      right: 16,
    },
    footerMeta: {
      borderTopWidth: 0.5,
      borderTopColor: '#e2e8f0',
      paddingTop: 3,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: {
      fontSize: 5.5,
      color: '#94a3b8',
    },
    // Column widths (Total 100%)
    colCode: { width: '3%' },
    colName: { width: '13.5%' },
    colBank: { width: '10.5%' },
    colMDays: { width: '3%', textAlign: 'center' },
    colWDays: { width: '3%', textAlign: 'center' },
    colNumeric: { width: '4.8%', textAlign: 'right' },
    colLargeNumeric: { width: '6%', textAlign: 'right' },
    colSmallNumeric: { width: '3%', textAlign: 'center' },
    colNetNumeric: { width: '8.8%', textAlign: 'right' },
  });

  // Sort items alphabetically by employee name
  const sortedItems = [...items].map(item => {
    const emp = employees.find(e => e.id === item.employee_id);
    return { ...item, _empName: emp?.name_en || 'Unknown' };
  }).sort((a, b) => a._empName.localeCompare(b._empName));

  const daysInMonth = new Date(payrollRun.year, payrollRun.month, 0).getDate();

  const totals = sortedItems.reduce((acc, item) => {
    const emp = employees.find(e => e.id === item.employee_id);
    let effectiveStartDay = 1;
    if (emp) {
      const joinDate = emp.join_date ? new Date(emp.join_date) : null;
      const rejoinDate = emp.rejoin_date ? new Date(emp.rejoin_date) : null;
      const isJoiningThisMonth = joinDate && !isNaN(joinDate.getTime()) &&
                                 joinDate.getMonth() + 1 === payrollRun.month &&
                                 joinDate.getFullYear() === payrollRun.year;
      const isRejoiningThisMonth = rejoinDate && !isNaN(rejoinDate.getTime()) &&
                                   rejoinDate.getMonth() + 1 === payrollRun.month &&
                                   rejoinDate.getFullYear() === payrollRun.year;
      if (isRejoiningThisMonth) {
        effectiveStartDay = rejoinDate.getDate();
      } else if (isJoiningThisMonth) {
        effectiveStartDay = joinDate.getDate();
      }
    }

    const activeCalendarDays = daysInMonth - effectiveStartDay + 1;
    const leaveDays = getLeaveDaysInMonth(item.employee_id, data.leaves || [], payrollRun.month, payrollRun.year, effectiveStartDay);
    const wDays = Math.max(0, activeCalendarDays - Number(item.absent_days || 0) - leaveDays);

    acc.mDays += daysInMonth;
    acc.wDays += wDays;
    acc.basic += Number(item.basic_salary);
    acc.housing += Number(item.housing_allowance);
    acc.food += Number(item.food_allowance || 0);
    const otherAllw = Number(item.special_allowance || 0) + 
                      Number(item.site_allowance || 0) + Number(item.other_allowance || 0);
    acc.otherAllw += otherAllw;
    acc.gross += Number(item.gross_salary);
    acc.otPay += Number(item.overtime_pay || 0);
    acc.absentDed += Number(item.absence_deduction || 0);
    acc.loanDed += Number(item.loan_deduction || 0);
    acc.otherDed += Number(item.other_deduction || 0);
    acc.totalDed += Number(item.total_deductions || 0);
    acc.socialSec += Number(item.social_security_deduction || 0);
    acc.net += Number(item.net_salary || 0);
    return acc;
  }, {
    mDays: 0, wDays: 0, basic: 0, housing: 0, food: 0, otherAllw: 0,
    gross: 0, otPay: 0, absentDed: 0, loanDed: 0, otherDed: 0, totalDed: 0,
    socialSec: 0, net: 0
  });

  return (
    <Document title={`Payroll Register - ${period}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showLogo && company?.logo_url ? (
              <View style={styles.logoContainer}>
                <Image src={company.logo_url} style={styles.logoImage} />
              </View>
            ) : null}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{company?.name_en || 'COMPANY NAME'}</Text>
              <Text style={styles.companyDetail}>{company?.address || ''}</Text>
              <Text style={styles.companyDetail}>CR: {company?.cr_number || 'N/A'} | Phone: {company?.contact_phone || 'N/A'}</Text>
              <Text style={styles.currencyDeclaration}>NOTE: ALL FINANCIAL VALUES ARE IN OMANI RIAL (OMR)</Text>
            </View>
          </View>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Payroll Register</Text>
            <Text style={styles.metaText}>Period: {period}</Text>
            <Text style={styles.metaText}>Run ID: {payrollRun.id.substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.metaText}>Generated: {new Date().toLocaleString()}</Text>
          </View>
        </View>

        {/* Register Table */}
        <View style={styles.table}>
          {/* Header Row - Repeats on every page */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderText, styles.colCode]}>S.No</Text>
            <Text style={[styles.tableHeaderText, styles.colName]}>Employee Name</Text>
            <Text style={[styles.tableHeaderText, styles.colBank]}>Bank Account</Text>
            <Text style={[styles.tableHeaderText, styles.colMDays]}>M-Days</Text>
            <Text style={[styles.tableHeaderText, styles.colWDays]}>W-Days</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Basic</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Hous.</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Food</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Other Allw.</Text>
            <Text style={[styles.tableHeaderText, styles.colLargeNumeric]}>Gross</Text>
            <Text style={[styles.tableHeaderText, styles.colSmallNumeric]}>OT Hrs</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>OT Pay</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Abs Ded</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Loan</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>Other Ded</Text>
            <Text style={[styles.tableHeaderText, styles.colLargeNumeric]}>Tot Ded</Text>
            <Text style={[styles.tableHeaderText, styles.colNumeric]}>SocSec</Text>
            <Text style={[styles.tableHeaderText, styles.colNetNumeric]}>Net Pay</Text>
          </View>

          {/* Data Rows */}
          {sortedItems.map((item, idx) => {
            const emp = employees.find(e => e.id === item.employee_id);
            const otherAllw = Number(item.special_allowance || 0) + 
                              Number(item.site_allowance || 0) + Number(item.other_allowance || 0);
            
            let effectiveStartDay = 1;
            if (emp) {
              const joinDate = emp.join_date ? new Date(emp.join_date) : null;
              const rejoinDate = emp.rejoin_date ? new Date(emp.rejoin_date) : null;
              const isJoiningThisMonth = joinDate && !isNaN(joinDate.getTime()) &&
                                         joinDate.getMonth() + 1 === payrollRun.month &&
                                         joinDate.getFullYear() === payrollRun.year;
              const isRejoiningThisMonth = rejoinDate && !isNaN(rejoinDate.getTime()) &&
                                           rejoinDate.getMonth() + 1 === payrollRun.month &&
                                           rejoinDate.getFullYear() === payrollRun.year;
              if (isRejoiningThisMonth) {
                effectiveStartDay = rejoinDate.getDate();
              } else if (isJoiningThisMonth) {
                effectiveStartDay = joinDate.getDate();
              }
            }

            const activeCalendarDays = daysInMonth - effectiveStartDay + 1;
            const leaveDays = getLeaveDaysInMonth(item.employee_id, data.leaves || [], payrollRun.month, payrollRun.year, effectiveStartDay);
            const wDays = Math.max(0, activeCalendarDays - Number(item.absent_days || 0) - leaveDays);
            return (
              <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, styles.colCode]}>{idx + 1}</Text>
                <Text style={[styles.tableCell, styles.colName]}>{emp?.name_en || 'Unknown'}</Text>
                <Text style={[styles.tableCell, styles.colBank]}>{formatIban(emp?.bank_iban || '-')}</Text>
                <Text style={[styles.tableCell, styles.colMDays]}>{daysInMonth}</Text>
                <Text style={[styles.tableCell, styles.colWDays]}>{wDays}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.basic_salary)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.housing_allowance)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.food_allowance || 0)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(otherAllw)}</Text>
                <Text style={[styles.tableCell, styles.colLargeNumeric, styles.tableCellBold]}>{formatNumber(item.gross_salary)}</Text>
                <Text style={[styles.tableCell, styles.colSmallNumeric]}>{item.overtime_hours || '0'}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.overtime_pay)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.absence_deduction)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.loan_deduction)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.other_deduction)}</Text>
                <Text style={[styles.tableCell, styles.colLargeNumeric]}>{formatNumber(item.total_deductions)}</Text>
                <Text style={[styles.tableCell, styles.colNumeric]}>{formatNumber(item.social_security_deduction)}</Text>
                <Text style={[styles.tableCell, styles.colNetNumeric, styles.tableCellBold, { color: primaryColor }]}>{formatNumber(item.net_salary)}</Text>
              </View>
            );
          })}

          {/* Totals Row */}
          <View style={styles.totalRow} wrap={false}>
            <View style={{ width: '27%' }}>
              <Text style={[styles.totalText, { paddingLeft: 4 }]}>TOTALS ({sortedItems.length} Employees)</Text>
            </View>
            <Text style={[styles.totalText, styles.colMDays]}>{totals.mDays}</Text>
            <Text style={[styles.totalText, styles.colWDays]}>{totals.wDays}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.basic)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.housing)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.food)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.otherAllw)}</Text>
            <Text style={[styles.totalText, styles.colLargeNumeric]}>{formatNumber(totals.gross)}</Text>
            <View style={styles.colSmallNumeric} />
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.otPay)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.absentDed)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.loanDed)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.otherDed)}</Text>
            <Text style={[styles.totalText, styles.colLargeNumeric]}>{formatNumber(totals.totalDed)}</Text>
            <Text style={[styles.totalText, styles.colNumeric]}>{formatNumber(totals.socialSec)}</Text>
            <Text style={[styles.totalText, styles.colNetNumeric]}>{formatNumber(totals.net)}</Text>
          </View>
        </View>

        {/* Signatures Flow - Moved out of absolute footer to prevent overlap */}
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Prepared By</Text>
            <Text style={styles.metaText}>HR / Payroll Administrator</Text>
            <Text style={[styles.metaText, { marginTop: 2, opacity: 0.6 }]}>Date: ____/____/{payrollRun?.year || new Date().getFullYear()}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Checked By</Text>
            <Text style={styles.metaText}>Finance Department</Text>
            <Text style={[styles.metaText, { marginTop: 2, opacity: 0.6 }]}>Date: ____/____/{payrollRun?.year || new Date().getFullYear()}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorised By</Text>
            <Text style={styles.metaText}>General Manager / CEO</Text>
            <Text style={[styles.metaText, { marginTop: 2, opacity: 0.6 }]}>Date: ____/____/{payrollRun?.year || new Date().getFullYear()}</Text>
          </View>
        </View>

        {/* System Footer Metadata - Remains absolute */}
        <View style={styles.footer} fixed>
          <View style={styles.footerMeta}>
            <Text style={styles.footerText}>This is a system-generated document. Run Date: {new Date().toLocaleDateString()}</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
