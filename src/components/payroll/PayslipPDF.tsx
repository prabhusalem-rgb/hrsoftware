'use client';

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Employee, PayrollItem, Company } from '@/types';
import { toOmaniWords } from '@/lib/utils/currency';

// Define custom fonts (using built-in for now, can be customized)
// For production, you might want to embed custom fonts

// Format IBAN with spaces for readability
const formatIban = (iban: string) => {
  if (!iban) return 'Not set';
  const cleaned = iban.replace(/\s/g, '');
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
};

interface PayslipPDFProps {
  employee: Employee;
  item: PayrollItem;
  company: Company;
  period: string;
  showLogo?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
}

export function PayslipPDF({
  employee,
  item,
  company,
  period,
  showLogo = true,
  primaryColor = '#1e3a5f', // Elegant navy blue
  secondaryColor = '#374151'
}: PayslipPDFProps) {
  // Helper to parse "Month Year" to days in month
  const getDaysInMonth = (periodStr: string) => {
    try {
      const parts = periodStr.split(' ');
      if (parts.length === 2) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIdx = monthNames.indexOf(parts[0]);
        const year = parseInt(parts[1]);
        if (monthIdx !== -1 && !isNaN(year)) {
          return new Date(year, monthIdx + 1, 0).getDate();
        }
      }
    } catch (e) {}
    return 30;
  };

  const daysInMonth = getDaysInMonth(period);
  const unpaidDays = Number(item.absent_days || 0);

  // Calculate actual work days considering rejoin/join dates
  // For employees who rejoined or joined this month, they only get paid from that date onward
  const getEffectiveWorkDays = () => {
    const [monthName, yearStr] = period.split(' ');
    const monthIdx = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(monthName);
    const year = parseInt(yearStr);
    if (monthIdx === -1 || isNaN(year)) return daysInMonth - unpaidDays;

    // Check for rejoin_date (employee returning from leave)
    if (employee.rejoin_date) {
      const rejoin = new Date(employee.rejoin_date);
      if (rejoin.getFullYear() === year && rejoin.getMonth() + 1 === monthIdx + 1) {
        const worked = daysInMonth - rejoin.getDate() + 1;
        return Math.max(0, worked - unpaidDays);
      }
    }

    // Check for join_date (new employee)
    if (employee.join_date) {
      const join = new Date(employee.join_date);
      if (join.getFullYear() === year && join.getMonth() + 1 === monthIdx + 1) {
        const worked = daysInMonth - join.getDate() + 1;
        return Math.max(0, worked - unpaidDays);
      }
    }

    return daysInMonth - unpaidDays;
  };

  const effectiveWorkDays = getEffectiveWorkDays();

  const formatOMR = (val: number) => Number(val || 0).toFixed(3);

  const earnings = [
    { label: 'BASIC SALARY', full: employee.basic_salary, actual: item.basic_salary },
    { label: 'HOUSING ALLOWANCE', full: employee.housing_allowance, actual: item.housing_allowance },
    { label: 'TRANSPORT ALLOWANCE', full: employee.transport_allowance, actual: item.transport_allowance },
    { label: 'FOOD ALLOWANCE', full: employee.food_allowance || 0, actual: item.food_allowance || 0 },
    { label: 'SPECIAL ALLOWANCE', full: employee.special_allowance || 0, actual: item.special_allowance || 0 },
    { label: 'SITE ALLOWANCE', full: employee.site_allowance || 0, actual: item.site_allowance || 0 },
    { label: 'OTHER ALLOWANCE', full: employee.other_allowance || 0, actual: item.other_allowance || 0 },
    ...(Number(item.overtime_hours) > 0 ? [{
      label: 'OVERTIME HOURS',
      full: 0,
      actual: Number(item.overtime_hours),
      isHours: true
    }] : []),
    ...(Number(item.overtime_pay) > 0 ? [{
      label: 'OVERTIME PAY',
      full: 0,
      actual: Number(item.overtime_pay)
    }] : []),
  ].filter(e => e.actual > 0 || e.full > 0);

  const deductions = [
    { label: 'SOCIAL PROTECTION FUND (SPF)', amount: item.social_security_deduction || 0 },
    { label: 'ABSENCE DEDUCTION', amount: item.absence_deduction || 0 },
    { label: 'LEAVE DEDUCTION', amount: item.leave_deduction || 0 },
    { label: 'LOAN REPAYMENT', amount: item.loan_deduction || 0 },
    { label: 'OTHER DEDUCTIONS', amount: item.other_deduction || 0 },
  ].filter(d => d.amount > 0);

  const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.actual), 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount), 0);
  const netPay = Number(item.net_salary);

  const styles = getStyles(primaryColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
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
            <Text style={styles.companyAddress}>
              {company?.address || 'PO BOX - 51, POSTAL CODE - 617, MUSCAT, OMAN'}
            </Text>
            {company?.contact_phone && (
              <Text style={styles.companyContact}>Phone: {company.contact_phone}</Text>
            )}
            {company?.contact_email && (
              <Text style={styles.companyContact}>Email: {company.contact_email}</Text>
            )}
            {company?.bank_name && (
              <Text style={styles.companyContact}>{company.bank_name}</Text>
            )}
            {company?.bank_account && (
              <Text style={styles.companyContact}>Acct: {company.bank_account}</Text>
            )}
            {company?.iban && (
              <Text style={styles.companyContact}>IBAN: {company.iban}</Text>
            )}
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.badgeText}>WPS COMPLIANT</Text>
            <Text style={styles.badgeSubText}>Oman Wage Protection System</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { borderColor: primaryColor }]}>PAYSLIP</Text>
          <Text style={styles.subTitle}>For the month of {period}</Text>
        </View>

        {/* Employee Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMPLOYEE DETAILS</Text>
          <View style={styles.employeeGrid}>
            <View style={styles.employeeColumn}>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Name</Text>
                <Text style={[styles.value, { fontWeight: 'bold' }]}>{employee.name_en}</Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Code</Text>
                <Text style={[styles.value, styles.mono, { fontWeight: 'bold' }]}>{employee.emp_code}</Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Designation</Text>
                <Text style={[styles.value, { textTransform: 'uppercase', fontSize: 9 }]}>{employee.designation}</Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Department</Text>
                <Text style={styles.value}>{employee.department}</Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Nationality</Text>
                <Text style={styles.value}>{employee.nationality}</Text>
              </View>
            </View>
            <View style={styles.employeeColumn}>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Joining Date</Text>
                <Text style={styles.value}>
                  {new Date(employee.join_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Bank Details</Text>
                <Text style={styles.value}>
                  <Text style={{ fontSize: 8.5, fontWeight: 'bold' }}>{employee.bank_name || 'Not set'}</Text>
                  {'\n'}
                  <Text style={{ fontSize: 7.5, fontFamily: 'Courier', color: '#6B7280' }}>
                    {formatIban(employee.bank_iban)}
                  </Text>
                </Text>
              </View>
              <View style={styles.employeeRow}>
                <Text style={styles.label}>Work Metrics</Text>
                <Text style={styles.value}>
                  <Text style={{ fontSize: 7.5, color: '#6B7280' }}>{daysInMonth} days</Text>
                  {'  '}
                  <Text style={{ fontSize: 7.5, color: '#047857', fontWeight: 'bold' }}>{effectiveWorkDays} work</Text>
                  {'  '}
                  <Text style={{ fontSize: 7.5, color: '#B91C1C', fontWeight: 'bold' }}>{item.absent_days || 0} LOP</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings Table */}
        <View style={styles.tableSection}>
          <Text style={[styles.tableTitle, { backgroundColor: primaryColor }]}>EARNINGS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2.5 }]}>Description</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Full</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Actual</Text>
            </View>
            {earnings.map((earning, idx) => (
              <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 2.5 }]}>{earning.label}</Text>
                <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right', color: '#6B7280' }]}>
                  {earning.isHours ? '-' : formatOMR(earning.full)}
                </Text>
                <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right', fontWeight: 'bold', color: earning.isHours ? '#047857' : undefined }]}>
                  {earning.isHours ? `${earning.actual.toFixed(1)} hrs` : formatOMR(earning.actual)}
                </Text>
              </View>
            ))}
            {earnings.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>-</Text>
              </View>
            )}
          </View>
          <View style={[styles.totalRow, { borderTopColor: primaryColor }]}>
            <View style={{ flex: 2.5 }} />
            <View style={{ flex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={styles.totalLabel}>TOTAL EARNINGS</Text>
              <Text style={[styles.totalValue, { color: primaryColor }]}>
                {formatOMR(totalEarnings)}
              </Text>
            </View>
          </View>
        </View>

        {/* Deductions Table */}
        {deductions.length > 0 && (
          <View style={styles.tableSection}>
            <Text style={[styles.tableTitle, { backgroundColor: '#B91C1C' }]}>DEDUCTIONS</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Description</Text>
                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Amount (OMR)</Text>
              </View>
              {deductions.map((deduction, idx) => (
                <View key={idx} style={[styles.tableRow,idx % 2 === 0 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{deduction.label}</Text>
                  <Text style={[styles.tableCell, styles.mono, { flex: 1, textAlign: 'right', color: '#B91C1C', fontWeight: 'bold' }]}>
                    {formatOMR(deduction.amount)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.totalRow, { borderTopColor: '#B91C1C' }]}>
              <View style={{ flex: 2 }} />
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
                <Text style={styles.totalLabel}>TOTAL DEDUCTIONS</Text>
                <Text style={[styles.totalValue, { color: '#B91C1C' }]}>
                  {formatOMR(totalDeductions)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Net Pay Section */}
        <View style={styles.netPaySection}>
          <View style={[styles.netPayHeader, { backgroundColor: primaryColor }]}>
            <Text style={styles.netPayLabel}>NET PAY</Text>
            <Text style={styles.netPayValue}>OMR {formatOMR(netPay)}</Text>
          </View>
          <View style={[styles.netPayWords, { borderColor: primaryColor }]}>
            <Text style={styles.netPayWordsText}>
              ({toOmaniWords(netPay)})
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a system generated payslip and does not require signature.
          </Text>
          <Text style={styles.footerDate}>
            Generated on {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })} at {new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          <Text style={styles.footerHash}>
            Ref: {company?.wps_mol_id || 'PRO-OM-' + Date.now().toString(16).toUpperCase()}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

const getStyles = (primaryColor: string) => StyleSheet.create({
  page: {
    padding: 10, // Reduced from 15mm to 10mm for single page
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    backgroundColor: '#FFFFFF',
  },

  // ============== HEADER SECTION ==============
  header: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: primaryColor,
    paddingBottom: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FAFAFA',
    padding: 6,
    borderRadius: 2,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: primaryColor,
  },
  logoText: {
    color: primaryColor,
    fontSize: 20,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    lineHeight: 1,
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
    paddingTop: 3,
  },
  companyName: {
    fontSize: 12,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  companyAddress: {
    fontSize: 7,
    color: '#6B7280',
    marginBottom: 1,
    lineHeight: 1.2,
  },
  companyContact: {
    fontSize: 6,
    color: '#9CA3AF',
    marginTop: 0.5,
  },
  headerBadge: {
    alignItems: 'flex-end',
    backgroundColor: primaryColor + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: primaryColor + '30',
  },
  badgeText: {
    fontSize: 5,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: primaryColor,
    letterSpacing: 0.3,
  },
  badgeSubText: {
    fontSize: 4.5,
    color: '#6B7280',
    marginTop: 0.5,
  },

  // ============== TITLE SECTION ==============
  titleContainer: {
    marginBottom: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: primaryColor,
    letterSpacing: 3,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  subTitle: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: 'Helvetica',
    fontWeight: 'normal',
  },

  // ============== EMPLOYEE SECTION ==============
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    backgroundColor: primaryColor,
    color: '#FFFFFF',
    padding: 5,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    borderRadius: 2,
  },
  employeeGrid: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  employeeColumn: {
    flex: 1,
    marginRight: 10,
  },
  employeeRow: {
    flexDirection: 'row',
    marginBottom: 3,
    alignItems: 'flex-start',
    minHeight: 14,
  },
  label: {
    fontSize: 7.5,
    color: '#6B7280',
    width: 70,
    fontFamily: 'Helvetica',
    fontWeight: 'medium',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 9,
    flex: 1,
    fontFamily: 'Helvetica',
    color: '#1F2937',
    fontWeight: 'normal',
    lineHeight: 1.3,
  },
  mono: {
    fontFamily: 'Courier',
    fontWeight: 'bold',
    letterSpacing: 0.3,
    fontSize: 8.5,
  },
  highlightGreen: {
    color: '#047857',
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 8,
  },

  // ============== TABLES ==============
  tableSection: {
    marginBottom: 10,
  },
  tableTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: '#FFFFFF',
    padding: 5,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    backgroundColor: primaryColor,
    borderRadius: 3,
    marginBottom: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  tableHeaderText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    padding: 5,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    minHeight: 20,
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 8,
    padding: 4,
    fontFamily: 'Helvetica',
    color: '#1F2937',
    paddingTop: 3,
    paddingBottom: 3,
    lineHeight: 1.2,
  },
  deductionValue: {
    color: '#B91C1C',
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
  },

  // ============== TOTAL ROWS ==============
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 6,
    borderTopWidth: 2,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  totalLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: primaryColor,
  },

  // ============== NET PAY SECTION ==============
  netPaySection: {
    marginTop: 10,
    marginBottom: 12,
  },
  netPayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginBottom: 2,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderTopColor: primaryColor,
    borderBottomColor: primaryColor,
    backgroundColor: primaryColor,
    borderRadius: 4,
  },
  netPayLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  netPayValue: {
    fontSize: 22,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  netPayWords: {
    padding: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: primaryColor + '40',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderRadius: 3,
  },
  netPayWordsText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    fontStyle: 'italic',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 1.4,
  },

  // ============== FOOTER ==============
  footer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 6,
    borderRadius: 2,
  },
  footerText: {
    fontSize: 6,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 2,
    textAlign: 'center',
  },
  footerDate: {
    fontSize: 5.5,
    color: '#9CA3AF',
    marginBottom: 1.5,
  },
  footerHash: {
    fontSize: 5,
    color: '#D1D5DB',
    fontFamily: 'Courier',
    letterSpacing: 0.2,
  },
});
