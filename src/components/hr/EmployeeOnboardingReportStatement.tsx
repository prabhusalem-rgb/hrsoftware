'use client';

import React from 'react';
import { format } from 'date-fns';
import { Employee, Company } from '@/types';

interface EmployeeOnboardingReportStatementProps {
  company: Company;
  employee: Employee;
}

export function EmployeeOnboardingReportStatement({ company, employee }: EmployeeOnboardingReportStatementProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  const totalGross = employee.basic_salary + employee.housing_allowance + employee.transport_allowance +
    employee.food_allowance + employee.special_allowance + employee.site_allowance + employee.other_allowance;

  return (
    <div className="bg-white p-12 text-slate-900 font-serif max-w-[21cm] mx-auto shadow-2xl min-h-[29.7cm] border border-slate-100 print:shadow-none print:border-none print:p-6 print:my-0 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
        <div>
          {company?.logo_url && (
            <div className="mb-4">
              <img src={company.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-1">{company?.name_en || 'COMPANY NAME'}</h1>
          {company?.trade_name && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{company.trade_name}</p>
          )}
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{company?.address || 'PO BOX - 51, MUSCAT, OMAN'}</p>
          {company?.cr_number && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">CR No: {company.cr_number}</p>}
          {company?.contact_phone && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Phone: {company.contact_phone}</p>}
        </div>
        <div className="text-right">
          <div className="bg-slate-950 text-white px-4 py-2 rounded-xl shadow-xl mb-3">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest text-center">Report Date</p>
            <p className="font-mono text-xs font-bold">{formatDate(new Date().toISOString().split('T')[0])}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-black border-y-2 border-slate-900 py-3 inline-block px-12 tracking-[0.3em] uppercase italic">Comprehensive Onboarding Documentation</h2>
        <p className="text-xs text-slate-500 font-medium italic mt-2">New Employee Integration Record</p>
      </div>

      {/* 1. Employee Identification */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">1. IDENTIFICATION DETAILS</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employee Code</p>
              <p className="font-mono font-bold text-sm">{employee.emp_code}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Full Name (English)</p>
              <p className="text-sm font-bold uppercase tracking-tight">{employee.name_en}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Nationality</p>
              <p className="text-sm">{employee.nationality}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Gender</p>
              <p className="text-sm">{employee.gender || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">ID Type</p>
              <p className="text-sm uppercase">{employee.id_type === 'passport' ? 'Passport' : 'Civil ID'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Passport Number</p>
              <p className="font-mono text-sm">{employee.passport_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Passport Issue Date</p>
              <p className="text-sm">{formatDate(employee.passport_issue_date)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Passport Expiry</p>
              <p className="text-sm">{formatDate(employee.passport_expiry)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Civil ID</p>
              <p className="font-mono text-sm">{employee.civil_id || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Employment Details */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">2. EMPLOYMENT PARTICULARS</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Designation</p>
              <p className="text-sm font-bold uppercase tracking-tight">{employee.designation}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Department</p>
              <p className="text-sm">{employee.department}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employee Category</p>
              <p className="text-sm italic uppercase">{employee.category}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Reporting To</p>
              <p className="text-sm">{employee.reporting_to || 'To be assigned'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Join Date</p>
              <p className="text-sm font-bold" style={{ color: '#1e3a5f' }}>{formatDate(employee.join_date)}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employment Status</p>
              <span className="inline-block bg-slate-100 px-2 py-1 rounded text-xs font-bold uppercase">{employee.status.replace('_', ' ')}</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Onboarding Status</p>
              <span className="inline-block bg-emerald-100 px-2 py-1 rounded text-xs font-bold uppercase text-emerald-700">{employee.onboarding_status?.replace('_', ' ').toUpperCase() || 'N/A'}</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Offer Accepted</p>
              <p className="text-sm">{employee.offer_accepted_at ? formatDate(employee.offer_accepted_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Offer Sent</p>
              <p className="text-sm">{employee.last_offer_sent_at ? formatDate(employee.last_offer_sent_at) : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Compensation Structure */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">3. COMPENSATION STRUCTURE</h3>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-900 px-4 py-2 grid grid-cols-2 gap-4">
            <span className="text-[9px] font-bold uppercase text-white">Component</span>
            <span className="text-[9px] font-bold uppercase text-white text-right">Amount (OMR)</span>
          </div>
          <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
            <span className="text-sm">Basic Salary</span>
            <span className="font-mono text-sm text-right">{employee.basic_salary.toFixed(3)}</span>
          </div>
          <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
            <span className="text-sm">Housing Allowance</span>
            <span className="font-mono text-sm text-right">{employee.housing_allowance.toFixed(3)}</span>
          </div>
          <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
            <span className="text-sm">Transport Allowance</span>
            <span className="font-mono text-sm text-right">{employee.transport_allowance.toFixed(3)}</span>
          </div>
          {employee.food_allowance > 0 && (
            <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
              <span className="text-sm">Food Allowance</span>
              <span className="font-mono text-sm text-right">{employee.food_allowance.toFixed(3)}</span>
            </div>
          )}
          {employee.special_allowance > 0 && (
            <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
              <span className="text-sm">Special Allowance</span>
              <span className="font-mono text-sm text-right">{employee.special_allowance.toFixed(3)}</span>
            </div>
          )}
          {employee.site_allowance > 0 && (
            <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
              <span className="text-sm">Site Allowance</span>
              <span className="font-mono text-sm text-right">{employee.site_allowance.toFixed(3)}</span>
            </div>
          )}
          {employee.other_allowance > 0 && (
            <div className="border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-4">
              <span className="text-sm">Other Allowances</span>
              <span className="font-mono text-sm text-right">{employee.other_allowance.toFixed(3)}</span>
            </div>
          )}
          <div className="bg-slate-50 px-4 py-2 grid grid-cols-2 gap-4">
            <span className="text-sm font-bold uppercase">TOTAL GROSS</span>
            <span className="font-mono text-sm font-bold text-right" style={{ color: '#1e3a5f' }}>{totalGross.toFixed(3)} OMR</span>
          </div>
        </div>
      </div>

      {/* 4. Visa & Immigration */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">4. VISA & IMMIGRATION STATUS</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Visa Number</p>
              <p className="font-mono text-sm">{employee.visa_no || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Visa Type</p>
              <p className="text-sm">{employee.visa_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Visa Issue Date</p>
              <p className="text-sm">{formatDate(employee.visa_issue_date)}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Visa Expiry Date</p>
              <p className="text-sm">{formatDate(employee.visa_expiry)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employment Category</p>
              <p className="text-sm italic uppercase">{employee.category}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Emergency & Home Contact */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">5. EMERGENCY & HOME CONTACT</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Emergency Contact Name</p>
              <p className="text-sm font-bold">{employee.emergency_contact_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Emergency Contact Phone</p>
              <p className="font-mono text-sm">{employee.emergency_contact_phone || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Home Country Address</p>
              <p className="text-sm leading-relaxed">{employee.home_country_address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Banking Details */}
      <div className="space-y-6 mb-8">
        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-3">6. BANKING & ADMINISTRATIVE DETAILS</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Bank Name</p>
              <p className="text-sm">{employee.bank_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Bank BIC / SWIFT</p>
              <p className="font-mono text-sm">{employee.bank_bic || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">IBAN Number</p>
              <p className="font-mono text-sm">{employee.bank_iban || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">WPS Registered</p>
              <p className={`text-sm font-bold ${employee.bank_iban ? 'text-emerald-600' : 'text-red-600'}`}>
                {employee.bank_iban ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-auto pt-12 border-t border-slate-200 flex justify-between">
        <div className="text-center">
          <div className="border-b border-slate-300 w-3/4 mx-auto mb-2"></div>
          <p className="text-xs font-black uppercase tracking-widest">HR Representative</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Authorized Signatory</p>
          <p className="text-[10px] italic text-slate-500">{formatDate(new Date().toISOString().split('T')[0])}</p>
        </div>
        <div className="text-center">
          <div className="border-b border-slate-300 w-3/4 mx-auto mb-2"></div>
          <p className="text-xs font-black uppercase tracking-widest">Employee</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase">Confirmation of Onboarding</p>
          <p className="text-[10px] italic text-slate-500">Date: _________________</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between text-[10px] font-black italic text-slate-400 tracking-widest">
        <span>© {new Date().getFullYear()} {company?.name_en || 'COMPANY'} • CONFIDENTIAL ONBOARDING RECORD</span>
        <span>Generated: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
      </div>
    </div>
  );
}
