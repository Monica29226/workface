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
  pendingManagerApprovals: number;
  pendingHRApprovals: number;
  pendingPayslips: number;
  pendingVacationDays: number;
  netPaid6Months: number;
}

export interface BatchOption {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  batch_id: string;
  label: string;
}

function formatBatchLabel(period_start: string, period_end: string) {
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const s = new Date(period_start);
  const e = new Date(period_end);
  return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

export function useDashboardData(selectedBatchId?: string | null) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  // Fetch list of batches for selector
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["dashboardBatches", companyId],
    queryFn: async (): Promise<BatchOption[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("payroll_batches")
        .select("id, period_start, period_end, status, batch_id")
        .eq("company_id", companyId)
        .order("period_end", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        label: formatBatchLabel(b.period_start, b.period_end),
      }));
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  const latestBatch = batches?.[0] || null;
  const activeBatch = selectedBatchId
    ? batches?.find((b) => b.id === selectedBatchId) || latestBatch
    : latestBatch;

  // Fetch payroll lines for the active batch
  const { data: payrollLines, isLoading: linesLoading } = useQuery({
    queryKey: ["payrollLines", activeBatch?.id],
    queryFn: async () => {
      if (!activeBatch?.id) return [];
      const { data, error } = await supabase
        .from("payroll_lines")
        .select("gross_salary, deductions, net_pay, employer_contrib, currency, exchange_rate_to_base")
        .eq("batch_id", activeBatch.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBatch?.id,
    staleTime: 1000 * 60 * 5,
  });

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

  // Sum of vacation balance days for active employees
  const { data: pendingVacationDays } = useQuery({
    queryKey: ["pendingVacationDays", companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const { data, error } = await supabase
        .from("employees")
        .select("vac_balance_days")
        .eq("company_id", companyId)
        .eq("status", "activo");
      if (error) throw error;
      return (data || []).reduce((sum: number, e: any) => sum + (Number(e.vac_balance_days) || 0), 0);
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  // Net paid in last 6 months (sum of net_pay CRC across batches with period_end in last 6 months)
  const { data: netPaid6Months } = useQuery({
    queryKey: ["netPaid6Months", companyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const since = new Date();
      since.setMonth(since.getMonth() - 6);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data: bids, error: e1 } = await supabase
        .from("payroll_batches")
        .select("id")
        .eq("company_id", companyId)
        .gte("period_end", sinceStr);
      if (e1) throw e1;
      const ids = (bids || []).map((b: any) => b.id);
      if (ids.length === 0) return 0;

      const { data, error } = await supabase
        .from("payroll_lines")
        .select("net_pay")
        .in("batch_id", ids);
      if (error) throw error;
      return (data || []).reduce((sum: number, l: any) => sum + (Number(l.net_pay) || 0), 0);
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: pendingVacationCounts } = useQuery({
    queryKey: ["pendingVacationCounts", companyId],
    queryFn: async () => {
      if (!companyId) return { total: 0, pendingManager: 0, pendingHr: 0 };
      const { data, error } = await (supabase as any)
        .from("vacation_requests")
        .select("approval_stage")
        .eq("company_id", companyId)
        .eq("status", "pending");
      if (error) throw error;
      return {
        total: (data || []).length,
        pendingManager: (data || []).filter((r: any) => r.approval_stage === "pending_manager").length,
        pendingHr: (data || []).filter((r: any) => (r.approval_stage || "pending_hr") === "pending_hr").length,
      };
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

  const kpiData = useMemo<KPIData>(() => {
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalEmployerCharges = 0;

    if (payrollLines) {
      payrollLines.forEach((line: any) => {
        const rate = Number(line.exchange_rate_to_base) || 1;
        // gross is in original currency → convert to CRC
        const grossCRC = line.currency === "CRC" ? Number(line.gross_salary) : Number(line.gross_salary) * rate;
        // deductions / net_pay / employer_contrib are ALREADY in CRC
        totalGross += grossCRC;
        totalDeductions += Number(line.deductions) || 0;
        totalNetPay += Number(line.net_pay) || 0;
        totalEmployerCharges += Number(line.employer_contrib) || 0;
      });
    }

    const empCount = employeeCount || 1;

    return {
      grossPeriod: totalGross,
      totalDeductions,
      netPay: totalNetPay,
      employerCharges: totalEmployerCharges,
      activeEmployees: employeeCount || 0,
      avgCostEmployee: empCount > 0 ? totalGross / empCount : 0,
      pendingVacations: pendingVacationCounts?.total || 0,
      pendingManagerApprovals: pendingVacationCounts?.pendingManager || 0,
      pendingHRApprovals: pendingVacationCounts?.pendingHr || 0,
      pendingPayslips: pendingPayslips || 0,
      pendingVacationDays: pendingVacationDays || 0,
      netPaid6Months: netPaid6Months || 0,
    };
  }, [payrollLines, employeeCount, pendingVacationCounts, pendingPayslips, pendingVacationDays, netPaid6Months]);

  const isLoading = !companyId || batchesLoading || linesLoading;

  return {
    kpiData,
    latestBatch,
    activeBatch,
    batches: batches || [],
    isLoading,
  };
}
