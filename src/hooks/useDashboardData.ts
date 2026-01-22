import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useMemo } from "react";

export interface KPIData {
  grossPeriod: number;
  totalDeductions: number;
  netPay: number;
  employerCharges: number;
  activeEmployees: number;
  avgCostEmployee: number;
  pendingVacations: number;
  pendingPayslips: number;
}

export function useDashboardData() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  // Fetch latest batch - include all relevant statuses for dashboard
  const { data: latestBatch, isLoading: batchLoading, error: batchError } = useQuery({
    queryKey: ["latestBatch", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      console.log("[Dashboard] Fetching latest batch for company:", companyId);
      
      const { data, error } = await supabase
        .from("payroll_batches")
        .select("id, period_start, period_end, status, batch_id")
        .eq("company_id", companyId)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[Dashboard] Error fetching batch:", error);
        throw error;
      }
      
      console.log("[Dashboard] Latest batch found:", data);
      return data;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch payroll lines for the batch
  const { data: payrollLines, isLoading: linesLoading } = useQuery({
    queryKey: ["payrollLines", latestBatch?.id],
    queryFn: async () => {
      if (!latestBatch?.id) return [];
      
      console.log("[Dashboard] Fetching payroll lines for batch:", latestBatch.id);
      
      const { data, error } = await supabase
        .from("payroll_lines")
        .select("gross_salary, deductions, net_pay, employer_contrib, currency, exchange_rate_to_base")
        .eq("batch_id", latestBatch.id);

      if (error) {
        console.error("[Dashboard] Error fetching payroll lines:", error);
        throw error;
      }
      
      console.log("[Dashboard] Payroll lines found:", data?.length || 0);
      return data || [];
    },
    enabled: !!latestBatch?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch counts in parallel
  const { data: employeeCount } = useQuery({
    queryKey: ["employeeCount", companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      const { count, error } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "activo");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: pendingVacations } = useQuery({
    queryKey: ["pendingVacations", companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      const { count, error } = await supabase
        .from("vacation_requests")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: pendingPayslips } = useQuery({
    queryKey: ["pendingPayslips", companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      
      const { count, error } = await supabase
        .from("payslips")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .is("sent_at", null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  // Memoize KPI calculations
  const kpiData = useMemo<KPIData>(() => {
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalEmployerCharges = 0;

    if (payrollLines) {
      payrollLines.forEach((line) => {
        const rate = line.exchange_rate_to_base || 1;
        const multiplier = line.currency === "CRC" ? 1 : rate;

        totalGross += line.gross_salary * multiplier;
        totalDeductions += (line.deductions || 0) * multiplier;
        totalNetPay += line.net_pay * multiplier;
        totalEmployerCharges += (line.employer_contrib || 0) * multiplier;
      });
    }

    const empCount = employeeCount || 1;

    return {
      grossPeriod: totalGross,
      totalDeductions: totalDeductions,
      netPay: totalNetPay,
      employerCharges: totalEmployerCharges,
      activeEmployees: employeeCount || 0,
      avgCostEmployee: empCount > 0 ? totalGross / empCount : 0,
      pendingVacations: pendingVacations || 0,
      pendingPayslips: pendingPayslips || 0,
    };
  }, [payrollLines, employeeCount, pendingVacations, pendingPayslips]);

  const isLoading = !companyId || batchLoading || linesLoading;

  return {
    kpiData,
    latestBatch,
    isLoading,
    error: batchError,
  };
}
