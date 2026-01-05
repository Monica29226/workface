import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  base_salary: number;
  hourly_rate: number | null;
  hire_date: string | null;
  contract_type: "mensual" | "por_horas";
  currency: "CRC" | "USD" | "EUR" | "GBP";
  status: "activo" | "inactivo";
  company_id: string;
  vac_balance_days: number | null;
  aguinaldo_base_12m: number | null;
  cost_center_id?: string | null;
}

export function useEmployees() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["employees", selectedCompany?.id],
    queryFn: async () => {
      const query = supabase
        .from("employees")
        .select("*")
        .order("full_name");

      // Filter by company if selected
      if (selectedCompany?.id) {
        query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useEmployeesByCompany(companyId: string | null) {
  return useQuery({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "activo")
        .order("full_name");

      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (employee: {
      employee_id: string;
      full_name: string;
      work_email: string;
      base_salary: number;
      hourly_rate?: number | null;
      hire_date?: string | null;
      contract_type: "mensual" | "por_horas";
      currency: "CRC" | "USD" | "EUR" | "GBP";
      company_id: string;
    }) => {
      const { data, error } = await supabase
        .from("employees")
        .insert([{ ...employee, status: "activo" as const }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "¡Éxito!", description: "Empleado creado correctamente" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo crear el empleado",
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { 
      id: string;
      employee_id?: string;
      full_name?: string;
      work_email?: string;
      base_salary?: number;
      hourly_rate?: number | null;
      hire_date?: string | null;
      contract_type?: "mensual" | "por_horas";
      currency?: "CRC" | "USD" | "EUR" | "GBP";
    }) => {
      const { data, error } = await supabase
        .from("employees")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "¡Éxito!", description: "Empleado actualizado correctamente" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo actualizar el empleado",
        variant: "destructive" 
      });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "¡Éxito!", description: "Empleado eliminado correctamente" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo eliminar el empleado",
        variant: "destructive" 
      });
    },
  });
}
