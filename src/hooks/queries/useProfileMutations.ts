import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Employee } from '@/types';

interface CreateProfileData {
  email: string;
  full_name: string;
  role: 'company_admin' | 'hr_manager' | 'employee' | 'superadmin';
  company_id?: string;
}

interface UpdateProfileData {
  id: string;
  full_name?: string;
  role?: string;
  company_id?: string;
}

export function useProfileMutations() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const deleteProfile = useMutation({
    mutationFn: async (profileId: string) => {
      const resp = await fetch(`/api/users?id=${profileId}`, {
        method: 'DELETE',
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to delete user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const createProfile = useMutation({
    mutationFn: async (data: CreateProfileData) => {
      const resp = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Profile created successfully');
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const resp = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to update user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Profile updated successfully');
    },
  });

  return { deleteProfile, createProfile, updateProfile };
}
