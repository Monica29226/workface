import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface PayrollBatch {
  id: string;
  batch_id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  frequency: string;
  status: string;
  created_at: string;
  base_currency: string;
}

export function usePayrollBatches() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["payrollBatches", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("payroll_batches")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("period_end", { ascending: false });

      if (error) throw error;
      return data as PayrollBatch[];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePayrollLines(batchId: string | null) {
  return useQuery({
    queryKey: ["payrollLines", batchId],
    queryFn: async () => {
      if (!batchId) return [];

      const { data, error } = await supabase
        .from("payroll_lines")
        .select(`
          *,
          employee:employees!inner(id, employee_id, full_name, work_email, contract_type)
        `)
        .eq("batch_id", batchId);

      if (error) throw error;
      return data;
    },
    enabled: !!batchId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateBatchStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ batchId, status }: { 
      batchId: string; 
      status: "borrador" | "calculado" | "aprobado" | "enviado" 
    }) => {
      const { error } = await supabase
        .from("payroll_batches")
        .update({ status })
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payrollBatches"] });
      queryClient.invalidateQueries({ queryKey: ["latestBatch"] });
      toast({ title: "¡Éxito!", description: "Estado actualizado correctamente" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });
}
