'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plane, Calendar } from 'lucide-react';

interface LeaveRequestSelectorProps {
  employeeId: string;
  onSelect: (request: any) => void;
}

export function LeaveRequestSelector({ employeeId, onSelect }: LeaveRequestSelectorProps) {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['employee-approved-leave-requests', employeeId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('status', 'gm_approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  if (isLoading) return <div className="h-14 bg-slate-50 animate-pulse rounded-2xl" />;
  if (requests.length === 0) {
    return (
      <div className="h-14 border-2 border-dashed rounded-2xl flex items-center justify-center text-slate-400 text-sm">
        No approved public leave requests found for this employee.
      </div>
    );
  }

  return (
    <Select onValueChange={(id) => {
      const req = requests.find((r: any) => r.id === id);
      onSelect(req);
    }}>
      <SelectTrigger className="h-14 rounded-2xl border-2 font-bold">
        <SelectValue placeholder="Select an approved request..." />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-0 shadow-2xl">
        {requests.map((req: any) => (
          <SelectItem key={req.id} value={req.id} className="py-3 px-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{req.leave_type}</span>
                <Badge variant="outline" className="text-[10px] uppercase">{req.sector}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(req.start_date), 'dd MMM')} - {format(new Date(req.end_date), 'dd MMM yyyy')}
                </span>
                <span className="font-bold text-slate-900">{req.days} Days</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
