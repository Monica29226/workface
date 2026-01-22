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
import { Loader2, RefreshCw, Save, Calculator, AlertCircle, CheckCircle, FileSpreadsheet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  deductions_detail: {
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
  } | null;
  employee: {
    id: string;
    full_name: string;
    employee_id: string;
    base_salary: number;
    currency: string;
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
}

interface EditingState {
  [lineId: string]: {
    gross_salary?: number;
    additional_bonuses?: number;
    additional_deductions?: number;
  };
}

export function EditablePayrollReport() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditingState>({});
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch payroll batches
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["payrollBatchesEditable", selectedCompany?.id],
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
    queryKey: ["payrollLinesEditable", selectedBatchId],
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
    queryKey: ["companyParamsEditable", selectedCompany?.id],
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

      // Clear editing state for this line
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

      // Clear all editing state
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

  // Calculate totals
  const totals = useMemo(() => {
    if (!payrollLines) return null;

    return payrollLines.reduce(
      (acc, line) => {
        const grossSalary = getValue(line, 'gross_salary');
        const baseImponible = line.deductions_detail?.base_imponible_crc || (grossSalary * (line.exchange_rate_to_base || 1));
        
        return {
          grossSalaryUSD: acc.grossSalaryUSD + (line.currency === 'USD' ? grossSalary : 0),
          baseImponibleCRC: acc.baseImponibleCRC + baseImponible,
          ccss: acc.ccss + Number(line.deductions_detail?.ccss_obrero || 0),
          isr: acc.isr + Number(line.deductions_detail?.isr_neto || 0),
          totalDeductions: acc.totalDeductions + Number(line.deductions),
          netPay: acc.netPay + Number(line.net_pay),
        };
      },
      {
        grossSalaryUSD: 0,
        baseImponibleCRC: 0,
        ccss: 0,
        isr: 0,
        totalDeductions: 0,
        netPay: 0,
      }
    );
  }, [payrollLines, getValue]);

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

  // Validate if net = gross - deductions
  const validateLine = (line: PayrollLine) => {
    const baseImponible = line.deductions_detail?.base_imponible_crc || 0;
    const deductions = Number(line.deductions) || 0;
    const netPay = Number(line.net_pay) || 0;
    const expected = baseImponible - deductions;
    return Math.abs(expected - netPay) < 1; // 1 CRC tolerance
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planilla Editable</h1>
          <p className="text-muted-foreground">
            Edite salarios y deducciones, luego recalcule automáticamente
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
            <SelectTrigger className="w-[280px]">
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

          {selectedBatchId && (
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
          )}
        </div>
      </div>

      {/* Batch Info */}
      {currentBatch && (
        <div className="flex items-center gap-4">
          {getStatusBadge(currentBatch.status)}
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
            Seleccione un período de planilla para editar
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total USD</div>
                <div className="text-lg font-bold text-primary">
                  ${formatNumber(totals?.grossSalaryUSD || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Base Imponible CRC</div>
                <div className="text-lg font-bold">
                  ₡{formatNumber(totals?.baseImponibleCRC || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">CCSS {companyParams?.ccss_obrero_total || 10.67}%</div>
                <div className="text-lg font-bold text-orange-600">
                  ₡{formatNumber(totals?.ccss || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">ISR</div>
                <div className="text-lg font-bold text-orange-600">
                  ₡{formatNumber(totals?.isr || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Neto</div>
                <div className="text-lg font-bold text-green-600">
                  ₡{formatNumber(totals?.netPay || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Editable Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Detalle por Empleado</span>
                <span className="text-sm font-normal text-muted-foreground">
                  TC: {payrollLines[0]?.exchange_rate_to_base || 505.10}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Salario USD</TableHead>
                      <TableHead className="text-right">Base CRC</TableHead>
                      <TableHead className="text-right">CCSS</TableHead>
                      <TableHead className="text-right">ISR</TableHead>
                      <TableHead className="text-right">Bonos</TableHead>
                      <TableHead className="text-right">Otros Ded.</TableHead>
                      <TableHead className="text-right font-semibold">Total Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-green-600">Neto CRC</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.map((line) => {
                      const isValid = validateLine(line);
                      const lineHasChanges = hasChanges(line.id);
                      const baseImponible = line.deductions_detail?.base_imponible_crc || 0;
                      
                      return (
                        <TableRow 
                          key={line.id} 
                          className={`text-xs ${lineHasChanges ? 'bg-accent/50' : ''} ${!isValid ? 'bg-destructive/5' : ''}`}
                        >
                          <TableCell>
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
                                value={getValue(line, 'gross_salary')}
                                onChange={(e) => handleFieldChange(line.id, 'gross_salary', Number(e.target.value))}
                                className="h-7 w-24 text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="font-mono">${formatNumber(Number(line.gross_salary))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ₡{formatNumber(baseImponible)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(Number(line.deductions_detail?.ccss_obrero || 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(Number(line.deductions_detail?.isr_neto || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="1000"
                                value={getValue(line, 'additional_bonuses')}
                                onChange={(e) => handleFieldChange(line.id, 'additional_bonuses', Number(e.target.value))}
                                className="h-7 w-20 text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="font-mono">{formatNumber(Number(line.additional_bonuses))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                step="1000"
                                value={getValue(line, 'additional_deductions')}
                                onChange={(e) => handleFieldChange(line.id, 'additional_deductions', Number(e.target.value))}
                                className="h-7 w-20 text-xs text-right font-mono"
                              />
                            ) : (
                              <span className="font-mono">{formatNumber(Number(line.additional_deductions))}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-orange-700">
                            ₡{formatNumber(Number(line.deductions))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            ₡{formatNumber(Number(line.net_pay))}
                          </TableCell>
                          <TableCell>
                            {lineHasChanges && isEditable && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveLine(line)}
                                disabled={isSaving}
                                className="h-7 px-2"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell></TableCell>
                      <TableCell>TOTALES</TableCell>
                      <TableCell className="text-right font-mono">
                        ${formatNumber(totals?.grossSalaryUSD || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₡{formatNumber(totals?.baseImponibleCRC || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.ccss || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        ₡{formatNumber(totals?.isr || 0)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right font-mono text-orange-700">
                        ₡{formatNumber(totals?.totalDeductions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        ₡{formatNumber(totals?.netPay || 0)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Help text */}
          <p className="text-sm text-muted-foreground text-center">
            💡 Edite los valores y presione <strong>Recalcular</strong> para actualizar CCSS, ISR y neto automáticamente
          </p>
        </>
      )}
    </div>
  );
}
