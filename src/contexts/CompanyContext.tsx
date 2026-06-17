import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
  legal_name: string;
  juridical_id: string;
  logo_url?: string;
  base_currency?: string;
  payroll_email_from?: string | null;
  primary_color: string;
  accent_color: string;
  light_color: string;
}

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  isLoading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get companies the user has access to
      const { data: companyUsers, error: companyUsersError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id);

      if (companyUsersError) throw companyUsersError;

      if (!companyUsers || companyUsers.length === 0) {
        setCompanies([]);
        setSelectedCompanyState(null);
        setIsLoading(false);
        return;
      }

      // Get company details
      const companyIds = companyUsers.map(cu => cu.company_id);
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, display_name, tax_id, logo_url, base_currency, payroll_email_from')
        .in('id', companyIds);

      if (companiesError) throw companiesError;

      // Map to Company interface
      const mappedCompanies: Company[] = (companiesData || []).map(c => ({
        id: c.id,
        name: c.display_name,
        legal_name: c.display_name,
        juridical_id: c.tax_id || '',
        logo_url: c.logo_url || undefined,
        base_currency: c.base_currency,
        payroll_email_from: c.payroll_email_from,
        primary_color: '#0B2B4C',
        accent_color: '#2A9D8F',
        light_color: '#F5EFE6'
      }));

      setCompanies(mappedCompanies);

      // Restore saved company or select first
      const savedCompanyId = localStorage.getItem('selectedCompanyId');
      if (savedCompanyId) {
        const savedCompany = mappedCompanies.find(c => c.id === savedCompanyId);
        if (savedCompany) {
          setSelectedCompanyState(savedCompany);
        } else if (mappedCompanies.length > 0) {
          setSelectedCompanyState(mappedCompanies[0]);
        }
      } else if (mappedCompanies.length > 0) {
        setSelectedCompanyState(mappedCompanies[0]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
      setSelectedCompanyState(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Memoized setter to prevent unnecessary re-renders
  const setSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      localStorage.setItem('selectedCompanyId', company.id);
    } else {
      localStorage.removeItem('selectedCompanyId');
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    selectedCompany,
    setSelectedCompany,
    companies,
    setCompanies,
    isLoading,
    refreshCompanies: loadCompanies
  }), [selectedCompany, setSelectedCompany, companies, isLoading, loadCompanies]);

  return (
    <CompanyContext.Provider value={contextValue}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
