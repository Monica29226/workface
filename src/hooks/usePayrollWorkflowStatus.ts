import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export interface WorkflowStatusCounts {
  borrador: number;
  calculado: number;
  aprobado: number;
  autorizado: number;
  enviado: number;
}

export function usePayrollWorkflowStatus() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["payrollWorkflowStatus", selectedCompany?.id],
    queryFn: async (): Promise<WorkflowStatusCounts> => {
      if (!selectedCompany?.id) {
        return { borrador: 0, calculado: 0, aprobado: 0, autorizado: 0, enviado: 0 };
      }

      const { data, error } = await supabase
        .from("payroll_batches")
        .select("status")
        .eq("company_id", selectedCompany.id);

      if (error) throw error;

      const counts: WorkflowStatusCounts = {
        borrador: 0,
        calculado: 0,
        aprobado: 0,
        autorizado: 0,
        enviado: 0,
      };

      data?.forEach((batch) => {
        if (batch.status && batch.status in counts) {
          counts[batch.status as keyof WorkflowStatusCounts]++;
        }
      });

      return counts;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
