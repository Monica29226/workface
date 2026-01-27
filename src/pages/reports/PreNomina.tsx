import { useState, useMemo, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Save, Calculator, AlertCircle, CheckCircle, FileSpreadsheet, Printer, Download } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  // New HP fields
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
    absence_days?: number;
    vacation_days_taken?: number;
  };
}

export function PreNomina() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditingState>({});
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // Save individual line
  const handleSaveLine = async (line: PayrollLine) => {
    if (!hasChanges(line.id)) return;
    
    setIsSaving(true);
    try {
      const updates = editingState[line.id];
      
      const { error } = await supabase
        .from('payroll_lines')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', line.id);

      if (error) throw error;

      setEditingState(prev => {
        const { [line.id]: _, ...rest } = prev;
        return rest;
      });

      toast({
        title: "Guardado",
        description: `Cambios guardados para ${line.employee.full_name}`,
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

  // Calculate totals
  const totals = useMemo(() => {
    if (!payrollLines) return null;

    return payrollLines.reduce(
      (acc, line) => {
        const detail = line.deductions_detail || {};
        const grossSalary = getValue(line, 'gross_salary');
        const overtimeHours = getValue(line, 'overtime_hours');
        const baseImponible = detail.base_imponible_crc || (grossSalary * exchangeRate);
        const netUSD = Number(line.net_pay) / exchangeRate;
        
        return {
          grossSalaryUSD: acc.grossSalaryUSD + grossSalary,
          baseImponibleCRC: acc.baseImponibleCRC + baseImponible,
          overtimeHours: acc.overtimeHours + overtimeHours,
          ccss: acc.ccss + Number(detail.ccss_obrero || 0),
          isr: acc.isr + Number(detail.isr_neto || 0),
          bancoPopular: acc.bancoPopular + Number(detail.banco_popular || line.lpt_banco_popular || 0),
          loans: acc.loans + Number(detail.loan_deduction || 0),
          bonuses: acc.bonuses + Number(line.additional_bonuses || 0),
          otherDeductions: acc.otherDeductions + Number(line.additional_deductions || 0),
          totalDeductions: acc.totalDeductions + Number(line.deductions),
          netPayCRC: acc.netPayCRC + Number(line.net_pay),
          netPayUSD: acc.netPayUSD + netUSD,
        };
      },
      {
        grossSalaryUSD: 0,
        baseImponibleCRC: 0,
        overtimeHours: 0,
        ccss: 0,
        isr: 0,
        bancoPopular: 0,
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
      autorizado: { label: "Autorizado", variant: "default" },
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
        <div className="flex items-center gap-4 print:hidden">
          {getStatusBadge(currentBatch.status)}
          {getPayrollTypeBadge(currentBatch.payroll_type)}
          <Badge variant="outline">TC: ₡{exchangeRate.toFixed(2)}</Badge>
          {!isEditable && (
            <span className="text-sm text-muted-foreground">
              Este batch está {currentBatch.status} y no se puede editar
            </span>
          )}
          {Object.keys(editingState).length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {Object.keys(editingState).length} cambios sin guardar
            </Badge>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Bruto</div>
                <div className="text-lg font-bold text-primary">
                  ${formatNumber(totals?.grossSalaryUSD || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Deducciones</div>
                <div className="text-lg font-bold text-orange-600">
                  ₡{formatNumber(totals?.totalDeductions || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Neto a Pagar (CRC)</div>
                <div className="text-lg font-bold text-muted-foreground">
                  ₡{formatNumber(totals?.netPayCRC || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-green-800">Neto a Pagar (USD)</div>
                <div className="text-lg font-bold text-green-700">
                  ${formatNumber(totals?.netPayUSD || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deductions Summary */}
          <Card className="print:break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de Deducciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">CCSS ({companyParams?.ccss_obrero_total || 10.83}%)</div>
                  <div className="font-semibold text-orange-600">₡{formatNumber(totals?.ccss || 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ISR</div>
                  <div className="font-semibold text-orange-600">₡{formatNumber(totals?.isr || 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Banco Popular (1%)</div>
                  <div className="font-semibold text-orange-600">₡{formatNumber(totals?.bancoPopular || 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Préstamos</div>
                  <div className="font-semibold text-orange-600">₡{formatNumber(totals?.loans || 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bonos (+)</div>
                  <div className="font-semibold text-green-600">₡{formatNumber(totals?.bonuses || 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Otras Ded. (-)</div>
                  <div className="font-semibold text-orange-600">₡{formatNumber(totals?.otherDeductions || 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Table */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-2 print:py-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Detalle por Empleado ({payrollLines.length})</span>
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
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Salario Bruto</TableHead>
                      <TableHead className="text-right">Hrs Extra</TableHead>
                      <TableHead className="text-right">CCSS</TableHead>
                      <TableHead className="text-right">B. Popular</TableHead>
                      <TableHead className="text-right">ISR</TableHead>
                      <TableHead className="text-right">Préstamos</TableHead>
                      <TableHead className="text-right">Otras Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-orange-700">Total Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-green-600">Neto</TableHead>
                      <TableHead className="w-16 print:hidden"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.map((line) => {
                      const isValid = validateLine(line);
                      const lineHasChanges = hasChanges(line.id);
                      const detail = line.deductions_detail || {};
                      const isCRC = line.currency === 'CRC';
                      const grossDisplay = isCRC 
                        ? `₡${formatNumber(Number(line.gross_salary))}` 
                        : `$${formatNumber(Number(line.gross_salary))}`;
                      const netDisplay = isCRC 
                        ? `₡${formatNumber(Number(line.net_pay))}` 
                        : `$${(Number(line.net_pay) / exchangeRate).toFixed(2)}`;
                      const bancoPopular = Number(detail.banco_popular || line.lpt_banco_popular || 0);
                      
                      return (
                        <TableRow 
                          key={line.id} 
                          className={`text-xs ${lineHasChanges ? 'bg-accent/50' : ''} ${!isValid ? 'bg-destructive/5' : ''}`}
                        >
                          <TableCell className="print:hidden">
                            {isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
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
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="100"
                                className="w-28 h-7 text-right text-xs"
                                value={getValue(line, 'gross_salary')}
                                onChange={(e) => handleFieldChange(line.id, 'gross_salary', Number(e.target.value))}
                              />
                            ) : (
                              <span className="font-mono">{grossDisplay}</span>
                            )}
                          </TableCell>
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
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(detail.ccss_obrero || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(bancoPopular)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(detail.isr_neto || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(detail.loan_deduction || 0)}
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
                              <span className="font-mono text-orange-600">₡{formatNumber(Number(line.additional_deductions || 0))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-orange-700">
                            ₡{formatNumber(Number(line.deductions))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {netDisplay}
                          </TableCell>
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
                        ₡{formatNumber(totals?.baseImponibleCRC || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(totals?.overtimeHours || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.ccss || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.bancoPopular || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.isr || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.loans || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.otherDeductions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-700">
                        ₡{formatNumber(totals?.totalDeductions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        ₡{formatNumber(totals?.netPayCRC || 0)}
                      </TableCell>
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