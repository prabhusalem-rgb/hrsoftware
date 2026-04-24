'use client';

import React from 'react';
import { format } from 'date-fns';
import { Company } from '@/types';
import { toOmaniWords } from '@/lib/utils/currency';

interface OfferLetterStatementProps {
  company: Company;
  candidate: {
    name: string;
    nationality: string;
    passport_no: string;
    designation: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    probation_period: string;
    notice_period: string;
    join_date: string;
    air_ticket_frequency: string;
    additional_points?: string[];
  };
}

export function OfferLetterStatement({ company, candidate }: OfferLetterStatementProps) {
  const totalGross = candidate.basic_salary + candidate.housing_allowance + candidate.transport_allowance + candidate.other_allowance;

  return (
    <div className="bg-white p-16 text-slate-900 font-serif max-w-[21cm] mx-auto shadow-2xl min-h-[29.7cm] border border-slate-100 print:shadow-none print:border-none flex flex-col scale-[1.05] sm:scale-100 transition-transform relative overflow-hidden">
      {/* Draft Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-[0.03] text-[120px] font-black text-slate-900 whitespace-nowrap select-none print:hidden">
        PROVISIONAL DRAFT
      </div>

      {/* Premium Letterhead with Oman Accents */}
      <div className="flex justify-between items-start mb-16 relative">
        <div className="absolute -top-16 -left-16 w-32 h-1 bg-primary" />
        <div className="absolute -top-16 -left-16 h-32 w-1 bg-primary" />

        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">
            {company?.name_en || 'COMPANY NAME'}
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 bg-primary" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Official Corporate Correspondence
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
              Registered Office: {company?.address || 'Muscat, Sultanate of Oman'}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              CR No: {company?.cr_number || '0000000'} • {company?.contact_phone}
            </p>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="bg-slate-950 text-white px-6 py-3 rounded-2xl shadow-xl mb-4">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest text-center">
              Ref. Code
            </p>
            <p className="font-mono text-xs font-bold whitespace-nowrap">
              OM/HR/{new Date().getFullYear()}/{Math.floor(Math.random() * 10000)}
            </p>
          </div>
          <div className="pr-2">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Issue Date</p>
            <p className="font-serif text-sm font-bold italic">
              {format(new Date(), 'dd MMMM yyyy')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-8 text-[13px] leading-relaxed">
        <div className="mb-8">
          <p className="font-bold">To: {candidate.name}</p>
          <p>Passport No: {candidate.passport_no}</p>
          <p>Nationality: {candidate.nationality}</p>
        </div>

        <div className="text-center font-black underline uppercase text-base tracking-widest mb-6">
          Subject: Offer of Employment - {candidate.designation}
        </div>

        <p>Dear {candidate.name.split(' ')[0]},</p>

        <p>
          On behalf of <span className="font-bold">{company?.name_en}</span>, we are pleased to offer you the position of{' '}
          <span className="font-bold uppercase mx-1">{candidate.designation}</span>.
          We believe your skills and experience will be a valuable asset to our organization.
        </p>

        {/* Compensation & Benefits */}
        <div>
          <p className="font-bold underline mb-3 uppercase text-[11px] tracking-widest">
            1. Compensation & Benefits
          </p>
          <p>Your monthly consolidated salary will be structured as follows:</p>
          <table className="w-[80%] mx-auto mt-4 mb-4 border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-600 font-medium">Basic Salary</td>
                <td className="py-2 text-right font-bold font-mono">
                  {candidate.basic_salary.toFixed(3)} OMR
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-600 font-medium">Housing Allowance</td>
                <td className="py-2 text-right font-bold font-mono">
                  {candidate.housing_allowance.toFixed(3)} OMR
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-600 font-medium">Transport Allowance</td>
                <td className="py-2 text-right font-bold font-mono">
                  {candidate.transport_allowance.toFixed(3)} OMR
                </td>
              </tr>
              {candidate.other_allowance > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600 font-medium">Other Allowances</td>
                  <td className="py-2 text-right font-bold font-mono">
                    {candidate.other_allowance.toFixed(3)} OMR
                  </td>
                </tr>
              )}
              <tr className="bg-slate-50 font-black">
                <td className="py-2 px-2 uppercase text-[11px]">Total Gross Salary</td>
                <td className="py-2 px-2 text-right font-mono text-primary italic underline underline-offset-4 decoration-2">
                  {totalGross.toFixed(3)} OMR
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] font-bold italic text-slate-500 mt-2 text-center uppercase tracking-tight">
            ({toOmaniWords(totalGross)})
          </p>
        </div>

        {/* Employment Terms */}
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="text-xs font-bold text-white">02</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Employment Terms
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                Key conditions of your employment
              </p>
            </div>
          </div>

          {/* Terms Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {/* Probation Period */}
            <div className="group">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 group-hover:bg-primary transition-colors duration-200 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Probation Period
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    <span className="font-semibold text-slate-900">{candidate.probation_period}</span> from your joining date. During probation, notice period follows Omani Labor Law.
                  </p>
                </div>
              </div>
            </div>

            {/* Notice Period */}
            <div className="group">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 group-hover:bg-primary transition-colors duration-200 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Notice Period
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    <span className="font-semibold text-slate-900">{candidate.notice_period}</span> notice applies post-probation for resignation or termination.
                  </p>
                </div>
              </div>
            </div>

            {/* Medical Coverage */}
            <div className="group">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 group-hover:bg-primary transition-colors duration-200 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Medical Coverage
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    Comprehensive medical insurance provided throughout your employment tenure.
                  </p>
                </div>
              </div>
            </div>

            {/* Annual Leave */}
            <div className="group">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 group-hover:bg-primary transition-colors duration-200 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Annual Leave
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    <span className="font-semibold text-slate-900">30 days</span> paid annual leave per completed service year.
                  </p>
                </div>
              </div>
            </div>

            {/* Air Ticket */}
            <div className="group col-span-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-400 group-hover:bg-primary transition-colors duration-200 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Air Ticket
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    Economy class return air tickets to home country{' '}
                    <span className="font-semibold text-slate-900">
                      {candidate.air_ticket_frequency.toLowerCase()}
                    </span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Repayment Obligation */}
            <div className="group col-span-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-slate-900 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Repayment Obligation
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Resignation within{' '}
                    <span className="font-semibold text-slate-900">two (2) years</span> requires reimbursement of recruitment fees, visa processing costs, and one-way flight expenses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-24 mt-16 pb-12">
          <div className="space-y-12">
            <div className="h-16 w-full border-b border-slate-300" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest">{company?.name_en}</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                Authorized Signatory
              </p>
            </div>
          </div>
          <div className="space-y-12">
            <div className="h-16 w-full border-b border-slate-300" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest">{candidate.name}</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                Candidate's Acceptance
              </p>
            </div>
          </div>
        </div>

        {/* Footer Branded Bar */}
        <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-center text-[8px] font-black italic text-slate-400 tracking-widest">
          <span>© {new Date().getFullYear()} {company?.name_en} • HR PROCUREMENT SYSTEM</span>
          <span>CONFIDENTIAL • OMAN LABOR LAW COMPLIANT</span>
        </div>
      </div>
    </div>
  );
}
