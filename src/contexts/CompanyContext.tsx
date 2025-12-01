import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
  legal_name: string;
  juridical_id: string;
  logo_url?: string;
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
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
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
        setSelectedCompany(null);
        setIsLoading(false);
        return;
      }

      // Get company details
      const companyIds = companyUsers.map(cu => cu.company_id);
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds);

      if (companiesError) throw companiesError;

      // Map to Company interface
      const mappedCompanies: Company[] = (companiesData || []).map(c => ({
        id: c.id,
        name: c.display_name,
        legal_name: c.display_name,
        juridical_id: c.tax_id || '',
        logo_url: c.logo_url || undefined,
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
          setSelectedCompany(savedCompany);
        } else if (mappedCompanies.length > 0) {
          setSelectedCompany(mappedCompanies[0]);
        }
      } else if (mappedCompanies.length > 0) {
        setSelectedCompany(mappedCompanies[0]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
      setSelectedCompany(null);
      setIsLoading(false);
    }
  };

  const handleSetSelectedCompany = (company: Company | null) => {
    setSelectedCompany(company);
    if (company) {
      localStorage.setItem('selectedCompanyId', company.id);
    } else {
      localStorage.removeItem('selectedCompanyId');
    }
  };

  return (
    <CompanyContext.Provider value={{
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      companies,
      setCompanies,
      isLoading
    }}>
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