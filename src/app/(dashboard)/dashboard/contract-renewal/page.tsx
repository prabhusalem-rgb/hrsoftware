'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  UserCheck,
  Users,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCompany } from '@/components/providers/CompanyProvider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ContractRenewalListPage() {
  const router = useRouter();
  const { profile, activeCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    if (activeCompanyId) {
      fetchRenewals();
    }
  }, [activeCompanyId]);

  const fetchRenewals = async () => {
    try {
      const url = activeCompanyId ? `/api/contract-renewal?companyId=${activeCompanyId}` : '/api/contract-renewal';
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch renewals (HTTP ${res.status})`);
      }
      const data = await res.json();
      setRenewals(data.items || []);
    } catch (err: any) {
      console.error('Failed to fetch renewals:', err);
      toast.error(err.message || 'Failed to fetch renewals');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'signed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Signed</Badge>;
      case 'supervisor_approved':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200"><UserCheck className="w-3 h-3 mr-1" /> Supervisor</Badge>;
      case 'manager_approved':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Users className="w-3 h-3 mr-1" /> Manager</Badge>;
      case 'hr_approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">{status}</Badge>;
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/renew-contract/${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    toast.success('Signing link copied to clipboard');
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    setDeleting(true);
    try {
      const res = await fetch(`/api/contract-renewal?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }

      toast.success('Contract renewal deleted');
      setRenewals(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const filteredRenewals = renewals.filter(r => 
    r.employee?.name_en.toLowerCase().includes(search.toLowerCase()) ||
    r.employee?.emp_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contract Renewals</h1>
          <p className="text-muted-foreground">
            Manage employee contract renewal forms and digital signatures.
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/contract-renewal/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Initiate Renewal
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search by employee name or ID..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading renewals...</div>
          ) : filteredRenewals.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
              <FileText className="w-12 h-12 text-slate-200" />
              <p>No contract renewals found.</p>
              <Button variant="outline" onClick={() => router.push('/dashboard/contract-renewal/new')} className="mt-4">
                Create your first renewal request
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRenewals.map((renewal) => (
                  <TableRow key={renewal.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="cursor-pointer" onClick={() => router.push(`/dashboard/contract-renewal/${renewal.id}`)}>
                      <div className="font-medium text-slate-900 hover:text-slate-700 transition-colors">{renewal.employee?.name_en}</div>
                      <div className="text-xs text-slate-500">{renewal.employee?.emp_code}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">{renewal.employee?.designation}</TableCell>
                    <TableCell className="font-mono font-medium">{renewal.gross_salary.toFixed(3)} OMR</TableCell>
                    <TableCell>{getStatusBadge(renewal.status)}</TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {format(new Date(renewal.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {renewal.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => copyLink(renewal.secure_token)}
                            title="Copy signing link"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copy Link
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => window.open(`/renew-contract/${encodeURIComponent(renewal.secure_token)}`, '_blank')}
                          title="View public page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteId(renewal.id)}
                            title="Delete renewal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Renewal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contract renewal record and any associated signatures will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
