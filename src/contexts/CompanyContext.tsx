import React, { createContext, useContext, useState, useEffect } from 'react';

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
    // Load companies from localStorage or default
    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    const defaultCompanies: Company[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Horizonte Positivo',
        legal_name: 'Asociación Horizonte Positivo',
        juridical_id: '3-002-674691',
        primary_color: '#0B2B4C',
        accent_color: '#2A9D8F',
        light_color: '#F5EFE6'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Alturas de Tenorio',
        legal_name: 'Alturas de Tenorio S.A.',
        juridical_id: '3-101-555555',
        primary_color: '#0B2B4C',
        accent_color: '#2A9D8F',
        light_color: '#F5EFE6'
      }
    ];

    setCompanies(defaultCompanies);
    
    if (savedCompanyId) {
      const savedCompany = defaultCompanies.find(c => c.id === savedCompanyId);
      if (savedCompany) {
        setSelectedCompany(savedCompany);
      }
    } else {
      setSelectedCompany(defaultCompanies[0]);
    }
    
    setIsLoading(false);
  }, []);

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