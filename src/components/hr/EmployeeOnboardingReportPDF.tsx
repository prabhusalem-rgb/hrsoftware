'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Employee, Company } from '@/types';
import { format } from 'date-fns';

interface Props {
  employee: Employee;
  company: Company;
  showLogo?: boolean;
  primaryColor?: string;
}

export function EmployeeOnboardingReportPDF({ employee, company, showLogo = true, primaryColor = '#1e3a5f' }: Props) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try { return format(new Date(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
  };

  const totalGross = employee.basic_salary + employee.housing_allowance + employee.transport_allowance +
    employee.food_allowance + employee.special_allowance + employee.site_allowance + employee.other_allowance;

  const styles = getStyles();

  return (
    <Document>
      {/* Page 1 - All Content */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLogoSection}>
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
            <View style={styles.headerLeft}>
              <Text style={styles.companyName}>{company?.name_en || 'COMPANY NAME'}</Text>
              {company?.trade_name && <Text style={styles.companyTrade}>{company.trade_name}</Text>}
              <Text style={styles.companyAddress}>{company?.address || 'PO BOX - 51, MUSCAT, OMAN'}</Text>
              {company?.cr_number && <Text style={styles.companyCR}>CR No: {company.cr_number}</Text>}
              {company?.contact_phone && <Text style={styles.companyContact}>Tel: {company.contact_phone}</Text>}
            </View>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.badgeTitle}>EMPLOYEE ONBOARDING REPORT</Text>
            <Text style={styles.badgeDate}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.title}>Comprehensive Onboarding Report</Text>
        </View>

        {/* 1. IDENTIFICATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. IDENTIFICATION DETAILS</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '35%' }]}>
              <View style={styles.field}><Text style={styles.label}>Employee Code</Text><Text style={styles.value}>{employee.emp_code}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Name (EN)</Text><Text style={[styles.value, styles.bold]}>{employee.name_en}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Nationality</Text><Text style={styles.value}>{employee.nationality}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Gender</Text><Text style={styles.value}>{employee.gender || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Religion</Text><Text style={styles.value}>{employee.religion || 'N/A'}</Text></View>
            </View>
            <View style={[styles.col, { width: '65%' }]}>
              <View style={styles.field}><Text style={styles.label}>ID Type</Text><Text style={styles.value}>{employee.id_type === 'passport' ? 'Passport' : 'Civil ID'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Passport No</Text><Text style={[styles.value, styles.mono]}>{employee.passport_no || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Passport Issue</Text><Text style={styles.value}>{formatDate(employee.passport_issue_date)}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Passport Expiry</Text><Text style={styles.value}>{formatDate(employee.passport_expiry)}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Civil ID</Text><Text style={[styles.value, styles.mono]}>{employee.civil_id || '—'}</Text></View>
            </View>
          </View>
        </View>

        {/* 2. EMPLOYMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. EMPLOYMENT PARTICULARS</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Designation</Text><Text style={[styles.value, styles.uppercase]}>{employee.designation}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Department</Text><Text style={styles.value}>{employee.department}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Category</Text><Text style={[styles.value, styles.italic]}>{employee.category.toUpperCase()}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Reporting To</Text><Text style={styles.value}>{employee.reporting_to || '—'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Join Date</Text><Text style={[styles.value, { color: '#1e3a5f' }]}>{formatDate(employee.join_date)}</Text></View>
            </View>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Status</Text><Text style={styles.badge}>{employee.status.replace('_', ' ').toUpperCase()}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Onboarding</Text><Text style={[styles.badge, styles.badgeGreen]}>{employee.onboarding_status?.replace('_', ' ').toUpperCase() || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Offer Accepted</Text><Text style={styles.value}>{employee.offer_accepted_at ? formatDate(employee.offer_accepted_at) : 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Offer Sent</Text><Text style={styles.value}>{employee.last_offer_sent_at ? formatDate(employee.last_offer_sent_at) : 'N/A'}</Text></View>
            </View>
          </View>
        </View>

        {/* 3. COMPENSATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. COMPENSATION STRUCTURE</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Component</Text>
              <Text style={styles.tableCell}>OMR</Text>
            </View>
            <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Basic Salary</Text><Text style={[styles.tableCell, styles.mono]}>{employee.basic_salary.toFixed(3)}</Text></View>
            <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Housing Allowance</Text><Text style={[styles.tableCell, styles.mono]}>{employee.housing_allowance.toFixed(3)}</Text></View>
            <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Transport Allowance</Text><Text style={[styles.tableCell, styles.mono]}>{employee.transport_allowance.toFixed(3)}</Text></View>
            {employee.food_allowance > 0 && <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Food Allowance</Text><Text style={[styles.tableCell, styles.mono]}>{employee.food_allowance.toFixed(3)}</Text></View>}
            {employee.special_allowance > 0 && <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Special Allowance</Text><Text style={[styles.tableCell, styles.mono]}>{employee.special_allowance.toFixed(3)}</Text></View>}
            {employee.site_allowance > 0 && <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Site Allowance</Text><Text style={[styles.tableCell, styles.mono]}>{employee.site_allowance.toFixed(3)}</Text></View>}
            {employee.other_allowance > 0 && <View style={styles.tableRow}><Text style={[styles.tableCell, { flex: 2 }]}>Other Allowances</Text><Text style={[styles.tableCell, styles.mono]}>{employee.other_allowance.toFixed(3)}</Text></View>}
            <View style={[styles.tableRow, styles.tableTotal]}>
              <Text style={[styles.tableCell, { flex: 2 }, styles.totalLabel]}>TOTAL GROSS</Text>
              <Text style={[styles.tableCell, styles.mono, styles.totalValue]}>{totalGross.toFixed(3)} OMR</Text>
            </View>
          </View>
        </View>

        {/* 4. OPENING ENTITLEMENTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. OPENING ENTITLEMENTS</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Opening Leave Balance</Text><Text style={[styles.value, { color: '#059669' }]}>{employee.opening_leave_balance} days</Text></View>
            </View>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Opening Air Tickets</Text><Text style={[styles.value, { color: '#059669' }]}>{employee.opening_air_tickets} entitlement(s)</Text></View>
            </View>
          </View>
        </View>
      </Page>

      {/* Page 2 - Remaining Sections */}
      <Page size="A4" style={styles.page}>
        {/* 5. VISA & IMMIGRATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. VISA & IMMIGRATION STATUS</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Visa Number</Text><Text style={[styles.value, styles.mono]}>{employee.visa_no || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Visa Type</Text><Text style={styles.value}>{employee.visa_type || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Visa Issue Date</Text><Text style={styles.value}>{formatDate(employee.visa_issue_date)}</Text></View>
            </View>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Visa Expiry</Text><Text style={styles.value}>{formatDate(employee.visa_expiry)}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Category</Text><Text style={[styles.value, styles.uppercase]}>{employee.category}</Text></View>
            </View>
          </View>
        </View>

        {/* 6. EMERGENCY CONTACT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. EMERGENCY & HOME CONTACT</Text>
          <View style={styles.row}>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Emergency Contact</Text><Text style={[styles.value, styles.bold]}>{employee.emergency_contact_name || 'N/A'}</Text></View>
              <View style={styles.field}><Text style={styles.label}>Emergency Phone</Text><Text style={[styles.value, styles.mono]}>{employee.emergency_contact_phone || 'N/A'}</Text></View>
            </View>
            <View style={[styles.col, { width: '50%' }]}>
              <View style={styles.field}><Text style={styles.label}>Home Country Address</Text><Text style={[styles.value, styles.multiline]}>{employee.home_country_address || 'N/A'}</Text></View>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>HR Representative</Text>
            <Text style={styles.signatureDate}>{formatDate(new Date().toISOString().split('T')[0])}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureTitle}>Employee</Text>
            <Text style={styles.signatureDate}>Date: _________________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>© {new Date().getFullYear()} {company?.name_en || 'COMPANY'} • CONFIDENTIAL</Text>
          <Text style={styles.footerRight}>Page 2 of 2</Text>
        </View>
      </Page>
    </Document>
  );
}

function getStyles() {
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
    headerLogoSection: {
      flexDirection: 'row',
      flex: 1,
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
    logo: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    logoText: {
      color: 'white',
      fontSize: 20,
      fontWeight: 'bold',
    },
    headerLeft: {
      flex: 1,
      paddingRight: 10,
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
    companyCR: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 1,
    },
    companyContact: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#64748b',
      marginTop: 2,
    },
    headerBadge: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      backgroundColor: '#1e3a5f',
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
      borderColor: '#1e3a5f',
      paddingVertical: 6,
      letterSpacing: 1,
      width: '100%',
    },
    section: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#1e3a5f',
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
    multiline: {
      lineHeight: 1.2,
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
    badgeGreen: {
      backgroundColor: '#ecfdf5',
      color: '#059669',
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
      backgroundColor: '#1e3a5f',
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
      color: '#1e3a5f',
    },
    signatureSection: {
      flexDirection: 'row',
      marginTop: 'auto',
      paddingTop: 25,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
    },
    signatureBlock: {
      flex: 1,
      alignItems: 'center',
    },
    signatureLine: {
      width: '50%',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      marginBottom: 6,
      marginTop: 30,
    },
    signatureTitle: {
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textAlign: 'center',
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
