'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Download, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { EmployeeFormData } from '@/types';
import { toast } from 'sonner';

interface ImportEmployeesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (employees: EmployeeFormData[]) => void;
}

export function ImportEmployeesDialog({ isOpen, onClose, onImport }: ImportEmployeesDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<EmployeeFormData[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx')) {
        toast.error('Please upload a valid Excel file (.xlsx)');
        return;
      }
      setFile(selectedFile);
      setIsParsing(true);
      try {
        const buffer = await selectedFile.arrayBuffer();
        // Dynamically import excel parser to reduce initial bundle size
        const { parseEmployeeExcel, generateEmployeeTemplate } = await import('@/lib/utils/excel');
        const data = await parseEmployeeExcel(buffer);
        setPreviewData(data);
        toast.success(`Successfully parsed ${data.length} employees`);
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to parse Excel file. Check console for details.';
        toast.error(errorMessage);
        console.error('Excel parse error:', error);
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const { generateEmployeeTemplate } = await import('@/lib/utils/excel');
      const buffer = await generateEmployeeTemplate();
      const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Employee_Import_Template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to generate template');
    }
  };

  const handleConfirmImport = () => {
    if (previewData.length === 0) {
      toast.error('No valid employee data found to import');
      return;
    }
    onImport(previewData);
    setFile(null);
    setPreviewData([]);
    onClose();
  };

  const reset = () => {
    setFile(null);
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-0 shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
               <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black">Bulk Personnel Import</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium">
                Upload your Excel roster to authorize mass recruitment.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center bg-white hover:border-primary hover:bg-slate-50 transition-all cursor-pointer group"
            >
              <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-primary" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Drop Excel Roster Here</h3>
              <p className="text-slate-500 font-medium mb-8 max-w-xs mx-auto text-sm">
                Supported format: .xlsx. Ensure all Omani required fields are populated.
              </p>
              <Button variant="outline" className="rounded-2xl px-8 font-black gap-2 border-2">
                 Manual Selection
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{file.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {previewData.length} Personnel Records Detected
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={reset} className="h-10 w-10 rounded-xl p-0 text-slate-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </Button>
               </div>

               {isParsing ? (
                 <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Parsing Spreadsheet Layers...</p>
                 </div>
               ) : (
                 <div className="rounded-3xl border-2 border-slate-100 overflow-hidden bg-white shadow-sm">
                   <Table>
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 pl-6">Code</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400">Full Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400">Position</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400">Civil ID</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400">Basic (OMR)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 pr-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 10).map((emp, i) => (
                          <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="pl-6 font-mono font-bold text-xs">{emp.emp_code}</TableCell>
                            <TableCell className="font-bold text-sm">{emp.name_en}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-500">{emp.designation}</TableCell>
                            <TableCell className="font-mono text-xs">{emp.civil_id || '-'}</TableCell>
                            <TableCell className="font-mono font-black text-emerald-600">{Number(emp.basic_salary).toFixed(3)}</TableCell>
                            <TableCell className="pr-6">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black uppercase">Valid</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                   </Table>
                   {previewData.length > 10 && (
                     <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">+ {previewData.length - 10} Additional Records</p>
                     </div>
                   )}
                 </div>
               )}
            </div>
          )}

          <div className="bg-blue-50 border-2 border-blue-100 rounded-[2rem] p-6 flex items-start gap-4 transition-all">
             <div className="p-2 bg-white rounded-xl shadow-sm"><Download className="w-5 h-5 text-blue-600" /></div>
             <div className="flex-1">
                <p className="text-sm font-black text-blue-900 mb-1">Standardized Roster Structure</p>
                <p className="text-[11px] font-medium text-blue-700 mb-4 opacity-80">
                  Ensure your Excel file follows the Omani Compliance Roster structure to avoid authorization rejection.
                </p>
                <Button onClick={handleDownloadTemplate} variant="link" className="p-0 h-auto text-xs font-black text-blue-600 uppercase tracking-widest gap-2 hover:no-underline">
                   Acquire Sample Template <CheckCircle2 className="w-3.5 h-3.5" />
                </Button>
             </div>
          </div>
        </div>

        <DialogFooter className="p-8 pt-6 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
           <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto rounded-2xl px-8 font-bold text-slate-400">
             Cancel Protocol
           </Button>
           <Button
             onClick={handleConfirmImport}
             disabled={!file || previewData.length === 0 || isParsing}
             className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white rounded-2xl px-12 font-black h-12 shadow-xl shadow-primary/20 gap-2 min-w-[200px]"
           >
             {isParsing ? 'Processing...' : (
               <>
                 <CheckCircle2 className="w-5 h-5" /> Execute Bulk Import
               </>
             )}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
