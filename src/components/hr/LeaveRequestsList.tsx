'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Clock, CheckCircle2, XCircle, MapPin, FileText, Calculator } from 'lucide-react';
import { useLeaveRequests } from '@/hooks/queries/useLeaveRequests';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LeaveRequestsListProps {
  companyId: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  hr_approved: 'bg-blue-100 text-blue-700',
  ops_approved: 'bg-purple-100 text-purple-700',
  gm_approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export function LeaveRequestsList({ companyId }: LeaveRequestsListProps) {
  const router = useRouter();
  const { data: requests = [], isLoading } = useLeaveRequests(companyId);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading requests...</div>;
  if (requests.length === 0) return <div className="p-8 text-center text-slate-500">No public requests found.</div>;

  return (
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
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request: any) => (
            <TableRow key={request.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">{request.employee?.name_en}</span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">
                    {request.employee?.emp_code} • {request.employee?.department}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-medium">
                  {request.leave_type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(request.start_date), 'dd MMM yyyy')} → {format(new Date(request.end_date), 'dd MMM yyyy')}
              </TableCell>
              <TableCell className="font-mono font-bold">{request.days}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[150px]">{request.sector}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${statusColors[request.status]} border-0 font-bold uppercase text-[10px] tracking-wider px-2 py-0.5`}>
                  {request.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {request.status === 'pending' && (
                  <Link href={`/dashboard/leave-requests/${request.id}/hr-approve`}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                      <Clock className="w-3.5 h-3.5" />
                      HR Review
                    </Button>
                  </Link>
                )}
                {request.status === 'hr_approved' && (
                  <Link href={`/dashboard/leave-requests/${request.id}/ops-approve`}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ops Review
                    </Button>
                  </Link>
                )}
                {request.status === 'ops_approved' && (
                  <Link href={`/dashboard/leave-requests/${request.id}/gm-approve`}>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      GM Approval
                    </Button>
                  </Link>
                )}
                {request.status === 'gm_approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => router.push(`/dashboard/settlement?leaveRequestId=${request.id}`)}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Process Settlement
                  </Button>
                )}
                {request.status === 'rejected' && (
                  <span className="text-xs text-slate-500 italic">Rejected</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
