'use client';

import React from 'react';
import { format } from 'date-fns';
import { Company, Employee, PayrollItem } from '@/types';
import { toOmaniWords } from '@/lib/utils/currency';

interface FinalSettlementStatementProps {
  company: Company;
  employee: Employee;
  item: Partial<PayrollItem> & { settlement_date?: string };
  notes?: string;
}

export function FinalSettlementStatement({ company, employee, item, notes }: FinalSettlementStatementProps) {
  const settlementDate = item.settlement_date ? new Date(item.settlement_date) : new Date();
  
  // Earnings & Deductions breakdown (estimated from the item)
  const earnings = [
    { label: 'Basic Salary (Partial)', value: item.basic_salary || 0 },
    { label: 'Housing Allowance', value: item.housing_allowance || 0 },
    { label: 'Transport Allowance', value: item.transport_allowance || 0 },
    { label: 'Leave Encashment', value: item.leave_encashment || 0 },
    { label: 'End of Service Gratuity (EOSB)', value: item.eosb_amount || 0 },
  ].filter(e => e.value > 0);

  const deductions = [
    { label: 'Loan Recovery', value: item.loan_deduction || 0 },
    { label: 'Other Deductions', value: item.other_deduction || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white p-6 md:p-8 text-slate-900 font-serif max-w-[210mm] mx-auto shadow-2xl border border-slate-100 print:shadow-none print:border-none print:p-0 print:border-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 mb-1">{company?.name_en || 'AL ZAHRA TECHNOLOGY LLC'}</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CR No: {company?.cr_number || '1234567'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Statement Date</p>
          <p className="font-mono text-sm font-bold">{format(new Date(), 'dd MMMM yyyy')}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h2 className="text-xl font-black border-y-2 border-slate-900 py-3 inline-block px-16 tracking-[0.3em] uppercase">Final Settlement Statement</h2>
      </div>

      {/* Employee & Service Info */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-6 text-[12px] mb-12 leading-relaxed">
        <div className="space-y-3">
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Employee Code</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="font-mono text-slate-900 font-bold">{employee.emp_code}</span>
          </div>
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Joining Date</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="text-slate-900 font-bold">{employee.join_date ? format(new Date(employee.join_date), 'dd MMM yyyy') : '-'}</span>
          </div>
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Department</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="text-slate-900 font-bold uppercase">{employee.department || '-'}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Employee Name</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="uppercase text-slate-900 font-black tracking-tight">{employee.name_en}</span>
          </div>
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Termination Date</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="text-slate-900 font-black">{format(settlementDate, 'dd MMM yyyy')}</span>
          </div>
          <div className="flex items-center border-b border-slate-100 pb-1">
            <span className="w-32 font-bold text-slate-500 uppercase text-[9px] tracking-tight shrink-0">Designation</span>
            <span className="w-4 font-mono text-slate-400 shrink-0 text-center">:</span>
            <span className="uppercase font-black text-slate-900">{employee.designation}</span>
          </div>
        </div>
      </div>

      {/* Financial Table */}
      <div className="mb-10 border-2 border-slate-900 overflow-hidden rounded-sm">
        <table className="w-full text-left text-[12px] border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900 uppercase font-black text-[10px] tracking-widest">
              <th className="px-4 py-3 border-r-2 border-slate-900 w-[35%]">Earnings &amp; Entitlements</th>
              <th className="px-4 py-3 border-r-2 border-slate-900 text-right w-[15%]">Amount (OMR)</th>
              <th className="px-4 py-3 border-r-2 border-slate-900 w-[35%]">Adjustments & Deductions</th>
              <th className="px-4 py-3 text-right w-[15%]">Amount (OMR)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(earnings.length, deductions.length, 6) }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-b-0 h-10">
                <td className="px-4 border-r-2 border-slate-900 text-slate-600 font-medium w-[35%] overflow-hidden break-words">{earnings[i]?.label || ''}</td>
                <td className="px-4 border-r-2 border-slate-900 text-right font-mono font-bold w-[15%]">
                  {earnings[i] ? earnings[i].value.toFixed(3) : ''}
                </td>
                <td className="px-4 border-r-2 border-slate-900 text-slate-600 font-medium w-[35%] overflow-hidden break-words">{deductions[i]?.label || ''}</td>
                <td className="px-4 text-right font-mono font-bold text-red-600 w-[15%]">
                  {deductions[i] ? deductions[i].value.toFixed(3) : ''}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 font-black bg-slate-50">
              <td className="px-4 py-3 border-r-2 border-slate-900 uppercase text-[10px] w-[35%]">Total Entitlements</td>
              <td className="px-4 py-3 border-r-2 border-slate-900 text-right font-mono italic w-[15%]">
                {earnings.reduce((s, e) => s + e.value, 0).toFixed(3)}
              </td>
              <td className="px-4 py-3 border-r-2 border-slate-900 uppercase text-[10px] w-[35%]">Total Deductions</td>
              <td className="px-4 py-3 text-right font-mono text-red-600 italic w-[15%]">
                {deductions.reduce((s, d) => s + d.value, 0).toFixed(3)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net Amount Box */}
      <div className="flex justify-end mb-12">
        <div className="bg-slate-900 text-white p-6 rounded-sm w-full max-w-[450px] shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 italic">Net Settlement Amount</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Currency: OMR</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-4xl font-black tracking-tighter italic">{(item.final_total || 0).toFixed(3)}</span>
            <span className="text-sm font-bold opacity-40">Omani Rials</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[9px] font-bold text-white/50 leading-relaxed uppercase italic">
              {toOmaniWords(item.final_total || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Remarks Section */}
      {notes && (
        <div className="mb-12 p-4 bg-slate-50 border-l-4 border-slate-900">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Administrative Remarks</p>
          <p className="text-xs font-bold leading-relaxed italic break-words">"{notes}"</p>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-24 mt-24 text-center">
        <div className="space-y-4">
          <div className="border-b-2 border-slate-900 h-16 w-full opacity-10"></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest leading-none">Employee Acknowledgement</p>
            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tighter italic">Accepted and satisfied with the final settlement</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border-b-2 border-slate-900 h-16 w-full opacity-10"></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest leading-none">Authorized Signatory</p>
            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tighter italic">Signed on behalf of {company?.name_en}</p>
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="pt-16 mt-12 flex justify-between items-center border-t border-slate-100 print:mt-8 print:pt-4">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">End of Service Settlement</p>
        <div className="flex space-x-2">
          <div className="w-1.5 h-1.5 bg-slate-200"></div>
          <div className="w-1.5 h-1.5 bg-slate-300"></div>
          <div className="w-1.5 h-1.5 bg-slate-950"></div>
        </div>
      </div>
    </div>
  );
}
