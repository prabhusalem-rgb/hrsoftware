'use client';

import { useState, useRef, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Loader2, FileDown } from 'lucide-react';
import { EmployeeFormData } from '@/types';
import { parseEmployeeExcel } from '@/lib/utils/excel';
import { toast } from 'sonner';
import { generateEmployeeTemplate } from '@/lib/utils/excel';

interface ImportEmployeesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: EmployeeFormData[]) => Promise<unknown>;
}

function ImportEmployeesDialogImpl({ isOpen, onClose, onImport }: ImportEmployeesDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<EmployeeFormData[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setValidationErrors([]);

    try {
      const buffer = await file.arrayBuffer();
      const employees = await parseEmployeeExcel(buffer);
      setParsedData(employees);

      // Check for placeholder email duplicates
      const placeholderEmails = employees.filter(emp => emp.email?.includes('placeholder.invalid'));
      const emailCounts = new Map<string, number>();
      placeholderEmails.forEach(emp => {
        if (emp.email) {
          emailCounts.set(emp.email, (emailCounts.get(emp.email) || 0) + 1);
        }
      });
      const duplicatePlaceholders = Array.from(emailCounts.entries()).filter(([, count]) => count > 1);
      if (duplicatePlaceholders.length > 0) {
        setValidationErrors(['Some employees have duplicate placeholder emails. Please edit them before importing.']);
      }

      // Check for empty required fields
      const missingEmpCode = employees.filter(emp => !emp.emp_code);
      const missingName = employees.filter(emp => !emp.name_en);
      if (missingEmpCode.length > 0) {
        setValidationErrors(prev => [...prev, `${missingEmpCode.length} employee(s) missing Employee Code`]);
      }
      if (missingName.length > 0) {
        setValidationErrors(prev => [...prev, `${missingName.length} employee(s) missing Full Name`]);
      }

      if (employees.length > 0) {
        setStep('preview');
        toast.success(`Parsed ${employees.length} employee record(s)`);
      } else {
        toast.error('No employee records found in the file');
        setStep('upload');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse Excel file';
      toast.error(message);
      setStep('upload');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const buffer = await generateEmployeeTemplate();
      const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(parsedData);
      setStep('success');
      toast.success('Employees imported successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setStep('upload');
      setSelectedFile(null);
      setParsedData([]);
      setValidationErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setParsedData([]);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl rounded-3xl p-0 overflow-hidden border-0 shadow-2xl bg-white dark:bg-slate-950">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Upload className="w-32 h-32" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              Bulk Employee Import
            </DialogTitle>
            <DialogDescription className="text-emerald-100 font-medium mt-2">
              Upload an Excel spreadsheet to import multiple employees at once. Each employee must have a unique email.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8">
          {step === 'upload' && (
            <div className="space-y-8">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-12 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-300 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <Upload className="w-10 h-10 text-emerald-600" />
                </div>
                <p className="text-lg font-black text-slate-700">Click to select an Excel file</p>
                <p className="text-sm text-slate-500 font-medium mt-1">or drag and drop your file here</p>
                <p className="text-xs text-slate-400 mt-2">Supports .xlsx and .xls files</p>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="gap-2 rounded-2xl px-6 font-black border-2"
                >
                  <FileDown className="w-4 h-4" /> Download Template
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Preview: {parsedData.length} Employees</h3>
                  <p className="text-sm text-slate-500 font-medium">Review the data before importing</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleReset} className="rounded-2xl px-4 font-black text-slate-500">
                    Choose Different File
                  </Button>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-red-800">Validation Issues</h4>
                      <ul className="mt-1 space-y-1">
                        {validationErrors.map((err, i) => (
                          <li key={i} className="text-sm text-red-700">• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="border rounded-2xl overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">#</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Emp Code</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Name</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Email</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Department</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((emp, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50">
                          <TableCell className="text-sm font-mono text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-sm font-black text-slate-900">{emp.emp_code || <span className="text-red-500">Missing</span>}</TableCell>
                          <TableCell className="font-bold text-slate-900">{emp.name_en || <span className="text-red-500">Missing</span>}</TableCell>
                          <TableCell>
                            {emp.email?.includes('placeholder.invalid') ? (
                              <span className="text-amber-600 font-mono text-xs bg-amber-50 px-2 py-1 rounded">
                                {emp.email}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-sm">{emp.email}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{emp.department || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full text-[10px] font-black">
                              {emp.status || 'active'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {parsedData.some(emp => emp.email?.includes('placeholder.invalid')) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-amber-800">Placeholder Emails Detected</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Some employees have placeholder emails. Each employee must have a unique email to log in.
                        Please update placeholder emails after import via the employee edit form.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center">
              <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Import Complete</h3>
              <p className="text-slate-600 font-medium">{parsedData.length} employee(s) imported successfully</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pt-0 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose} className="w-full sm:w-auto rounded-2xl px-6 font-black text-slate-500">
            {step === 'success' ? 'Done' : 'Cancel'}
          </Button>
          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={isImporting || validationErrors.length > 0}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-8 font-black h-12 shadow-xl shadow-emerald-600/20 gap-2 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isImporting ? 'Importing...' : 'Confirm Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MemoizedImportEmployeesDialog = memo(ImportEmployeesDialogImpl);
export { MemoizedImportEmployeesDialog as ImportEmployeesDialog };
