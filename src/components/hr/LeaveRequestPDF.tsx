'use client';

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { LeaveRequest, Employee, Company } from '@/types';
import { format } from 'date-fns';

interface LeaveRequestPDFProps {
  leaveRequest: LeaveRequest & { employee: Employee; company: Company };
  showLogo?: boolean;
  primaryColor?: string;
}

export function LeaveRequestPDF({
  leaveRequest,
  showLogo = true,
  primaryColor = '#2563eb'
}: LeaveRequestPDFProps) {
  const { employee, company } = leaveRequest;

  // UTC day calculation
  const parseDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
  };
  const s = parseDate(leaveRequest.start_date);
  const e = parseDate(leaveRequest.end_date);
  const startUtc = Date.UTC(s.y, s.m - 1, s.d);
  const endUtc = Date.UTC(e.y, e.m - 1, e.d);
  const days = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;

  const startDate = new Date(startUtc);
  const endDate = new Date(endUtc);
  const formatDate = (d: Date) => format(d, 'dd/MM/yyyy');

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'PENDING',
      hr_approved: 'HR APPROVED',
      ops_approved: 'OPS APPROVED',
      gm_approved: 'GM/CEO APPROVED',
      rejected: 'REJECTED',
    };
    return labels[status] || status.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#F59E0B',
      hr_approved: '#2563EB',
      ops_approved: '#9333EA',
      gm_approved: '#059669',
      rejected: '#DC2626',
    };
    return colors[status] || '#6B7280';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <View>
            <Text style={styles.headerTitle}>LEAVE REQUEST</Text>
            <Text style={styles.headerSubtitle}>Official Record</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leaveRequest.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(leaveRequest.status)}</Text>
          </View>
        </View>

        {/* Company */}
        <View style={styles.companyRow}>
          {showLogo && company.logo_url ? (
            <Image src={company.logo_url} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: primaryColor }]}>
              <Text style={styles.logoText}>{company.name_en?.charAt(0) || 'C'}</Text>
            </View>
          )}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name_en}</Text>
            <Text style={styles.companyCR}>CR: {company.cr_number}</Text>
          </View>
        </View>

        {/* Section 1: Employee */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>EMPLOYEE INFORMATION</Text>
          <View style={styles.contentBox}>
            <View style={styles.empRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{employee.name_en?.charAt(0) || 'E'}</Text>
              </View>
              <View style={styles.empInfo}>
                <Text style={styles.empName}>{employee.name_en}</Text>
                <Text style={styles.empRole}>{employee.designation}</Text>
                <Text style={styles.empDept}>{employee.department}</Text>
                <Text style={styles.empCode}>Emp Code: {employee.emp_code}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Leave Details */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>LEAVE DETAILS</Text>
          <View style={styles.contentBox}>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Type</Text>
                <View style={[styles.typeBadge, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.typeText, { color: primaryColor }]}>{leaveRequest.leave_type}</Text>
                </View>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Days</Text>
                <Text style={styles.daysValue}>{days}</Text>
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateCell}>
                <Text style={styles.dateLabel}>Start</Text>
                <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
              </View>
              <Text style={styles.dateArrow}>→</Text>
              <View style={styles.dateCell}>
                <Text style={styles.dateLabel}>End</Text>
                <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
              </View>
            </View>

            <View style={styles.destRow}>
              <Text style={styles.destLabel}>Destination</Text>
              <Text style={styles.destValue}>{leaveRequest.sector}</Text>
            </View>

            {leaveRequest.leave_type === 'Annual Leave' && (
              <View style={styles.impactRow}>
                <Text style={styles.impactText}>
                  <Text style={styles.impactBold}>{days} days</Text> deducted from annual leave balance upon settlement.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Section 3: Approval */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>APPROVAL WORKFLOW</Text>
          <View style={styles.apprGrid}>
            {/* Employee */}
            <View style={[styles.apprCard, leaveRequest.employee_signature_url ? styles.apprDone : styles.apprPending]}>
              <View style={styles.apprHeader}>
                <Text style={styles.apprRole}>Employee</Text>
                <View style={[styles.apprBadge, { backgroundColor: leaveRequest.employee_signed_at ? '#10B981' : '#F59E0B' }]}>
                  <Text style={styles.apprBadgeText}>{leaveRequest.employee_signed_at ? 'SIGNED' : 'PENDING'}</Text>
                </View>
              </View>
              {leaveRequest.employee_signature_url ? (
                <Image src={leaveRequest.employee_signature_url} style={styles.sigImage} />
              ) : (
                <View style={styles.sigPlaceholder}><Text style={styles.sigPlaceholderText}>—</Text></View>
              )}
              <Text style={styles.apprName}>{employee.name_en}</Text>
              <Text style={styles.apprDate}>
                {leaveRequest.employee_signed_at ? format(new Date(leaveRequest.employee_signed_at), 'dd/MM/yyyy HH:mm') : '—'}
              </Text>
            </View>

            {/* HR */}
            <View style={[styles.apprCard, leaveRequest.hr_id ? styles.apprDone : styles.apprPending]}>
              <View style={styles.apprHeader}>
                <Text style={styles.apprRole}>HR Manager</Text>
                <View style={[styles.apprBadge, { backgroundColor: leaveRequest.hr_id ? '#10B981' : '#F59E0B' }]}>
                  <Text style={styles.apprBadgeText}>{leaveRequest.hr_id ? 'APPROVED' : 'PENDING'}</Text>
                </View>
              </View>
              {leaveRequest.hr_signature_url ? (
                <Image src={leaveRequest.hr_signature_url} style={styles.sigImage} />
              ) : (
                <View style={styles.sigPlaceholder}><Text style={styles.sigPlaceholderText}>—</Text></View>
              )}
              {leaveRequest.hr_remarks && <Text style={styles.remarkText}>"{leaveRequest.hr_remarks}"</Text>}
              <Text style={styles.apprName}>{leaveRequest.hr_id ? 'HR Manager' : '—'}</Text>
              <Text style={styles.apprDate}>
                {leaveRequest.hr_approved_at ? format(new Date(leaveRequest.hr_approved_at), 'dd/MM/yyyy HH:mm') : '—'}
              </Text>
            </View>

            {/* Operations */}
            <View style={[styles.apprCard, leaveRequest.ops_id ? styles.apprDone : styles.apprPending]}>
              <View style={styles.apprHeader}>
                <Text style={styles.apprRole}>Operations</Text>
                <View style={[styles.apprBadge, { backgroundColor: leaveRequest.ops_id ? '#10B981' : '#F59E0B' }]}>
                  <Text style={styles.apprBadgeText}>{leaveRequest.ops_id ? 'APPROVED' : 'PENDING'}</Text>
                </View>
              </View>
              {leaveRequest.ops_signature_url ? (
                <Image src={leaveRequest.ops_signature_url} style={styles.sigImage} />
              ) : (
                <View style={styles.sigPlaceholder}><Text style={styles.sigPlaceholderText}>—</Text></View>
              )}
              {leaveRequest.ops_remarks && <Text style={styles.remarkText}>"{leaveRequest.ops_remarks}"</Text>}
              <Text style={styles.apprName}>{leaveRequest.ops_id ? 'Ops Manager' : '—'}</Text>
              <Text style={styles.apprDate}>
                {leaveRequest.ops_approved_at ? format(new Date(leaveRequest.ops_approved_at), 'dd/MM/yyyy HH:mm') : '—'}
              </Text>
            </View>

            {/* GM/CEO */}
            <View style={[styles.apprCard, leaveRequest.gm_id ? styles.apprDone : styles.apprPending]}>
              <View style={styles.apprHeader}>
                <Text style={styles.apprRole}>GM / CEO</Text>
                <View style={[styles.apprBadge, { backgroundColor: leaveRequest.gm_id ? '#10B981' : '#F59E0B' }]}>
                  <Text style={styles.apprBadgeText}>{leaveRequest.gm_id ? 'APPROVED' : 'PENDING'}</Text>
                </View>
              </View>
              {leaveRequest.gm_signature_url ? (
                <Image src={leaveRequest.gm_signature_url} style={styles.sigImage} />
              ) : (
                <View style={styles.sigPlaceholder}><Text style={styles.sigPlaceholderText}>—</Text></View>
              )}
              {leaveRequest.gm_remarks && <Text style={styles.remarkText}>"{leaveRequest.gm_remarks}"</Text>}
              <Text style={styles.apprName}>{leaveRequest.gm_id ? 'GM / CEO' : '—'}</Text>
              <Text style={styles.apprDate}>
                {leaveRequest.gm_approved_at ? format(new Date(leaveRequest.gm_approved_at), 'dd/MM/yyyy HH:mm') : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: primaryColor }]}>
          <Text style={styles.footerText}>ID: {leaveRequest.id} · {format(new Date(), 'dd/MM/yyyy HH:mm')}</Text>
          <Text style={styles.footerNote}>Computer-generated document</Text>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 15,
    fontFamily: 'Helvetica',
    backgroundColor: '#fff',
    fontSize: 8,
    lineHeight: 1.25,
  },

  // Header
  header: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  statusText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
  },

  // Company
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logo: {
    width: 32,
    height: 32,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  companyInfo: {
    gap: 1,
    flex: 1,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  companyCR: {
    fontSize: 8,
    color: '#64748b',
  },

  // Sections
  section: {
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.8,
    backgroundColor: '#f1f5f9',
    padding: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  contentBox: {
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  // Employee
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  empInfo: {
    gap: 3,
    flex: 1,
  },
  empName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  empRole: {
    fontSize: 8,
    color: '#64748b',
  },
  empDept: {
    fontSize: 8,
    color: '#64748b',
  },
  empCode: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    gap: 20,
  },
  infoCell: {
    gap: 2,
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  daysValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateCell: {
    alignItems: 'center',
    flex: 1,
  },
  dateLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  dateArrow: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: 'bold',
  },

  // Destination
  destRow: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  destLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  destValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },

  // Impact
  impactRow: {
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
  },
  impactText: {
    fontSize: 9,
    color: '#78350f',
    lineHeight: 1.3,
  },
  impactBold: {
    fontWeight: 'bold',
  },

  // Approval grid (2x2)
  apprGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  apprCard: {
    width: '48%',
    padding: 8,
    borderRadius: 6,
    borderWidth: 2,
    gap: 3,
  },
  apprDone: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  apprPending: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  apprHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  apprRole: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
  },
  apprBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  apprBadgeText: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#fff',
  },
  sigImage: {
    width: '100%',
    height: 30,
    objectFit: 'contain',
    backgroundColor: '#fff',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  sigPlaceholder: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  sigPlaceholderText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  remarkText: {
    fontSize: 8,
    color: '#78350f',
    fontStyle: 'italic',
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
    marginTop: 1,
  },
  apprName: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 'auto',
  },
  apprDate: {
    fontSize: 7,
    color: '#94a3b8',
  },

  // Footer
  footer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderTopWidth: 2,
    alignItems: 'center',
    gap: 2,
  },
  footerText: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 6,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
