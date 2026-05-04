'use client';

import React from 'react';
import { format } from 'date-fns';
import { Company, Employee } from '@/types';

interface JoiningReportStatementProps {
  company: Company;
  employee: Employee;
}

export function JoiningReportStatement({ company, employee }: JoiningReportStatementProps) {
  return (
    <div className="bg-white p-12 text-slate-900 font-serif max-w-[21cm] mx-auto shadow-2xl min-h-[29.7cm] border border-slate-100 print:shadow-none print:border-none print:p-4 print:my-0 print:min-h-0 print:max-w-none print:w-full print:rounded-none flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
        <div>
          {company?.logo_url && (
            <div className="mb-4">
              <img src={company.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-1">{company?.name_en || 'COMPANY NAME'}</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{company?.trade_name || 'Personnel Management & HR Services'}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">CR No: {company?.cr_number || '0000000'} • {company?.contact_phone}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Report Date</p>
          <p className="font-mono text-sm font-bold">{format(new Date(), 'dd MMMM yyyy')}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h2 className="text-xl font-black border-y-2 border-slate-900 py-3 inline-block px-16 tracking-[0.3\em] uppercase italic">Joining Report / Assumption of Duties</h2>
      </div>

      {/* Main Body */}
      <div className="flex-1 space-y-10 text-[14px] leading-loose">
        <p>This is to formally confirm that:</p>

        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 grid grid-cols-2 gap-y-6">
          <div className="space-y-4 border-r border-slate-200 pr-8">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employee Name</p>
              <p className="font-black text-slate-900 uppercase tracking-tight">{employee.name_en}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Employee Code</p>
              <p className="font-mono font-bold text-slate-900">{employee.emp_code}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Designation</p>
              <p className="font-bold text-slate-900 uppercase">{employee.designation}</p>
            </div>
          </div>
          <div className="space-y-4 pl-8">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Date of Assumption</p>
              <p className="font-black text-emerald-700">{employee.join_date ? format(new Date(employee.join_date), 'dd MMMM yyyy') : 'NOT RECORDED'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Department</p>
              <p className="font-bold text-slate-900 uppercase tracking-tight">{employee.department || 'GENERAL OPERATIONS'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Category</p>
              <p className="font-black text-slate-900 uppercase italic opacity-70">{employee.category}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          <p>
            The above-named employee has reported for duty and has officially assumed their assigned responsibilities as of the joining date mentioned above.
          </p>
          <p>
            The employee has been briefed on the company policies, safety protocols, and the terms of the employment contract in accordance with the 
            <span className="font-bold italic mx-1 underline underline-offset-4 decoration-slate-200">Sultanate of Oman Labor Law</span>.
          </p>
        </div>

        <div className="pt-12 grid grid-cols-2 gap-24 text-center">
          <div className="space-y-12">
            <div className="h-16 w-full border-b border-slate-900/10"></div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest">Employee Signature</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Confirmation of Assumption</p>
            </div>
          </div>
          <div className="space-y-12">
            <div className="h-16 w-full border-b border-slate-900/10"></div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest">Department Head / HR Manager</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Verified & Approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branded Bar */}
      <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-center text-[8px] font-black italic text-slate-400 tracking-widest uppercase print:pt-4">
        <span>© {new Date().getFullYear()} {company?.name_en} • OFFICIAL PERSONNEL RECORD</span>
        <span>FOR ADMINISTRATIVE USE ONLY</span>
      </div>
    </div>
  );
}
