'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Company } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface CompanyContextType {
  activeCompanyId: string;
  activeCompany: Company | undefined;
  setActiveCompanyId: (id: string) => void;
  availableCompanies: Company[];
  loading: boolean;
  userId: string | undefined;
  profile: any | null;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [activeCompanyIdState, setActiveCompanyIdState] = useState<string>('');
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<any | null>(null);

  // Wrapped setter with logging
  const setActiveCompanyId = useCallback((id: string) => {
    console.log('[CompanyProvider] setActiveCompanyId called:', id);
    setActiveCompanyIdState(id);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);

    if (!supabase) {
      setAvailableCompanies([]);
      setActiveCompanyIdState('');
      setProfile(null);
      setLoading(false);
      toast.error('Supabase connection not configured. Please set up environment variables.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setAvailableCompanies([]);
        setActiveCompanyIdState('');
        setUserId(undefined);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUserId(session.user.id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, company:company_id(*)')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        const isSuperAdmin = profileData.role === 'super_admin';
        const isCompanyAdmin = profileData.role === 'company_admin';
        const isGlobalUser = profileData.company_id === null;

        console.log('[CompanyProvider] Profile loaded:', { role: profileData.role, company_id: profileData.company_id, isSuperAdmin, isCompanyAdmin, isGlobalUser });

        if (isSuperAdmin || isGlobalUser) {
          const { data: companies } = await supabase
            .from('companies')
            .select('*')
            .order('name_en', { ascending: true });

          if (companies && companies.length > 0) {
            setAvailableCompanies(companies as Company[]);
            setActiveCompanyIdState(prev => {
              const typed = companies as Company[];
              if (typed.some((c: Company) => c.id === prev)) return prev;
              return typed[0].id;
            });
            console.log('[CompanyProvider] Set available companies (super admin):', companies.map((c: any) => ({ id: c.id, name: c.name_en })));
          } else {
            setAvailableCompanies([]);
            setActiveCompanyIdState('');
          }
        } else if (isCompanyAdmin && profileData.company_id) {
          const { data: companies } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profileData.company_id);

          if (companies && companies.length > 0) {
            setAvailableCompanies(companies as Company[]);
            setActiveCompanyIdState(profileData.company_id);
            console.log('[CompanyProvider] Set company (company admin):', profileData.company_id);
          }
        } else if (profileData.company_id) {
          const companyData = profileData.company as Company;
          if (companyData) {
            setAvailableCompanies([companyData]);
            setActiveCompanyIdState(profileData.company_id);
            console.log('[CompanyProvider] Set company (from profile):', profileData.company_id);
          } else {
            const { data: companies } = await supabase
              .from('companies')
              .select('*')
              .eq('id', profileData.company_id);
            if (companies && companies.length > 0) {
              setAvailableCompanies(companies as Company[]);
              setActiveCompanyIdState(profileData.company_id);
              console.log('[CompanyProvider] Set company (fallback query):', profileData.company_id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching company context:', err);
      setAvailableCompanies([]);
      setActiveCompanyIdState('');
      toast.error('Failed to load company data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const activeCompany = useMemo(() =>
    availableCompanies.find((c) => c.id === activeCompanyIdState),
    [availableCompanies, activeCompanyIdState]
  );

  const value = useMemo(() => ({
    activeCompanyId: activeCompanyIdState,
    activeCompany,
    setActiveCompanyId,
    availableCompanies,
    loading,
    userId,
    profile,
    refresh: fetchProfile
  }), [activeCompanyIdState, activeCompany, availableCompanies, loading, userId, profile, fetchProfile]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}
