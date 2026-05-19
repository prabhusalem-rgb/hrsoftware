'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Search,
  Calendar,
  Plane,
  ArrowUpRight,
  Copy,
  Check,
  Link2,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCompany } from '@/components/providers/CompanyProvider';
import { createClient } from '@/lib/supabase/client';
import type { LeaveRequest, LeaveRequestStatus } from '@/types';

export default function LeaveRequestsPage() {
  const router = useRouter();
  const { activeCompanyId, availableCompanies, profile, setActiveCompanyId, loading: companyLoading } = useCompany();

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | 'all'>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeCompanyId) {
      fetchLeaveRequests();
    } else {
      setLoading(false);
    }
  }, [activeCompanyId, statusFilter]);

  async function fetchLeaveRequests() {
    if (!activeCompanyId) return;

    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees!leave_requests_employee_id_fkey(
            id, emp_code, name_en, designation, department
          ),
          company:companies!leave_requests_company_id_fkey(id, name_en)
        `)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeaveRequests((data as LeaveRequest[]) || []);
    } catch (err: any) {
      toast.error('Failed to load leave requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRequests = useMemo(() => {
    if (!search.trim()) return leaveRequests;

    const searchLower = search.toLowerCase();
    return leaveRequests.filter((req) => {
      const employeeName = req.employee?.name_en?.toLowerCase() || '';
      const empCode = req.employee?.emp_code?.toLowerCase() || '';
      const sector = req.sector?.toLowerCase() || '';
      return employeeName.includes(searchLower) || empCode.includes(searchLower) || sector.includes(searchLower);
    });
  }, [leaveRequests, search]);

  // Show loading while company data is being fetched
  if (companyLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  const getPublicLink = () => {
    if (!activeCompanyId) return '';
    return `${window.location.origin}/leave-request/${activeCompanyId}`;
  };

  const copyPublicLink = async () => {
    const link = getPublicLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Public link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave request? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/leave-requests/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }

      toast.success('Leave request deleted successfully');
      fetchLeaveRequests();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusBadge = (status: LeaveRequestStatus) => {
    const variants: Record<LeaveRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      hr_approved: 'default',
      ops_approved: 'outline',
      gm_approved: 'default',
      approved: 'default',
      rejected: 'destructive',
    };
    const labels: Record<LeaveRequestStatus, string> = {
      pending: 'Pending',
      hr_approved: 'HR Approved',
      ops_approved: 'Ops Approved',
      gm_approved: 'GM Approved',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Leave Requests</h1>
            <p className="text-slate-500">Review and process employee leave applications</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Company selector for users with access to multiple companies */}
            {availableCompanies.length > 1 && (
              <Select value={activeCompanyId ?? ''} onValueChange={(v) => v && setActiveCompanyId(v)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue>
                    {activeCompanyId
                      ? (availableCompanies.find(c => c.id === activeCompanyId)?.name_en?.trim() || `Company (${activeCompanyId.slice(0, 8)})`)
                      : 'Select a company'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name_en?.trim() || `Company (${c.id.slice(0, 8)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => fetchLeaveRequests()} variant="outline">
              Refresh
            </Button>
          </div>
        </div>

        {/* Public Link Card */}
        {activeCompanyId ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <Link2 className="w-5 h-5" />
                  <span className="font-semibold">Public Leave Request Link</span>
                </div>
                <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border px-3 py-2 min-w-0">
                  <code className="text-sm text-slate-700 truncate flex-1">
                    {getPublicLink()}
                  </code>
                  <Button
                    size="sm"
                    onClick={copyPublicLink}
                    className="gap-1.5 flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Share this link with employees — they can submit leave requests without logging in.
              </p>
            </CardContent>
          </Card>
        ) : !companyLoading && profile?.role !== 'super_admin' && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6 text-center">
              <p className="text-amber-700">
                <strong>No company linked to your profile.</strong>
                {' '}Please contact your administrator to set a company for your user account.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="Search by employee name, code, or sector..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="hr_approved">HR Approved</SelectItem>
                    <SelectItem value="ops_approved">Ops Approved</SelectItem>
                    <SelectItem value="gm_approved">GM Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests ({filteredRequests.length})</CardTitle>
            <CardDescription>
              Click on a request to review and approve/reject
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No leave requests found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                      {profile?.role === 'super_admin' && <TableHead className="w-[80px]">Delete</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((req) => {
                      const days = getInclusiveDays(req.start_date, req.end_date);
                      const start = parseISO(req.start_date);
                      const end = parseISO(req.end_date);

                      return (
                        <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50">
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.employee?.name_en}</p>
                              <p className="text-xs text-slate-500">{req.employee?.emp_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>{req.leave_type}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(start, 'dd MMM')}</div>
                              <div className="text-slate-500">to {format(end, 'dd MMM yyyy')}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{days}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Plane className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">
                                {req.sector?.trim() || <span className="text-slate-400 italic">—</span>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(req.status)}</TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {format(parseISO(req.created_at), 'dd MMM yy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/leave-requests/${req.id}/view`);
                              }}
                              className="gap-1"
                            >
                              View Details
                              <ArrowUpRight className="w-3 h-3" />
                            </Button>
                          </TableCell>
                          {profile?.role === 'super_admin' && (
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(req.id);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Inclusive day count using UTC to avoid timezone issues
function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
  };
  const s = parse(startDateStr);
  const e = parse(endDateStr);
  const startUtc = Date.UTC(s.y, s.m - 1, s.d);
  const endUtc = Date.UTC(e.y, e.m - 1, e.d);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((endUtc - startUtc) / msPerDay) + 1;
  return diff >= 1 ? diff : 0;
}
