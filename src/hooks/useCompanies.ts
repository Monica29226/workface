import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  display_name: string;
  base_currency: string;
  company_id: string;
  tax_id: string | null;
  logo_url: string | null;
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, display_name, base_currency, company_id, tax_id, logo_url")
        .order("display_name");

      if (error) throw error;
      return data as Company[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - companies rarely change
  });
}

export function useCompanyById(companyId: string | null) {
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 10,
  });
}
