import { useState, useMemo, useEffect, useCallback } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Eye, Search, FileText, Download, Send, Minus, Building2, User, Calculator, Save, Pencil, X } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import logoACL from "@/assets/logotipo_acl.png";

// Format CRC without decimals
const formatCRC = (amount: number): string => {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
};

// CCSS rate for standard companies
const CCSS_RATE = 0.1083;

// ISR 2026 brackets
const calculateISR = (baseImponible: number): number => {
  let isr = 0;
  if (baseImponible > 4727000) {
    isr += (baseImponible - 4727000) * 0.25;
    baseImponible = 4727000;
  }
  if (baseImponible > 2364000) {
    isr += (baseImponible - 2364000) * 0.20;
    baseImponible = 2364000;
  }
  if (baseImponible > 1347000) {
    isr += (baseImponible - 1347000) * 0.15;
    baseImponible = 1347000;
  }
  if (baseImponible > 918000) {
    isr += (baseImponible - 918000) * 0.10;
  }
  return isr;
};

interface DeductionsDetail {
  ccss_obrero?: number;
  ccss_rate?: number;
  base_imponible_crc?: number;
  isr_neto?: number;
  isr_10?: number;
  isr_15?: number;
  isr_20?: number;
  isr_25?: number;
  magisterio?: number;
  poliza_vida?: number;
  loan_deduction?: number;
  items?: Array<{
    code: string;
    label: string;
    amount: number;
    rate?: number;
  }>;
  total_deductions?: number;
}

interface PayrollLine {
  id: string;
  employee_id: string;
  gross_salary: number;
  deductions: number;
  net_pay: number;
  currency: string;
  exchange_rate_to_base: number;
  regular_hours: number;
  overtime_hours: number;
  additional_bonuses: number;
  additional_deductions: number;
  vacation_days_taken: number;
  vacation_accrued_days: number;
  aguinaldo_accrued: number;
  deductions_detail: DeductionsDetail | null;
  cost_center_id: string | null;
  employee: {
    id: string;
    full_name: string;
    employee_id: string;
    work_email: string;
    hire_date: string;
  };
  cost_center?: {
    name: string;
    code: string;
  } | null;
}

interface PayrollBatch {
  id: string;
  batch_id: string;
  period_start: string;
  period_end: string;
  status: string;
  base_currency: string;
  payroll_type: string;
}

interface EditableValues {
  baseSalary: number;
  horasExtra: number;
  adelanto: number;
}

// Calculate overtime amount based on hourly rate
function calculateOvertimeAmount(baseSalary: number, horasExtra: number): number {
  // Hourly rate = monthly salary / 240 (8 hours * 30 days)
  const hourlyRate = baseSalary / 240;
  // Overtime at 1.5x
  return Math.round(hourlyRate * horasExtra * 1.5);
}

// Calculate deductions based on gross salary
function calculateDeductions(grossSalary: number, adelanto: number, originalDetail: DeductionsDetail | null): {
  ccss: number;
  isr: number;
  otros: number;
  totalDeductions: number;
  netPay: number;
  faltaPorPagar: number;
} {
  const baseImponible = grossSalary;
  const ccss = Math.round(baseImponible * CCSS_RATE);
  const baseParaISR = baseImponible - ccss;
  const isr = Math.round(calculateISR(baseParaISR));
  
  // Include other deductions from original detail (loans, etc.)
  const otros = originalDetail?.loan_deduction || 0;
  
  const totalDeductions = ccss + isr + otros;
  const netPay = grossSalary - totalDeductions;
  const faltaPorPagar = netPay - adelanto;
  
  return { ccss, isr, otros, totalDeductions, netPay, faltaPorPagar };
}

// Editable Employee Card Component
function EditableEmployeeCard({ 
  line, 
  onSave,
  isSaving,
  t
}: { 
  line: PayrollLine;
  onSave: (lineId: string, grossSalary: number, adelanto: number, deductions: number, netPay: number, overtimeHours: number, overtimeAmount: number) => void;
  isSaving: boolean;
  t: (key: string) => string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Get base salary (gross - existing overtime if any)
  const existingOvertimeAmount = Number(line.overtime_hours || 0) > 0 
    ? calculateOvertimeAmount(Number(line.gross_salary) - (Number(line.overtime_hours || 0) * (Number(line.gross_salary) / 240) * 1.5), Number(line.overtime_hours || 0))
    : 0;
  
  const [values, setValues] = useState<EditableValues>({
    baseSalary: Number(line.gross_salary) - existingOvertimeAmount,
    horasExtra: Number(line.overtime_hours) || 0,
    adelanto: Number(line.additional_deductions) || 0,
  });
  
  // Calculate overtime and gross in real-time
  const overtimeAmount = useMemo(() => {
    return calculateOvertimeAmount(values.baseSalary, values.horasExtra);
  }, [values.baseSalary, values.horasExtra]);
  
  const grossSalary = useMemo(() => {
    return values.baseSalary + overtimeAmount;
  }, [values.baseSalary, overtimeAmount]);
  
  // Calculate real-time deductions
  const calculations = useMemo(() => {
    return calculateDeductions(grossSalary, values.adelanto, line.deductions_detail);
  }, [grossSalary, values.adelanto, line.deductions_detail]);
  
  const handleBaseSalaryChange = (value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    setValues(prev => ({ ...prev, baseSalary: numValue }));
  };
  
  const handleHorasExtraChange = (value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    setValues(prev => ({ ...prev, horasExtra: numValue }));
  };
  
  const handleAdelantoChange = (value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    setValues(prev => ({ ...prev, adelanto: numValue }));
  };
  
  const handleSave = () => {
    onSave(
      line.id, 
      grossSalary, 
      values.adelanto, 
      calculations.totalDeductions, 
      calculations.netPay,
      values.horasExtra,
      overtimeAmount
    );
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    const existingOT = Number(line.overtime_hours || 0) > 0 
      ? calculateOvertimeAmount(Number(line.gross_salary) - (Number(line.overtime_hours || 0) * (Number(line.gross_salary) / 240) * 1.5), Number(line.overtime_hours || 0))
      : 0;
    setValues({
      baseSalary: Number(line.gross_salary) - existingOT,
      horasExtra: Number(line.overtime_hours) || 0,
      adelanto: Number(line.additional_deductions) || 0,
    });
    setIsEditing(false);
  };

  // Check for changes
  const originalOTAmount = Number(line.overtime_hours || 0) > 0 
    ? calculateOvertimeAmount(Number(line.gross_salary) - existingOvertimeAmount, Number(line.overtime_hours || 0))
    : 0;
  const originalBase = Number(line.gross_salary) - originalOTAmount;
  
  const hasChanges = values.baseSalary !== originalBase || 
                     values.horasExtra !== (Number(line.overtime_hours) || 0) ||
                     values.adelanto !== (Number(line.additional_deductions) || 0);

  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 border-l-4 ${isEditing ? 'border-l-primary ring-2 ring-primary/20' : 'border-l-primary/20 hover:border-l-primary'}`}>
      <CardContent className="p-5">
        {/* Header: Employee Info */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground leading-tight">
                {line.employee.full_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {line.employee.employee_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {line.cost_center && (
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                {line.cost_center.code}
              </Badge>
            )}
            {!isEditing ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Salary Breakdown - ALL IN CRC */}
        <div className="space-y-3">
          {/* Base Salary - Editable */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">Salario Base</Badge>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">₡</span>
                <Input
                  type="text"
                  value={values.baseSalary.toLocaleString('es-CR')}
                  onChange={(e) => handleBaseSalaryChange(e.target.value)}
                  className="h-8 w-32 text-right font-mono text-base"
                />
              </div>
            ) : (
              <span className="font-mono text-base font-medium text-foreground tabular-nums">
                {formatCRC(values.baseSalary)}
              </span>
            )}
          </div>

          {/* Horas Extra - NEW Editable Field */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-green-50 border border-green-200' : 'bg-green-50/50'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-green-700 border-green-300 bg-green-100">
                + Hrs Extra (1.5×)
              </Badge>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={values.horasExtra}
                    onChange={(e) => handleHorasExtraChange(e.target.value)}
                    className="h-8 w-16 text-right font-mono text-sm"
                    min="0"
                    step="0.5"
                  />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
                <span className="font-mono text-sm text-green-700">= {formatCRC(overtimeAmount)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {values.horasExtra > 0 && (
                  <span className="text-xs text-muted-foreground">{values.horasExtra} hrs =</span>
                )}
                <span className="font-mono text-base font-medium text-green-700 tabular-nums">
                  +{formatCRC(overtimeAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Gross Salary Total */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border-2 border-dashed">
            <Badge variant="secondary" className="text-xs font-normal">{t('payroll.gross')}</Badge>
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">
              {formatCRC(grossSalary)}
            </span>
          </div>

          {/* Adelanto de Salario - Editable Field */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-amber-50 border border-amber-200' : 'bg-amber-50/50'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-amber-700 border-amber-300 bg-amber-100">
                <Minus className="h-3 w-3 mr-1" />
                Adelanto
              </Badge>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">₡</span>
                <Input
                  type="text"
                  value={values.adelanto.toLocaleString('es-CR')}
                  onChange={(e) => handleAdelantoChange(e.target.value)}
                  className="h-8 w-32 text-right font-mono text-base"
                  placeholder="0"
                />
              </div>
            ) : (
              <span className="font-mono text-base font-medium text-amber-700 tabular-nums">
                -{formatCRC(values.adelanto)}
              </span>
            )}
          </div>

          {/* Deductions Breakdown */}
          <div className="bg-destructive/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">CCSS (10.83%)</span>
              <span className="font-mono text-destructive">-{formatCRC(calculations.ccss)}</span>
            </div>
            {calculations.isr > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ISR</span>
                <span className="font-mono text-destructive">-{formatCRC(calculations.isr)}</span>
              </div>
            )}
            {calculations.otros > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Otros (Préstamos)</span>
                <span className="font-mono text-destructive">-{formatCRC(calculations.otros)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
              <Badge variant="outline" className="text-xs font-normal text-destructive border-destructive/20">
                Total Deducciones
              </Badge>
              <span className="font-mono text-base font-medium text-destructive tabular-nums">
                -{formatCRC(calculations.totalDeductions)}
              </span>
            </div>
          </div>

          {/* Net Pay */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border">
            <Badge variant="secondary" className="text-xs font-normal">Total a Recibir</Badge>
            <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
              {formatCRC(calculations.netPay)}
            </span>
          </div>

          {/* Adelanto Recibido Display */}
          {values.adelanto > 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-amber-100 rounded-lg border border-amber-300">
              <Badge variant="outline" className="text-xs font-normal text-amber-800 border-amber-400 bg-amber-200">
                (-) Adelanto Recibido
              </Badge>
              <span className="font-mono text-base font-medium text-amber-800 tabular-nums">
                -{formatCRC(values.adelanto)}
              </span>
            </div>
          )}

          {/* FALTA POR PAGAR - Final Result */}
          <div className="bg-primary rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Badge className="text-xs font-bold bg-white/20 text-white hover:bg-white/20">
                = FALTA POR PAGAR
              </Badge>
              <span className="font-mono text-xl font-bold text-white tabular-nums">
                {formatCRC(calculations.faltaPorPagar)}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time calculation indicator */}
        {isEditing && hasChanges && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary">
            <Calculator className="h-3 w-3 animate-pulse" />
            <span>Cálculos actualizados en tiempo real</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Detail Modal Component - ONLY CRC
function PayrollDetailModal({
  isOpen,
  onClose,
  line,
  companyName,
  periodLabel,
  onDownloadPDF,
  isDownloading,
  t
}: {
  isOpen: boolean;
  onClose: () => void;
  line: PayrollLine | null;
  companyName: string;
  periodLabel: string;
  onDownloadPDF: () => void;
  isDownloading: boolean;
  t: (key: string) => string;
}) {
  if (!line) return null;

  const detail = line.deductions_detail || {};
  const adelanto = Number(line.additional_deductions) || 0;
  const calculations = calculateDeductions(Number(line.gross_salary), adelanto, detail);

  // Build deductions list from detail with translations
  const deductionItems = [
    { code: 'ccss', label: 'CCSS (10.83%)', amount: calculations.ccss },
    ...(calculations.isr > 0 ? [{ code: 'isr', label: 'ISR', amount: calculations.isr }] : []),
    ...(calculations.otros > 0 ? [{ code: 'otros', label: 'Préstamos', amount: calculations.otros }] : []),
  ].filter(item => item.amount > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          {/* Company Header */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {companyName || t('precolilla.detail_title')}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <FileText className="h-4 w-4" />
                <span>{t('precolilla.period')}: {periodLabel}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Collaborator Info */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{line.employee.full_name}</p>
                  <p className="text-sm text-muted-foreground">{line.employee.employee_id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards - ONLY CRC */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>+ Salario Bruto</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatCRC(Number(line.gross_salary))}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>− Total Deducciones</span>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatCRC(calculations.totalDeductions)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Deductions Breakdown - ONLY CRC */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              − Desglose de Deducciones
            </h4>
            
            {deductionItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Concepto</th>
                      <th className="text-right p-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductionItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.label}</td>
                        <td className="p-3 text-right font-mono text-destructive">
                          -{formatCRC(item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right font-mono text-destructive">
                        -{formatCRC(calculations.totalDeductions)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay deducciones
              </p>
            )}
          </div>

          {/* Net Pay */}
          <Card className="bg-muted/50 border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total a Recibir</span>
                <p className="text-xl font-bold text-foreground">
                  {formatCRC(calculations.netPay)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Adelanto Section */}
          {adelanto > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-amber-800">(-) Adelanto Recibido</span>
                  <p className="text-xl font-bold text-amber-800">
                    -{formatCRC(adelanto)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FALTA POR PAGAR - Final */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">= FALTA POR PAGAR</span>
                <p className="text-2xl font-bold text-white">
                  {formatCRC(calculations.faltaPorPagar)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Download Button */}
          <div className="flex justify-end pt-2">
            <Button 
              onClick={onDownloadPDF}
              disabled={isDownloading}
              className="gap-2"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? t('common.generating') : t('common.download_pdf')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PreColilla() {
  const { selectedCompany } = useCompany();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollLine | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch payroll batches
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["payrollBatchesPreColilla", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("payroll_batches")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .in("status", ["aprobado", "autorizado", "calculado"])
        .order("period_end", { ascending: false });

      if (error) throw error;
      return data as PayrollBatch[];
    },
    enabled: !!selectedCompany?.id,
  });

  // Auto-select first batch when available
  useEffect(() => {
    if (batches && batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Fetch payroll lines for selected batch
  const { data: payrollLines, isLoading: linesLoading } = useQuery({
    queryKey: ["payrollLinesPreColilla", selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return [];

      const { data, error } = await supabase
        .from("payroll_lines")
        .select(`
          *,
          employee:employees!inner(id, employee_id, full_name, work_email, hire_date),
          cost_center:cost_centers(name, code)
        `)
        .eq("batch_id", selectedBatchId)
        .order("employee(full_name)");

      if (error) throw error;
      return data as unknown as PayrollLine[];
    },
    enabled: !!selectedBatchId,
  });

  const currentBatch = batches?.find(b => b.id === selectedBatchId);

  // Filtered payroll lines by search
  const filteredLines = useMemo(() => {
    if (!payrollLines) return [];
    if (!searchTerm) return payrollLines;
    
    const term = searchTerm.toLowerCase();
    return payrollLines.filter(line => 
      line.employee.full_name.toLowerCase().includes(term) ||
      line.employee.employee_id.toLowerCase().includes(term)
    );
  }, [payrollLines, searchTerm]);

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const monthsEs = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const months = language === 'en' ? monthsEn : monthsEs;
    return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { labelKey: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      calculado: { labelKey: "status.calculated", variant: "secondary" },
      aprobado: { labelKey: "status.approved", variant: "default" },
      autorizado: { labelKey: "status.authorized", variant: "outline" },
      enviado: { labelKey: "status.sent", variant: "outline" },
    };
    const config = statusConfig[status] || { labelKey: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>;
  };

  const getPayrollTypeBadge = (type: string) => {
    const typeConfig: Record<string, { labelKey: string; className: string }> = {
      adelanto: { labelKey: "payroll_type.adelanto", className: "bg-amber-100 text-amber-800 border-amber-200" },
      segunda: { labelKey: "payroll_type.segunda", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
      completa: { labelKey: "payroll_type.completa", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    };
    const config = typeConfig[type] || { labelKey: type, className: "" };
    return <Badge variant="outline" className={config.className}>{t(config.labelKey)}</Badge>;
  };

  const handleViewDetail = (line: PayrollLine) => {
    setSelectedEmployee(line);
    setIsPdfModalOpen(true);
  };

  const handleSavePayrollLine = useCallback(async (
    lineId: string, 
    grossSalary: number, 
    adelanto: number, 
    deductions: number, 
    netPay: number,
    overtimeHours: number,
    overtimeAmount: number
  ) => {
    setIsSaving(true);
    try {
      const faltaPorPagar = netPay - adelanto;
      
      const { error } = await supabase
        .from("payroll_lines")
        .update({
          gross_salary: grossSalary,
          additional_deductions: adelanto,
          deductions: deductions,
          net_pay: netPay,
          total_to_pay: faltaPorPagar,
          overtime_hours: overtimeHours,
          overtime: overtimeAmount,
        })
        .eq("id", lineId);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Los cambios se guardaron correctamente",
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["payrollLinesPreColilla", selectedBatchId] });
    } catch (error: any) {
      console.error('Error saving payroll line:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [selectedBatchId, queryClient, toast]);

  const handleApproveAndSend = async () => {
    if (!selectedBatchId) return;

    const currentStatus = currentBatch?.status;
    
    if (currentStatus !== 'autorizado') {
      toast({
        title: "Batch no autorizado",
        description: "El batch debe estar en estado 'Autorizado' para enviar colillas.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Funcionalidad pendiente",
      description: "La generación y envío de colillas se ejecuta desde la página de Colillas de Pago",
    });
  };

  const handleDownloadPDF = async () => {
    if (!selectedEmployee) return;

    setIsDownloading(true);
    try {
      const response = await supabase.functions.invoke('generate-precolilla-pdf', {
        body: { payrollLineId: selectedEmployee.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error al generar PDF');
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pre-colilla-${selectedEmployee.employee.employee_id}-${currentBatch?.period_end || 'periodo'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Generado",
        description: `Pre-colilla de ${selectedEmployee.employee.full_name} descargada exitosamente`,
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Summary totals - ALL IN CRC
  const totals = useMemo(() => {
    if (!payrollLines) return { gross: 0, deductions: 0, net: 0, adelantos: 0, faltaPorPagar: 0 };
    return payrollLines.reduce((acc, line) => {
      const adelanto = Number(line.additional_deductions) || 0;
      const calc = calculateDeductions(Number(line.gross_salary), adelanto, line.deductions_detail);
      return {
        gross: acc.gross + Number(line.gross_salary),
        deductions: acc.deductions + calc.totalDeductions,
        net: acc.net + calc.netPay,
        adelantos: acc.adelantos + adelanto,
        faltaPorPagar: acc.faltaPorPagar + calc.faltaPorPagar,
      };
    }, { gross: 0, deductions: 0, net: 0, adelantos: 0, faltaPorPagar: 0 });
  }, [payrollLines]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={logoACL} alt="ACL" className="h-10 w-auto hidden lg:block" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('precolilla.title')}</h1>
            <p className="text-muted-foreground">
              {t('precolilla.description')} - Solo Colones (₡)
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select
            value={selectedBatchId || ""}
            onValueChange={setSelectedBatchId}
          >
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue placeholder={t('common.select_period')} />
            </SelectTrigger>
            <SelectContent>
              {batchesLoading ? (
                <div className="p-2 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : (
                batches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {formatPeriod(batch.period_start, batch.period_end)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {currentBatch?.status === 'autorizado' && (
            <Button onClick={handleApproveAndSend} className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              <Send className="h-4 w-4" />
              {t('common.send_payslips')}
            </Button>
          )}
        </div>
      </div>

      {/* Batch Info Bar - NO USD references */}
      {currentBatch && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {getStatusBadge(currentBatch.status)}
              {currentBatch.payroll_type && getPayrollTypeBadge(currentBatch.payroll_type)}
              <span className="text-sm text-muted-foreground">
                {payrollLines?.length || 0} {t('common.collaborators')}
              </span>
              
              {/* Summary Totals - ONLY CRC */}
              <div className="ml-auto flex flex-wrap gap-4 text-sm">
                <div className="text-muted-foreground">
                  Bruto: <span className="font-mono font-medium text-foreground">₡{formatNumber(totals.gross)}</span>
                </div>
                <div className="text-muted-foreground">
                  Deducciones: <span className="font-mono font-medium text-destructive">–₡{formatNumber(totals.deductions)}</span>
                </div>
                <div className="text-muted-foreground">
                  Neto: <span className="font-mono font-medium text-foreground">₡{formatNumber(totals.net)}</span>
                </div>
                {totals.adelantos > 0 && (
                  <div className="text-muted-foreground">
                    Adelantos: <span className="font-mono font-medium text-amber-600">–₡{formatNumber(totals.adelantos)}</span>
                  </div>
                )}
                <div className="text-muted-foreground">
                  <span className="font-semibold">Falta:</span> <span className="font-mono font-bold text-primary">₡{formatNumber(totals.faltaPorPagar)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedBatchId ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">{t('precolilla.no_period_selected')}</p>
            <p className="text-sm">{t('precolilla.select_period_hint')}</p>
          </CardContent>
        </Card>
      ) : linesLoading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">{t('precolilla.loading_data')}</p>
          </CardContent>
        </Card>
      ) : !payrollLines || payrollLines.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t('precolilla.no_data')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('precolilla.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Employee Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLines.map((line) => (
              <EditableEmployeeCard
                key={line.id}
                line={line}
                onSave={handleSavePayrollLine}
                isSaving={isSaving}
                t={t}
              />
            ))}
          </div>

          {filteredLines.length === 0 && searchTerm && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>{t('precolilla.no_results')} "{searchTerm}"</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Detail Modal */}
      <PayrollDetailModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        line={selectedEmployee}
        companyName={selectedCompany?.name || ''}
        periodLabel={currentBatch ? formatPeriod(currentBatch.period_start, currentBatch.period_end) : ''}
        onDownloadPDF={handleDownloadPDF}
        isDownloading={isDownloading}
        t={t}
      />
    </div>
  );
}
