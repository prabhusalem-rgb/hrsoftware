'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Link2,
  Unlink,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { useBankStatements } from '@/hooks/queries/useBankStatements';
import { useBankStatementMutations } from '@/hooks/queries/useBankStatements';
import { useCompany } from '@/components/providers/CompanyProvider';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function BankReconciliationPage() {
  const { activeCompanyId } = useCompany();
  const { data: statements = [], isLoading } = useBankStatements(activeCompanyId);
  const { uploadStatement, importTransactions, reconcileStatement, completeReconciliation } =
    useBankStatementMutations(activeCompanyId);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [uploadForm, setUploadForm] = useState({
    bank_name: '',
    account_number: '',
    statement_period_start: '',
    statement_period_end: '',
    opening_balance: 0,
    closing_balance: 0,
    total_credits: 0,
    total_debits: 0,
    file_name: '',
    file_url: '',
    notes: ''
  });

  const [transactionUpload, setTransactionUpload] = useState('');

  const handleUpload = async () => {
    if (!uploadForm.bank_name || !uploadForm.account_number || !uploadForm.statement_period_start) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await uploadStatement.mutateAsync({
        ...uploadForm,
        company_id: activeCompanyId
      });
      setUploadDialogOpen(false);
      setUploadForm({
        bank_name: '',
        account_number: '',
        statement_period_start: '',
        statement_period_end: '',
        opening_balance: 0,
        closing_balance: 0,
        total_credits: 0,
        total_debits: 0,
        file_name: '',
        file_url: '',
        notes: ''
      });
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleImportTransactions = async (statementId: string) => {
    try {
      // Parse CSV-like data from textarea
      const lines = transactionUpload.trim().split('\n');
      if (lines.length < 2) {
        toast.error('Please provide transaction data with header row');
        return;
      }

      // Simple CSV parsing (assumes comma-separated with header)
      const headers = lines[0].split(',');
      const transactions = lines.slice(1).map(line => {
        const values = line.split(',');
        const txn: any = {};
        headers.forEach((header, idx) => {
          txn[header.trim().toLowerCase()] = values[idx]?.trim();
        });
        return {
          transaction_date: txn.date || txn.transaction_date || new Date().toISOString().split('T')[0],
          description: txn.description || '',
          reference_number: txn.reference || txn.ref || '',
          credit: parseFloat(txn.credit) || 0,
          debit: parseFloat(txn.debit) || 0,
          balance: parseFloat(txn.balance) || undefined
        };
      });

      await importTransactions.mutateAsync({
        statementId,
        transactions
      });
      setTransactionUpload('');
      toast.success('Transactions imported');
    } catch (error: any) {
      toast.error('Failed to import: ' + error.message);
    }
  };

  const handleReconcile = async (statementId: string) => {
    await reconcileStatement.mutateAsync({
      statementId,
      tolerance: 0.001
    });
  };

  const handleComplete = async (statementId: string) => {
    await completeReconciliation.mutateAsync(statementId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'processing': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-slate-100 text-slate-600';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const formatCurrency = (val: number) => val.toFixed(3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground text-sm">
            Upload bank statements and match salary payments
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" /> Upload Statement
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-slate-900">{statements.length}</div>
            <p className="text-xs text-slate-500 mt-1">Total Statements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-amber-600">
              {statements.filter(s => s.status === 'processing').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-emerald-600">
              {statements.filter(s => s.status === 'completed').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-red-600">
              {statements.filter(s => s.status === 'error').length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Statements List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Bank Statements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : statements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No statements uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Closing Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((statement: any) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium">{statement.bank_name}</TableCell>
                    <TableCell className="font-mono text-sm">{statement.account_number}</TableCell>
                    <TableCell className="text-sm">
                      {format(parseISO(statement.statement_period_start), 'MMM dd')} -{' '}
                      {format(parseISO(statement.statement_period_end), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(statement.opening_balance)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(statement.closing_balance)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(statement.status)}>
                        {statement.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {statement.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStatement(statement);
                              setTransactionUpload('date,description,reference,credit,debit,balance\n');
                            }}
                            className="h-8"
                          >
                            <Upload className="w-3 h-3 mr-1" /> Import
                          </Button>
                        )}
                        {statement.status === 'processing' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReconcile(statement.id)}
                              className="h-8 text-blue-600"
                            >
                              <Link2 className="w-3 h-3 mr-1" /> Match
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleComplete(statement.id)}
                              className="h-8 text-emerald-600"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Complete
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Statement Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Bank Statement</DialogTitle>
            <DialogDescription>
              Enter bank statement details manually or upload a file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name *</Label>
                <Input
                  value={uploadForm.bank_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, bank_name: e.target.value })}
                  placeholder="e.g., Bank Muscat"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  value={uploadForm.account_number}
                  onChange={(e) => setUploadForm({ ...uploadForm, account_number: e.target.value })}
                  placeholder="Company account number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statement Start Date *</Label>
                <Input
                  type="date"
                  value={uploadForm.statement_period_start}
                  onChange={(e) => setUploadForm({ ...uploadForm, statement_period_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Statement End Date</Label>
                <Input
                  type="date"
                  value={uploadForm.statement_period_end}
                  onChange={(e) => setUploadForm({ ...uploadForm, statement_period_end: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={uploadForm.opening_balance}
                  onChange={(e) => setUploadForm({ ...uploadForm, opening_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Balance</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={uploadForm.closing_balance}
                  onChange={(e) => setUploadForm({ ...uploadForm, closing_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Credits</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={uploadForm.total_credits}
                  onChange={(e) => setUploadForm({ ...uploadForm, total_credits: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>CSV File Upload (Optional)</Label>
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadForm({ ...uploadForm, file_name: file.name });
                    toast.info('File reference saved - use Import Transactions to load data');
                  }
                }}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Upload a CSV with columns: date, description, reference, credit, debit, balance
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploadStatement.isPending} className="w-full sm:w-auto">
              {uploadStatement.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Transactions Dialog */}
      <Dialog open={!!selectedStatement} onOpenChange={(open) => !open && setSelectedStatement(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
            <DialogDescription>
              Paste CSV data or upload a transaction file for {selectedStatement?.bank_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Transaction Data (CSV format with header)</Label>
              <Textarea
                value={transactionUpload}
                onChange={(e) => setTransactionUpload(e.target.value)}
                placeholder='date,description,reference,credit,debit,balance
2025-04-01,Salary Payment for April,SAL-001,50000,0,100000
2025-04-02,Bank Charges,CHG-001,0,10,99990'
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Required columns: date, description, credit, debit. Optional: reference, balance
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> Export transactions from your bank&apos;s online banking as CSV, then paste here.
                Only credit transactions (incoming salary payments) will be matched for reconciliation.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedStatement(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => selectedStatement && handleImportTransactions(selectedStatement.id)}
              disabled={importTransactions.isPending || !transactionUpload.trim()}
              className="w-full sm:w-auto"
            >
              {importTransactions.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Import Transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
