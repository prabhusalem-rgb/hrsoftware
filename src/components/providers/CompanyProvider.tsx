'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  reinitAuth: () => void;
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
  // Supabase client is recreated when needed (e.g., after login/logout)
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [activeCompanyIdState, setActiveCompanyIdState] = useState<string>('');
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<any | null>(null);

  const hasFetchedRef = useRef(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Initialize client on mount
  useEffect(() => {
    setSupabase(createClient());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveCompanyId = useCallback((id: string) => {
    setActiveCompanyIdState(id);
  }, []);

  const fetchProfile = useCallback(async (skipLog = false) => {
    if (!supabase) {
      console.log('[CompanyProvider] fetchProfile: no supabase client yet');
      return;
    }

    const startClient = supabase; // capture for staleness check
    if (hasFetchedRef.current) {
      console.log('[CompanyProvider] fetchProfile: already fetched for this client, skipping');
      return;
    }

    if (!skipLog) console.log('[CompanyProvider] fetchProfile start');
    setLoading(true);
    const startTime = performance.now();

    // Accumulate state locally; apply only if still current
    let profileData: any = null;
    let companies: Company[] = [];
    let userIdVal: string | undefined = undefined;
    let hasError = false;

    try {
      // Prime the session explicitly to ensure cookies are read correctly
      await supabase.auth.getSession();
      
      // Get current user — may need retries after login as session propagates
      let { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!skipLog) console.log('[CompanyProvider] getUser 1:', user?.id?.substring(0,8), 'error:', userError?.message);

      if (!user && !userError) {
        for (let attempt = 1; attempt <= 6; attempt++) {
          const wait = Math.min(400 * Math.pow(1.4, attempt), 3000);
          if (!skipLog) console.log(`[CompanyProvider] No user, attempt ${attempt} waiting ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          // Re-prime session on each retry
          await supabase.auth.getSession();
          const res = await supabase.auth.getUser();
          user = res.data.user;
          userError = res.error;
          if (!skipLog) console.log(`[CompanyProvider] Retry ${attempt}:`, user?.id?.substring(0,8), 'error:', userError?.message);
          if (user) break;
        }
      }

      if (userError || !user) {
        console.log('[CompanyProvider] No user — clearing state');
        // profileData stays null, companies empty, userIdVal undefined
      } else {
        userIdVal = user.id;
        if (!skipLog) console.log('[CompanyProvider] Authenticated:', user.id.substring(0,8));

        // Check cache
        const cachedStr = typeof window !== 'undefined' ? sessionStorage.getItem('userProfile') : null;
        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (cached.id === user.id) {
              if (!skipLog) console.log('[CompanyProvider] Cache HIT');
              profileData = cached;

              // Fetch companies based on cached role
              const isSuperAdmin = cached.role === 'super_admin';
              const isCompanyAdmin = cached.role === 'company_admin';
              const isGlobalUser = cached.company_id === null;
              const tC = performance.now();
              if (isSuperAdmin || isGlobalUser) {
                const { data } = await supabase
                  .from('companies')
                  .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
                  .order('name_en', { ascending: true });
                companies = (data || []) as Company[];
              } else if (isCompanyAdmin && cached.company_id) {
                const { data } = await supabase
                  .from('companies')
                  .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
                  .eq('id', cached.company_id);
                companies = (data || []) as Company[];
              } else if (cached.company_id) {
                const { data } = await supabase
                  .from('companies')
                  .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
                  .eq('id', cached.company_id);
                companies = (data || []) as Company[];
              }
              if (!skipLog) console.log('[CompanyProvider] Companies (cache):', Math.round(performance.now() - tC), 'ms, count:', companies.length);
            } else {
              if (!skipLog) console.log('[CompanyProvider] Cache stale — clearing');
              try { sessionStorage.removeItem('userProfile'); } catch {}
            }
          } catch (e) {
            if (!skipLog) console.log('[CompanyProvider] Cache error:', e);
          }
        }

        // If we don't have profileData yet, fetch from DB
        if (!profileData) {
          const { data: pData, error: pError } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, company_id')
            .eq('id', user.id)
            .maybeSingle();

          if (pError || !pData) {
            if (!skipLog) console.error('[CompanyProvider] Profile fetch failed:', pError);
            // profileData remains null, companies empty
          } else {
            profileData = pData;
            try {
              sessionStorage.setItem('userProfile', JSON.stringify(pData));
            } catch {}
          }
        }

        // Fetch companies if we still need them
        if (profileData && companies.length === 0) {
          const isSuperAdmin = profileData.role === 'super_admin';
          const isCompanyAdmin = profileData.role === 'company_admin';
          const isGlobalUser = profileData.company_id === null;
          const t2 = performance.now();
          if (isSuperAdmin || isGlobalUser) {
            const { data } = await supabase
              .from('companies')
              .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
              .order('name_en', { ascending: true });
            companies = (data || []) as Company[];
          } else if (isCompanyAdmin && profileData.company_id) {
            const { data } = await supabase
              .from('companies')
              .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
              .eq('id', profileData.company_id);
            companies = (data || []) as Company[];
          } else if (profileData.company_id) {
            const { data } = await supabase
              .from('companies')
              .select('id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone, logo_url, contact_email, bank_name, bank_account')
              .eq('id', profileData.company_id);
            companies = (data || []) as Company[];
          }
          if (!skipLog) console.log('[CompanyProvider] Companies (DB):', Math.round(performance.now() - t2), 'ms, count:', companies.length);
        }
      }
    } catch (err) {
      hasError = true;
      console.error('[CompanyProvider] Error:', err);
    }

    // Staleness check: only apply if this is still the current client
    if (supabaseRef.current !== startClient) {
      console.log('[CompanyProvider] fetchProfile: client changed, discarding result');
      setLoading(false); // Ensure loading is turned off even if discarded
      return;
    }

    // Apply accumulated state
    setProfile(profileData);
    if (profileData) {
      try { sessionStorage.setItem('userProfile', JSON.stringify(profileData)); } catch {}
    } else {
      try { sessionStorage.removeItem('userProfile'); } catch {}
    }
    setAvailableCompanies(companies);
    if (companies.length > 0) {
      setActiveCompanyIdState(prev => companies.some(c => c.id === prev) ? prev : companies[0].id);
    } else {
      setActiveCompanyIdState('');
    }
    setUserId(userIdVal);

    if (hasError) {
      toast.error('Failed to load company data');
    }

    const totalTime = Math.round(performance.now() - startTime);
    if (!skipLog) console.log('[CompanyProvider] Total fetchProfile:', totalTime, 'ms');
    
    // Only mark as successfully fetched if we actually found a user
    // This allows subsequent events to try again if the initial fetch failed.
    if (userIdVal) {
      hasFetchedRef.current = true;
    }
    setLoading(false);
  }, [supabase]);

  // Force refetch of profile and companies — used after mutations
  const refresh = useCallback(async (): Promise<void> => {
    hasFetchedRef.current = false;
    await fetchProfile(true); // true = skip routine logging
  }, [fetchProfile]);

  // Recreate Supabase client — call after login/logout to pick up new session
  const reinitAuth = useCallback(() => {
    console.log('[CompanyProvider] Reinitializing auth client');
    setProfile(null);
    setAvailableCompanies([]);
    setActiveCompanyIdState('');
    setUserId(undefined);
    try { sessionStorage.removeItem('userProfile'); } catch {}
    hasFetchedRef.current = false;
    // Create fresh client that will read current cookies
    setSupabase(createClient());
  }, []);

  // Reset fetch flag when client changes so fetchProfile runs for new client
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [supabase]);

  // Keep supabaseRef in sync for staleness checks
  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  // Initial load — runs once on mount when supabase becomes available
  useEffect(() => {
    if (supabase) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Auth state listener — handles sign out and sign-in events
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      console.log('[CompanyProvider] Auth event:', event, session?.user?.id?.substring(0,8));
      
      if (event === 'SIGNED_OUT') {
        // Clear immediately (synchronous)
        setProfile(null);
        setAvailableCompanies([]);
        setActiveCompanyIdState('');
        setUserId(undefined);
        try { sessionStorage.removeItem('userProfile'); } catch {}
        
        // Reinit client to get a clean state (this won't loop because signed out doesn't fire SIGNED_IN)
        reinitAuth();
      } else if (event === 'SIGNED_IN') {
        // Only trigger re-initialization if the user ID has actually changed.
        // If we were previously undefined (e.g. just started or just called reinitAuth),
        // we just fetch the profile for the current user.
        const currentUserId = session?.user?.id;
        if (currentUserId && currentUserId !== userId) {
          if (userId !== undefined) {
            console.log('[CompanyProvider] User switched — reinitializing');
            reinitAuth();
          } else {
            console.log('[CompanyProvider] User session detected — fetching profile');
            fetchProfile();
          }
        } else if (!hasFetchedRef.current && currentUserId) {
          console.log('[CompanyProvider] Session exists but no fetch yet — fetching');
          fetchProfile();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, userId, reinitAuth, fetchProfile]);

  const activeCompany = useMemo(() =>
    availableCompanies.find(c => c.id === activeCompanyIdState),
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
    refresh,
    reinitAuth,
  }), [activeCompanyIdState, activeCompany, availableCompanies, loading, userId, profile, refresh, reinitAuth]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}
