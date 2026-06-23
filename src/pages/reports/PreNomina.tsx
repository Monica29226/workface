import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Save, Calculator, AlertCircle, CheckCircle, FileSpreadsheet, Printer, Download, Edit, Undo2, Trash2, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LivePayrollPreview } from "@/components/payroll/LivePayrollPreview";
import { calculatePayrollDeductions, type PayrollCompanyParams } from "@/lib/payrollDeductions";

// Fallback de cálculo en tiempo real — usa la fórmula canónica compartida.
// Solo se usa cuando la línea aún NO tiene deducciones guardadas (detail.ccss_obrero = 0).
// Para líneas ya calculadas, se muestran los valores guardados sin recalcular.
function calculateRealTimeDeductions(
  grossSalaryCRC: number,
  existingDetail: DeductionsDetail | null,
  params: PayrollCompanyParams | null | undefined,
): { ccss: number; isr: number; loans: number; total: number } {
  const loanDeduction = existingDetail?.loan_deduction || 0;
  const calc = calculatePayrollDeductions({
    grossSalary: grossSalaryCRC,
    params: params ?? null,
    loanDeduction,
  });
  // CCSS aquí YA incluye Banco Popular obrero (1%) — el parámetro
  // ccss_obrero_total (10.67%) lo trae empacado. No se cobra por separado.
  return {
    ccss: calc.ccssObrero + calc.magisterio + calc.polizaVida,
    isr: calc.isr,
    loans: calc.loan,
    total: calc.ccssObrero + calc.magisterio + calc.polizaVida + calc.isr + calc.loan,
  };
}


interface DeductionsDetail {
  ccss_obrero?: number;
  ccss_rate?: number;
  base_imponible_crc?: number;
  isr_neto?: number;
  isr_10?: number;
  isr_15?: number;
  isr_20?: number;
  isr_25?: number;
  isr_bruto?: number;
  isr_credito?: number;
  magisterio?: number;
  poliza_vida?: number;
  loan_deduction?: number;
  banco_popular?: number;
}

interface PayrollLine {
  id: string;
  line_id: string;
  employee_id: string;
  gross_salary: number;
  deductions: number;
  net_pay: number;
  total_to_pay: number;
  currency: string;
  exchange_rate_to_base: number;
  additional_bonuses: number;
  additional_deductions: number;
  regular_hours: number;
  overtime_hours: number;
  absence_days: number;
  vacation_days_taken: number;
  sick_leave_days: number;
  deductions_detail: DeductionsDetail | null;
  lpt_banco_popular?: number;
  mixed_overtime_hours?: number;
  mixed_overtime_amount?: number;
  ccss_disability_hours?: number;
  ins_disability_hours?: number;
  employee: {
    id: string;
    full_name: string;
    employee_id: string;
    base_salary: number;
    currency: string;
    job_title?: string;
  };
}

interface PayrollBatch {
  id: string;
  batch_id: string;
  period_start: string;
  period_end: string;
  status: string;
  base_currency: string;
  frequency: string;
  payroll_type: string;
}

interface EditingState {
  [lineId: string]: {
    gross_salary?: number;
    additional_bonuses?: number;
    additional_deductions?: number;
    regular_hours?: number;
    overtime_hours?: number;
    mixed_overtime_hours?: number;
    absence_days?: number;
    vacation_days_taken?: number;
  };
}

export function PreNomina() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const batchFromUrl = searchParams.get('batch');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(batchFromUrl);
  const [editingState, setEditingState] = useState<EditingState>({});
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevertingStatus, setIsRevertingStatus] = useState(false);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUSDColumn, setShowUSDColumn] = useState(false);

  // Auto-select batch from URL parameter
  useEffect(() => {
    if (batchFromUrl && batchFromUrl !== selectedBatchId) {
      setSelectedBatchId(batchFromUrl);
    }
  }, [batchFromUrl]);

  // Fetch payroll batches
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["payrollBatchesPreNomina", selectedCompany?.id],
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
  });

  // Fetch payroll lines for selected batch
  const { data: payrollLines, isLoading: linesLoading, refetch: refetchLines } = useQuery({
    queryKey: ["payrollLinesPreNomina", selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return [];

      const { data, error } = await supabase
        .from("payroll_lines")
        .select(`
          *,
          employee:employees!inner(id, employee_id, full_name, base_salary, currency)
        `)
        .eq("batch_id", selectedBatchId)
        .order("employee(full_name)");

      if (error) throw error;
      return data as unknown as PayrollLine[];
    },
    enabled: !!selectedBatchId,
  });

  // Fetch company parameters
  const { data: companyParams } = useQuery({
    queryKey: ["companyParamsPreNomina", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;

      const { data, error } = await supabase
        .from("company_parameters")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const currentBatch = batches?.find(b => b.id === selectedBatchId);
  const isEditable = currentBatch?.status === 'borrador' || currentBatch?.status === 'calculado';
  const exchangeRate = payrollLines?.[0]?.exchange_rate_to_base || 505.10;
  
  // Determine if batch currency is CRC (when TC=1, it means working in colones)
  const isBatchCRC = currentBatch?.base_currency === 'CRC' || exchangeRate === 1;

  // Handle field changes
  const handleFieldChange = useCallback((lineId: string, field: string, value: number) => {
    setEditingState(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value
      }
    }));
  }, []);

  // Get current value (edited or original)
  const getValue = useCallback((line: PayrollLine, field: keyof PayrollLine) => {
    const editedValue = editingState[line.id]?.[field as keyof EditingState[string]];
    return editedValue !== undefined ? editedValue : Number(line[field]) || 0;
  }, [editingState]);

  // Check if line has unsaved changes
  const hasChanges = useCallback((lineId: string) => {
    return Object.keys(editingState[lineId] || {}).length > 0;
  }, [editingState]);

  // Save individual line with auto-recalculation
  const handleSaveLine = async (line: PayrollLine) => {
    if (!hasChanges(line.id)) return;
    
    setIsSaving(true);
    try {
      const updates = editingState[line.id];
      
      // Use edge function for auto-recalculation when gross_salary changes
      const { data, error } = await supabase.functions.invoke('update-payroll-line', {
        body: {
          lineId: line.id,
          updates,
          autoRecalculate: true
        }
      });

      if (error) throw error;

      setEditingState(prev => {
        const { [line.id]: _, ...rest } = prev;
        return rest;
      });

      const wasRecalculated = data?.auto_recalculated;
      toast({
        title: wasRecalculated ? "Guardado y Recalculado" : "Guardado",
        description: wasRecalculated 
          ? `Cambios guardados y deducciones recalculadas para ${line.employee.full_name}`
          : `Cambios guardados para ${line.employee.full_name}`,
      });

      refetchLines();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Recalculate entire batch
  const handleRecalculate = async () => {
    if (!selectedBatchId || !companyParams) {
      toast({
        title: "Error",
        description: "Seleccione un batch y verifique los parámetros de la empresa",
        variant: "destructive",
      });
      return;
    }

    setIsRecalculating(true);
    try {
      const { error } = await supabase.functions.invoke('recalculate-payroll-batch', {
        body: { batchId: selectedBatchId },
      });

      if (error) throw error;

      setEditingState({});
      
      toast({
        title: "Planilla recalculada",
        description: "Todas las deducciones han sido actualizadas",
      });

      refetchLines();
    } catch (error: any) {
      toast({
        title: "Error al recalcular",
        description: error.message || "No se pudo recalcular la planilla",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  // Revert batch status to "calculado"
  const handleRevertToCalculado = async () => {
    if (!selectedBatchId) return;

    setIsRevertingStatus(true);
    try {
      const { error } = await supabase
        .from('payroll_batches')
        .update({ status: 'calculado' as any, updated_at: new Date().toISOString() })
        .eq('id', selectedBatchId);

      if (error) throw error;

      toast({
        title: "Estado actualizado",
        description: "El lote ha sido revertido a 'Calculado'. Ahora puede editar los datos.",
      });

      // Invalidate queries to refresh batch data
      queryClient.invalidateQueries({ queryKey: ["payrollBatchesPreNomina"] });
      queryClient.invalidateQueries({ queryKey: ["payrollBatches"] });
      queryClient.invalidateQueries({ queryKey: ["latestBatch"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    } finally {
      setIsRevertingStatus(false);
    }
  };

  // Delete batch and all its lines
  const handleDeleteBatch = async () => {
    if (!selectedBatchId || !currentBatch) return;

    setIsDeleting(true);
    try {
      // First delete all payroll lines for this batch
      const { error: linesError } = await supabase
        .from('payroll_lines')
        .delete()
        .eq('batch_id', selectedBatchId);

      if (linesError) throw linesError;

      // Then delete the batch itself
      const { error: batchError } = await supabase
        .from('payroll_batches')
        .delete()
        .eq('id', selectedBatchId);

      if (batchError) throw batchError;

      setSelectedBatchId(null);
      setEditingState({});
      
      toast({
        title: "Lote eliminado",
        description: `El lote ${currentBatch.batch_id} y todas sus líneas han sido eliminados.`,
      });

      // Refresh batches list
      queryClient.invalidateQueries({ queryKey: ["payrollBatchesPreNomina"] });
      queryClient.invalidateQueries({ queryKey: ["payrollBatches"] });
      queryClient.invalidateQueries({ queryKey: ["latestBatch"] });
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el lote",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!payrollLines || !currentBatch) return;

    const headers = [
      "Empleado", "Cédula", "Salario USD", "Base CRC", "CCSS", "ISR", 
      "Préstamos", "Bonos", "Otras Ded.", "Total Ded.", "Neto CRC", "Neto USD"
    ];

    const rows = payrollLines.map((line) => {
      const detail = line.deductions_detail || {};
      const netUSD = Number(line.net_pay) / exchangeRate;
      
      return [
        line.employee.full_name,
        line.employee.employee_id,
        Number(line.gross_salary).toFixed(2),
        (detail.base_imponible_crc || 0).toFixed(2),
        (detail.ccss_obrero || 0).toFixed(2),
        (detail.isr_neto || 0).toFixed(2),
        (detail.loan_deduction || 0).toFixed(2),
        Number(line.additional_bonuses || 0).toFixed(2),
        Number(line.additional_deductions || 0).toFixed(2),
        Number(line.deductions).toFixed(2),
        Number(line.net_pay).toFixed(2),
        netUSD.toFixed(2)
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pre_nomina_${currentBatch.batch_id}.csv`;
    link.click();
  };

  // Calculate totals with real-time deductions
  const totals = useMemo(() => {
    if (!payrollLines) return null;

    return payrollLines.reduce(
      (acc, line) => {
        const detail = line.deductions_detail || {};
        const grossSalary = getValue(line, 'gross_salary');
        const overtimeHours = getValue(line, 'overtime_hours');
        const mixedOvertimeHours = getValue(line, 'mixed_overtime_hours' as keyof PayrollLine);
        
        // Calculate in CRC for deductions
        const grossSalaryCRC = line.currency === 'USD' ? grossSalary * exchangeRate : grossSalary;
        
        // Use stored deductions if available, otherwise calculate real-time
        const hasStoredDeductions = (detail.ccss_obrero || 0) > 0;
        const realTimeDeductions = hasStoredDeductions 
          ? { 
              ccss: detail.ccss_obrero || 0, 
              isr: detail.isr_neto || 0, 
              loans: detail.loan_deduction || 0,
              total: Number(line.deductions) || 0
            }
          : calculateRealTimeDeductions(grossSalaryCRC, detail, companyParams);
        
        const netPayCRC = grossSalaryCRC - realTimeDeductions.total - Number(line.additional_deductions || 0);
        const netPayUSD = netPayCRC / exchangeRate;
        
        return {
          grossSalaryCRC: acc.grossSalaryCRC + grossSalaryCRC,
          grossSalaryUSD: acc.grossSalaryUSD + (line.currency === 'USD' ? grossSalary : grossSalary / exchangeRate),
          overtimeHours: acc.overtimeHours + overtimeHours,
          mixedOvertimeHours: acc.mixedOvertimeHours + mixedOvertimeHours,
          ccss: acc.ccss + realTimeDeductions.ccss,
          isr: acc.isr + realTimeDeductions.isr,
          loans: acc.loans + realTimeDeductions.loans,
          bonuses: acc.bonuses + Number(line.additional_bonuses || 0),
          otherDeductions: acc.otherDeductions + Number(line.additional_deductions || 0),
          totalDeductions: acc.totalDeductions + realTimeDeductions.total + Number(line.additional_deductions || 0),
          netPayCRC: acc.netPayCRC + netPayCRC,
          netPayUSD: acc.netPayUSD + netPayUSD,
        };
      },
      {
        grossSalaryCRC: 0,
        grossSalaryUSD: 0,
        overtimeHours: 0,
        mixedOvertimeHours: 0,
        ccss: 0,
        isr: 0,
        loans: 0,
        bonuses: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netPayCRC: 0,
        netPayUSD: 0,
      }

    );
  }, [payrollLines, getValue, exchangeRate]);

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      borrador: { label: "Borrador", variant: "secondary" },
      calculado: { label: "Calculado", variant: "default" },
      aprobado: { label: "Aprobado", variant: "outline" },
      enviado: { label: "Enviado", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPayrollTypeBadge = (type?: string) => {
    if (!type || type === 'completa') return null;
    const typeConfig: Record<string, { label: string; className: string }> = {
      adelanto: { label: "1ra Quincena", className: "bg-blue-100 text-blue-800" },
      segunda: { label: "2da Quincena", className: "bg-purple-100 text-purple-800" },
    };
    const config = typeConfig[type];
    if (!config) return null;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Validate if net = gross - deductions
  const validateLine = (line: PayrollLine) => {
    const baseImponible = line.deductions_detail?.base_imponible_crc || 0;
    const deductions = Number(line.deductions) || 0;
    const netPay = Number(line.net_pay) || 0;
    const expected = baseImponible - deductions;
    return Math.abs(expected - netPay) < 1;
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Pre-Nómina</h1>
          <p className="text-muted-foreground">
            Revise y ajuste salarios, deducciones y bonos antes de aprobar
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Select
            value={selectedBatchId || ""}
            onValueChange={(value) => {
              setSelectedBatchId(value);
              setEditingState({});
            }}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Seleccionar período..." />
            </SelectTrigger>
            <SelectContent>
              {batchesLoading ? (
                <div className="p-2 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : (
                batches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {formatPeriod(batch.period_start, batch.period_end)} - {batch.status}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {selectedBatchId && payrollLines && payrollLines.length > 0 && (
            <>
              <Button 
                variant="outline"
                size="icon"
                onClick={handleExportCSV}
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline"
                size="icon"
                onClick={() => window.print()}
                title="Imprimir"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleRecalculate} 
                disabled={isRecalculating || !isEditable}
                className="gap-2"
              >
                {isRecalculating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                Recalcular
              </Button>
              
              {/* Delete Batch Button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive"
                    size="icon"
                    disabled={!isEditable || isDeleting}
                    title="Eliminar lote"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este lote de nómina?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará permanentemente el lote <strong>{currentBatch?.batch_id}</strong> y todas sus líneas de nómina. 
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteBatch}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar Lote
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-center">{selectedCompany?.name}</h1>
        <h2 className="text-lg text-center">Pre-Nómina</h2>
        {currentBatch && (
          <p className="text-center text-sm">
            Período: {formatPeriod(currentBatch.period_start, currentBatch.period_end)}
          </p>
        )}
      </div>

      {/* Batch Info */}
      {currentBatch && (
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            {getStatusBadge(currentBatch.status)}
            {getPayrollTypeBadge(currentBatch.payroll_type)}
            {!isBatchCRC && (
              <Badge variant="outline">TC: ₡{exchangeRate.toFixed(2)}</Badge>
            )}
            {!isEditable && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Este batch está {currentBatch.status} y no se puede editar
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevertToCalculado}
                  disabled={isRevertingStatus}
                  className="gap-2"
                >
                  {isRevertingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4" />
                  )}
                  Editar Lote
                </Button>
              </div>
            )}
            {Object.keys(editingState).length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {Object.keys(editingState).length} cambios sin guardar
              </Badge>
            )}
          </div>
          
          {/* USD Toggle - Only show when batch has USD employees */}
          {!isBatchCRC && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-usd"
                checked={showUSDColumn}
                onCheckedChange={setShowUSDColumn}
              />
              <Label htmlFor="show-usd" className="flex items-center gap-1 cursor-pointer text-sm">
                <DollarSign className="h-4 w-4" />
                Mostrar USD
              </Label>
            </div>
          )}
        </div>
      )}

      {!selectedBatchId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            Seleccione un período de planilla
          </CardContent>
        </Card>
      ) : linesLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-2 text-muted-foreground">Cargando datos...</p>
          </CardContent>
        </Card>
      ) : !payrollLines || payrollLines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay datos para este período
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards - Always in CRC */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Bruto CRC</div>
                <div className="text-lg font-bold text-primary">
                  ₡{formatNumber(Math.round(totals?.grossSalaryCRC || 0))}
                </div>
                {showUSDColumn && !isBatchCRC && (
                  <div className="text-xs text-muted-foreground">
                    ${formatNumber(Math.round(totals?.grossSalaryUSD || 0))} USD
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Deducciones</div>
                <div className="text-lg font-bold text-destructive">
                  ₡{formatNumber(Math.round(totals?.totalDeductions || 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Neto CRC</div>
                <div className="text-lg font-bold text-muted-foreground">
                  ₡{formatNumber(Math.round(totals?.netPayCRC || 0))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/5">
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-success">Total a Depositar</div>
                <div className="text-lg font-bold text-success">
                  ₡{formatNumber(Math.round(totals?.netPayCRC || 0))}
                </div>
                {showUSDColumn && !isBatchCRC && (
                  <div className="text-xs text-success/70">
                    ${formatNumber(Math.round(totals?.netPayUSD || 0))} USD
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Deductions Summary */}
          <Card className="print:break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de Deducciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">CCSS + B. Popular ({companyParams?.ccss_obrero_total || 10.67}%)</div>
                  <div className="font-semibold text-destructive">₡{formatNumber(Math.round(totals?.ccss || 0))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ISR</div>
                  <div className="font-semibold text-destructive">₡{formatNumber(Math.round(totals?.isr || 0))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Préstamos</div>
                  <div className="font-semibold text-destructive">₡{formatNumber(Math.round(totals?.loans || 0))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bonos (+)</div>
                  <div className="font-semibold text-success">₡{formatNumber(Math.round(totals?.bonuses || 0))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Otras Ded. (-)</div>
                  <div className="font-semibold text-destructive">₡{formatNumber(Math.round(totals?.otherDeductions || 0))}</div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Editable Table */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-2 print:py-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Detalle por Colaborador ({payrollLines.length})</span>
                {isEditable && (
                  <span className="text-sm font-normal text-muted-foreground print:hidden">
                    Edite valores y presione Recalcular
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-8 print:hidden"></TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead className="text-right">Salario Bruto CRC</TableHead>
                      {showUSDColumn && !isBatchCRC && (
                        <TableHead className="text-right text-blue-600">Bruto USD</TableHead>
                      )}
                      <TableHead className="text-right">Hrs Extra (1.5x)</TableHead>
                      <TableHead className="text-right">Hrs Dobles (2x)</TableHead>
                      <TableHead className="text-right">CCSS + B. Popular</TableHead>

                      <TableHead className="text-right">ISR</TableHead>
                      <TableHead className="text-right">Préstamos</TableHead>
                      <TableHead className="text-right">Otras Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-destructive">Total Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-success">Neto CRC</TableHead>
                      {showUSDColumn && !isBatchCRC && (
                        <TableHead className="text-right font-semibold text-blue-600">Neto USD</TableHead>
                      )}
                      <TableHead className="w-16 print:hidden"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.map((line) => {
                      const lineHasChanges = hasChanges(line.id);
                      const detail = line.deductions_detail || {};
                      const grossSalary = getValue(line, 'gross_salary');
                      
                      // Calculate gross in CRC (convert if USD)
                      const isUSD = line.currency === 'USD';
                      const grossSalaryCRC = isUSD ? grossSalary * exchangeRate : grossSalary;
                      const grossSalaryUSD = isUSD ? grossSalary : grossSalary / exchangeRate;
                      
                      // Use stored deductions or calculate real-time
                      const hasStoredDeductions = (detail.ccss_obrero || 0) > 0;
                      const calculatedDed = hasStoredDeductions 
                        ? { 
                            ccss: (detail.ccss_obrero || 0) + (detail.banco_popular || Number(line.lpt_banco_popular) || 0),
                            isr: detail.isr_neto || 0, 
                            loans: detail.loan_deduction || 0,
                            total: Number(line.deductions) || 0
                          }
                        : calculateRealTimeDeductions(grossSalaryCRC, detail, companyParams);

                      
                      const otrasDeduciones = Number(line.additional_deductions || 0);
                      const totalDeductions = calculatedDed.total + otrasDeduciones;
                      const netPayCRC = grossSalaryCRC - totalDeductions;
                      const netPayUSD = netPayCRC / exchangeRate;
                      
                      // Validation
                      const isValid = hasStoredDeductions ? Math.abs(netPayCRC - Number(line.net_pay)) < 100 : true;
                      
                      return (
                        <TableRow 
                          key={line.id} 
                          className={`text-xs ${lineHasChanges ? 'bg-accent/50' : ''} ${!isValid ? 'bg-destructive/5' : ''}`}
                        >
                          <TableCell className="print:hidden">
                            {isValid ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{line.employee.full_name}</div>
                              <div className="text-muted-foreground text-[10px]">
                                {line.employee.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right relative">
                            {isEditable ? (
                              <div className="relative inline-block">
                                <Input
                                  type="number"
                                  step="100"
                                  className="w-28 h-7 text-right text-xs"
                                  value={getValue(line, 'gross_salary')}
                                  onChange={(e) => handleFieldChange(line.id, 'gross_salary', Number(e.target.value))}
                                  onFocus={() => setFocusedLineId(line.id)}
                                  onBlur={() => setTimeout(() => setFocusedLineId(null), 200)}
                                />
                                <LivePayrollPreview
                                  currentGross={Number(line.gross_salary)}
                                  newGross={getValue(line, 'gross_salary')}
                                  exchangeRate={exchangeRate}
                                  companyParams={companyParams}
                                  currency={line.currency}
                                  currentDeductions={detail}
                                  loanDeduction={Number(detail.loan_deduction || 0)}
                                  additionalDeductions={getValue(line, 'additional_deductions')}
                                  payrollType={currentBatch?.payroll_type}
                                  isVisible={focusedLineId === line.id && getValue(line, 'gross_salary') !== Number(line.gross_salary)}
                                />
                              </div>
                            ) : (
                              <span className="font-mono">₡{formatNumber(Math.round(grossSalaryCRC))}</span>
                            )}
                          </TableCell>
                          {showUSDColumn && !isBatchCRC && (
                            <TableCell className="text-right font-mono text-blue-600">
                              ${formatNumber(Math.round(grossSalaryUSD))}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                className="w-16 h-7 text-right text-xs"
                                value={getValue(line, 'overtime_hours')}
                                onChange={(e) => handleFieldChange(line.id, 'overtime_hours', Number(e.target.value))}
                              />
                            ) : (
                              <span className="font-mono">{formatNumber(Number(line.overtime_hours || 0))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                className="w-16 h-7 text-right text-xs"
                                value={getValue(line, 'mixed_overtime_hours' as keyof PayrollLine)}
                                onChange={(e) => handleFieldChange(line.id, 'mixed_overtime_hours', Number(e.target.value))}
                              />
                            ) : (
                              <span className="font-mono">{formatNumber(Number(line.mixed_overtime_hours || 0))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            ₡{formatNumber(Math.round(calculatedDed.ccss))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            ₡{formatNumber(Math.round(calculatedDed.bancoPopular))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            ₡{formatNumber(Math.round(calculatedDed.isr))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            ₡{formatNumber(Math.round(calculatedDed.loans))}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="1000"
                                className="w-20 h-7 text-right text-xs"
                                value={getValue(line, 'additional_deductions')}
                                onChange={(e) => handleFieldChange(line.id, 'additional_deductions', Number(e.target.value))}
                              />
                            ) : (
                              <span className="font-mono text-destructive">₡{formatNumber(Math.round(otrasDeduciones))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-destructive">
                            ₡{formatNumber(Math.round(totalDeductions))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-success">
                            ₡{formatNumber(Math.round(netPayCRC))}
                          </TableCell>
                          {showUSDColumn && !isBatchCRC && (
                            <TableCell className="text-right font-mono font-semibold text-blue-600">
                              ${formatNumber(Math.round(netPayUSD))}
                            </TableCell>
                          )}
                          <TableCell className="print:hidden">
                            {lineHasChanges && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveLine(line)}
                                disabled={isSaving}
                                className="h-7 w-7 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold text-xs border-t-2">
                      <TableCell className="print:hidden"></TableCell>
                      <TableCell>TOTALES ({payrollLines.length})</TableCell>
                      <TableCell className="text-right font-mono">
                        ₡{formatNumber(Math.round(totals?.grossSalaryCRC || 0))}
                      </TableCell>
                      {showUSDColumn && !isBatchCRC && (
                        <TableCell className="text-right font-mono text-blue-600">
                          ${formatNumber(Math.round(totals?.grossSalaryUSD || 0))}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono">
                        {formatNumber(totals?.overtimeHours || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(totals?.mixedOvertimeHours || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.ccss || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.bancoPopular || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.isr || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.loans || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.otherDeductions || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        ₡{formatNumber(Math.round(totals?.totalDeductions || 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">
                        ₡{formatNumber(Math.round(totals?.netPayCRC || 0))}
                      </TableCell>
                      {showUSDColumn && !isBatchCRC && (
                        <TableCell className="text-right font-mono text-blue-600">
                          ${formatNumber(Math.round(totals?.netPayUSD || 0))}
                        </TableCell>
                      )}
                      <TableCell className="print:hidden"></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.4in; }
          body { font-family: Arial, sans-serif !important; font-size: 9pt !important; }
          .print\\:hidden { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4pt; border: 0.5pt solid #ddd; }
          thead { background: #1a365d !important; }
          thead th { color: white !important; }
        }
      `}</style>
    </div>
  );
}