import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Timesheet, Project, TimesheetFormData } from '@/types';
import { toast } from 'sonner';

// ============================================
// TIMESHEET QUERIES
// ============================================

export function useTimesheets(params: {
  companyId: string;
  page?: number;
  limit?: number;
  employeeId?: string;
  projectId?: string;
  dayType?: string;
  dateFrom?: string;
  dateTo?: string;
  month?: string;
}) {
  const supabase = createClient();
  const { companyId, ...filters } = params;

  return useQuery<Timesheet[]>({
    queryKey: ['timesheets', companyId, { ...filters }],
    queryFn: async () => {
      if (!companyId || !supabase) return [];

      let query = supabase
        .from('timesheets')
        .select(`
          *,
          employees(name_en, emp_code, gross_salary),
          projects(name)
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }
      if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters.dayType) {
        query = query.eq('day_type', filters.dayType);
      }
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }
      if (filters.month) {
        const startDate = `${filters.month}-01`;
        // Get last day of month without timezone shift
        const [year, monthNum] = filters.month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${filters.month}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      // Apply pagination server-side; for client-side hook, fetch all within reasonable limit
      // In production, this should be a server action call
      const { data, error } = await query.limit(filters.limit || 1000);

      if (error) throw new Error(error.message);
      return (data || []) as Timesheet[];
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,   // 5 minutes
  });
}

export function useTimesheet(id: string, companyId: string) {
  const supabase = createClient();

  return useQuery<Timesheet>({
    queryKey: ['timesheet', id, companyId],
    queryFn: async () => {
      if (!id || !companyId || !supabase) throw new Error('Missing parameters');

      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          *,
          employees(name_en, emp_code, gross_salary),
          projects(name)
        `)
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Timesheet not found');
      return data as Timesheet;
    },
    enabled: !!id && !!companyId,
  });
}

export function useTimesheetStats(companyId: string, month?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['timesheet_stats', companyId, month],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      let dateFilter: any = {};
      if (month) {
        const startDate = `${month}-01`;
        const [year, monthNum] = month.split('-').map(Number);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
        dateFilter = { gte: startDate, lte: endDate };
      }

      const { data, error } = await supabase
        .from('timesheets')
        .select('day_type, hours_worked, overtime_hours')
        .eq('company_id', companyId)
        .apply(dateFilter);

      if (error) throw new Error(error.message);

      const stats = {
        totalEntries: 0,
        totalHours: 0,
        workingDays: 0,
        workingHolidays: 0,
        absentDays: 0,
        overtimeHours: 0,
      };

      (data || []).forEach((ts: any) => {
        stats.totalEntries += 1;
        stats.totalHours += Number(ts.hours_worked || 0);
        if (ts.day_type === 'working_day') stats.workingDays += 1;
        else if (ts.day_type === 'working_holiday') stats.workingHolidays += 1;
        else if (ts.day_type === 'absent') stats.absentDays += 1;

        // Overtime from explicit field
        const ot = Number(ts.overtime_hours || 0);
        if (ot > 0) {
          stats.overtimeHours += ot;
        }
      });

      return stats;
    },
    enabled: !!companyId,
  });
}

// ============================================
// PROJECT QUERIES
// ============================================

export function useProjects(companyId: string) {
  const supabase = createClient();

  return useQuery<Project[]>({
    queryKey: ['projects', companyId],
    queryFn: async () => {
      if (!companyId || !supabase) return [];

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw new Error(error.message);
      return (data || []) as Project[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProject(id: string, companyId: string) {
  const supabase = createClient();

  return useQuery<Project>({
    queryKey: ['project', id, companyId],
    queryFn: async () => {
      if (!id || !companyId || !supabase) throw new Error('Missing parameters');

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Project not found');
      return data as Project;
    },
    enabled: !!id && !!companyId,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useTimesheetMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (formData: TimesheetFormData) => {
      // This will call a server action or direct insert
      // For now, use direct insert with service role pattern
      const response = await fetch('/api/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create timesheet');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', companyId] });
      queryClient.invalidateQueries({ queryKey: ['timesheet_stats', companyId] });
      toast.success('Timesheet created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: TimesheetFormData }) => {
      const response = await fetch(`/api/timesheet/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update timesheet');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', companyId] });
      queryClient.invalidateQueries({ queryKey: ['timesheet_stats', companyId] });
      toast.success('Timesheet updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/timesheet/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete timesheet');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', companyId] });
      queryClient.invalidateQueries({ queryKey: ['timesheet_stats', companyId] });
      toast.success('Timesheet deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return { create: createMutation, update: updateMutation, del: deleteMutation };
}

export function useProjectMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const response = await fetch('/api/timesheet/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create project');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', companyId] });
      toast.success('Project created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; description?: string; status?: string } }) => {
      const response = await fetch(`/api/timesheet/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update project');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', companyId] });
      toast.success('Project updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/timesheet/projects/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete project');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', companyId] });
      toast.success('Project deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return { create: createMutation, update: updateMutation, del: deleteMutation };
}
