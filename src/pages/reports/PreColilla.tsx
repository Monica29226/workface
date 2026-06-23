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
import { ACLLogo } from "@/components/branding/ACLLogo";

// Format CRC without decimals
const formatCRC = (amount: number): string => {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
};

// Format USD without decimals
const formatUSD = (amount: number): string => {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

// Check if company is Horizonte Positivo (uses USD)
const isHorizontePositivo = (companyName: string | undefined): boolean => {
  if (!companyName) return false;
  return /horizonte\s*positivo/i.test(companyName);
};

// CCSS rate for standard companies
const CCSS_RATE = 0.1083;

// ISR 2026 brackets - returns breakdown per bracket
interface ISRBreakdown {
  total: number;
  isr_10: number;
  isr_15: number;
  isr_20: number;
  isr_25: number;
}

const calculateISRWithBreakdown = (baseImponible: number): ISRBreakdown => {
  let remaining = baseImponible;
  let isr_10 = 0;
  let isr_15 = 0;
  let isr_20 = 0;
  let isr_25 = 0;

  // Bracket 25%: > ₡4,727,000
  if (remaining > 4727000) {
    isr_25 = (remaining - 4727000) * 0.25;
    remaining = 4727000;
  }
  // Bracket 20%: ₡2,364,000 - ₡4,727,000
  if (remaining > 2364000) {
    isr_20 = (remaining - 2364000) * 0.20;
    remaining = 2364000;
  }
  // Bracket 15%: ₡1,347,000 - ₡2,364,000
  if (remaining > 1347000) {
    isr_15 = (remaining - 1347000) * 0.15;
    remaining = 1347000;
  }
  // Bracket 10%: ₡918,000 - ₡1,347,000
  if (remaining > 918000) {
    isr_10 = (remaining - 918000) * 0.10;
  }
  // 0% for first ₡918,000

  return {
    total: Math.round(isr_10 + isr_15 + isr_20 + isr_25),
    isr_10: Math.round(isr_10),
    isr_15: Math.round(isr_15),
    isr_20: Math.round(isr_20),
    isr_25: Math.round(isr_25),
  };
};

// Legacy function for backward compatibility
const calculateISR = (baseImponible: number): number => {
  return calculateISRWithBreakdown(baseImponible).total;
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
  mixed_overtime_hours: number;
  mixed_overtime_amount: number;
  overtime: number;
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
  horasDobles: number;
  adelanto: number;
}

// Calculate overtime amount based on hourly rate (1.5×)
function calculateOvertimeAmount(baseSalary: number, horasExtra: number): number {
  const hourlyRate = baseSalary / 240;
  return Math.round(hourlyRate * horasExtra * 1.5);
}

// Calculate double hours amount based on hourly rate (2×) - for holidays/night work
function calculateDoubleHoursAmount(baseSalary: number, horasDobles: number): number {
  const hourlyRate = baseSalary / 240;
  return Math.round(hourlyRate * horasDobles * 2);
}

// Calculate deductions based on gross salary with ISR breakdown
interface DeductionsCalc {
  ccss: number;
  isr: number;
  isrBreakdown: ISRBreakdown;
  otros: number;
  totalDeductions: number;
  netPay: number;
  faltaPorPagar: number;
}

function calculateDeductions(grossSalary: number, adelanto: number, originalDetail: DeductionsDetail | null): DeductionsCalc {
  const baseImponible = grossSalary;
  const ccss = Math.round(baseImponible * CCSS_RATE);
  const baseParaISR = baseImponible - ccss;
  const isrBreakdown = calculateISRWithBreakdown(baseParaISR);
  
  // Include other deductions from original detail (loans, etc.)
  const otros = originalDetail?.loan_deduction || 0;
  
  const totalDeductions = ccss + isrBreakdown.total + otros;
  const netPay = grossSalary - totalDeductions;
  const faltaPorPagar = netPay - adelanto;
  
  return { ccss, isr: isrBreakdown.total, isrBreakdown, otros, totalDeductions, netPay, faltaPorPagar };
}

// Editable Employee Card Component
function EditableEmployeeCard({ 
  line, 
  onSave,
  isSaving,
  t,
  isUSD,
  exchangeRate
}: { 
  line: PayrollLine;
  onSave: (lineId: string, grossSalary: number, adelanto: number, deductions: number, netPay: number, overtimeHours: number, overtimeAmount: number, doubleHours: number, doubleAmount: number) => void;
  isSaving: boolean;
  t: (key: string) => string;
  isUSD: boolean;
  exchangeRate: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  
  // Currency formatter based on company type
  const formatAmount = (amountCRC: number): string => {
    if (isUSD && exchangeRate > 0) {
      return formatUSD(amountCRC / exchangeRate);
    }
    return formatCRC(amountCRC);
  };
  
  // Get currency symbol
  const currencySymbol = isUSD ? '$' : '₡';
  
  // Get existing overtime and double hours amounts
  const existingOvertimeAmount = Number(line.overtime_hours || 0) > 0 
    ? calculateOvertimeAmount(Number(line.gross_salary) - (Number(line.overtime_hours || 0) * (Number(line.gross_salary) / 240) * 1.5) - (Number(line.mixed_overtime_hours || 0) * (Number(line.gross_salary) / 240) * 2), Number(line.overtime_hours || 0))
    : 0;
  const existingDoubleAmount = Number(line.mixed_overtime_hours || 0) > 0
    ? calculateDoubleHoursAmount(Number(line.gross_salary) - existingOvertimeAmount - (Number(line.mixed_overtime_hours || 0) * (Number(line.gross_salary) / 240) * 2), Number(line.mixed_overtime_hours || 0))
    : 0;
  
  const [values, setValues] = useState<EditableValues>({
    baseSalary: Number(line.gross_salary) - existingOvertimeAmount - existingDoubleAmount,
    horasExtra: Number(line.overtime_hours) || 0,
    horasDobles: Number(line.mixed_overtime_hours) || 0,
    adelanto: Number(line.additional_deductions) || 0,
  });
  
  // Calculate overtime amounts in real-time
  const overtimeAmount = useMemo(() => {
    return calculateOvertimeAmount(values.baseSalary, values.horasExtra);
  }, [values.baseSalary, values.horasExtra]);
  
  const doubleHoursAmount = useMemo(() => {
    return calculateDoubleHoursAmount(values.baseSalary, values.horasDobles);
  }, [values.baseSalary, values.horasDobles]);
  
  const grossSalary = useMemo(() => {
    return values.baseSalary + overtimeAmount + doubleHoursAmount;
  }, [values.baseSalary, overtimeAmount, doubleHoursAmount]);
  
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
  
  const handleHorasDoblesChange = (value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    setValues(prev => ({ ...prev, horasDobles: numValue }));
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
      overtimeAmount,
      values.horasDobles,
      doubleHoursAmount
    );
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    const existingOT = Number(line.overtime_hours || 0) > 0 
      ? calculateOvertimeAmount(Number(line.gross_salary) - existingOvertimeAmount - existingDoubleAmount, Number(line.overtime_hours || 0))
      : 0;
    const existingDouble = Number(line.mixed_overtime_hours || 0) > 0
      ? calculateDoubleHoursAmount(Number(line.gross_salary) - existingOT - existingDoubleAmount, Number(line.mixed_overtime_hours || 0))
      : 0;
    setValues({
      baseSalary: Number(line.gross_salary) - existingOT - existingDouble,
      horasExtra: Number(line.overtime_hours) || 0,
      horasDobles: Number(line.mixed_overtime_hours) || 0,
      adelanto: Number(line.additional_deductions) || 0,
    });
    setIsEditing(false);
  };

  // Check for changes
  const originalBase = Number(line.gross_salary) - existingOvertimeAmount - existingDoubleAmount;
  
  const hasChanges = values.baseSalary !== originalBase || 
                     values.horasExtra !== (Number(line.overtime_hours) || 0) ||
                     values.horasDobles !== (Number(line.mixed_overtime_hours) || 0) ||
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

        {/* Salary Breakdown */}
        <div className="space-y-3">
          {/* Currency indicator for Horizonte Positivo */}
          {isUSD && (
            <div className="flex items-center justify-end">
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                💵 Montos en USD
              </Badge>
            </div>
          )}
          
          {/* Base Salary - Editable */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">Salario Base</Badge>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{currencySymbol}</span>
                <Input
                  type="text"
                  value={isUSD && exchangeRate > 0 
                    ? Math.round(values.baseSalary / exchangeRate).toLocaleString('en-US')
                    : values.baseSalary.toLocaleString('es-CR')
                  }
                  onChange={(e) => {
                    const rawValue = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                    // If USD, convert back to CRC for storage
                    const crcValue = isUSD && exchangeRate > 0 ? rawValue * exchangeRate : rawValue;
                    handleBaseSalaryChange(crcValue.toString());
                  }}
                  className="h-8 w-32 text-right font-mono text-base"
                />
              </div>
            ) : (
              <span className="font-mono text-base font-medium text-foreground tabular-nums">
                {formatAmount(values.baseSalary)}
              </span>
            )}
          </div>

          {/* Horas Extra 1.5× - Editable Field */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-success/10 border border-success/30' : 'bg-success/5'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-success border-success/30 bg-success/10">
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
                <span className="font-mono text-sm text-success">= {formatAmount(overtimeAmount)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {values.horasExtra > 0 && (
                  <span className="text-xs text-muted-foreground">{values.horasExtra} hrs =</span>
                )}
                <span className="font-mono text-base font-medium text-success tabular-nums">
                  +{formatAmount(overtimeAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Horas Dobles 2× - Editable Field for holidays/night work */}
          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isEditing ? 'bg-blue-50 border border-blue-200' : 'bg-blue-50/50'}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-blue-700 border-blue-300 bg-blue-100">
                + Hrs Dobles (2×)
              </Badge>
            </div>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={values.horasDobles}
                    onChange={(e) => handleHorasDoblesChange(e.target.value)}
                    className="h-8 w-16 text-right font-mono text-sm"
                    min="0"
                    step="0.5"
                  />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
                <span className="font-mono text-sm text-blue-700">= {formatAmount(doubleHoursAmount)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {values.horasDobles > 0 && (
                  <span className="text-xs text-muted-foreground">{values.horasDobles} hrs =</span>
                )}
                <span className="font-mono text-base font-medium text-blue-700 tabular-nums">
                  +{formatAmount(doubleHoursAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Gross Salary Total */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border-2 border-dashed">
            <Badge variant="secondary" className="text-xs font-normal">{t('payroll.gross')}</Badge>
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">
              {formatAmount(grossSalary)}
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
                <span className="text-muted-foreground">{currencySymbol}</span>
                <Input
                  type="text"
                  value={isUSD && exchangeRate > 0 
                    ? Math.round(values.adelanto / exchangeRate).toLocaleString('en-US')
                    : values.adelanto.toLocaleString('es-CR')
                  }
                  onChange={(e) => {
                    const rawValue = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                    const crcValue = isUSD && exchangeRate > 0 ? rawValue * exchangeRate : rawValue;
                    handleAdelantoChange(crcValue.toString());
                  }}
                  className="h-8 w-32 text-right font-mono text-base"
                  placeholder="0"
                />
              </div>
            ) : (
              <span className="font-mono text-base font-medium text-amber-700 tabular-nums">
                -{formatAmount(values.adelanto)}
              </span>
            )}
          </div>

          {/* Deductions Breakdown with ISR Tramos */}
          <div className="bg-destructive/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">CCSS (10.83%)</span>
              <span className="font-mono text-destructive">-{formatAmount(calculations.ccss)}</span>
            </div>
            
            {/* ISR Breakdown by Brackets */}
            {calculations.isr > 0 && (
              <div className="space-y-1 pl-2 border-l-2 border-destructive/20">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Impuesto sobre la Renta:</span>
                  <span className="font-mono text-destructive">-{formatAmount(calculations.isr)}</span>
                </div>
                {calculations.isrBreakdown.isr_10 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground pl-2">└ Tramo 10% (₡918K-₡1.35M)</span>
                    <span className="font-mono text-destructive/80">-{formatCRC(calculations.isrBreakdown.isr_10)}</span>
                  </div>
                )}
                {calculations.isrBreakdown.isr_15 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground pl-2">└ Tramo 15% (₡1.35M-₡2.36M)</span>
                    <span className="font-mono text-destructive/80">-{formatCRC(calculations.isrBreakdown.isr_15)}</span>
                  </div>
                )}
                {calculations.isrBreakdown.isr_20 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground pl-2">└ Tramo 20% (₡2.36M-₡4.73M)</span>
                    <span className="font-mono text-destructive/80">-{formatCRC(calculations.isrBreakdown.isr_20)}</span>
                  </div>
                )}
                {calculations.isrBreakdown.isr_25 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground pl-2">└ Tramo 25% (&gt;₡4.73M)</span>
                    <span className="font-mono text-destructive/80">-{formatCRC(calculations.isrBreakdown.isr_25)}</span>
                  </div>
                )}
              </div>
            )}
            
            {calculations.otros > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Otros (Préstamos)</span>
                <span className="font-mono text-destructive">-{formatAmount(calculations.otros)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
              <Badge variant="outline" className="text-xs font-normal text-destructive border-destructive/20">
                Total Deducciones
              </Badge>
              <span className="font-mono text-base font-medium text-destructive tabular-nums">
                -{formatAmount(calculations.totalDeductions)}
              </span>
            </div>
          </div>

          {/* Net Pay */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border">
            <Badge variant="secondary" className="text-xs font-normal">Total a Recibir</Badge>
            <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
              {formatAmount(calculations.netPay)}
            </span>
          </div>

          {/* Adelanto Recibido Display */}
          {values.adelanto > 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-amber-100 rounded-lg border border-amber-300">
              <Badge variant="outline" className="text-xs font-normal text-amber-800 border-amber-400 bg-amber-200">
                (-) Adelanto Recibido
              </Badge>
              <span className="font-mono text-base font-medium text-amber-800 tabular-nums">
                -{formatAmount(values.adelanto)}
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
                {formatAmount(calculations.faltaPorPagar)}
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
        .in("status", ["aprobado", "calculado", "enviado"])
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

  // Detect if company is Horizonte Positivo (uses USD)
  const isUSD = useMemo(() => {
    return isHorizontePositivo(selectedCompany?.name);
  }, [selectedCompany?.name]);

  // Get exchange rate from first payroll line or default
  const exchangeRate = useMemo(() => {
    if (!payrollLines || payrollLines.length === 0) return 505.10; // Default Jan 2026 rate
    const firstLineWithRate = payrollLines.find(line => line.exchange_rate_to_base && line.exchange_rate_to_base > 0);
    return firstLineWithRate?.exchange_rate_to_base || 505.10;
  }, [payrollLines]);

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
    overtimeAmount: number,
    doubleHours: number,
    doubleAmount: number
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
          mixed_overtime_hours: doubleHours,
          mixed_overtime_amount: doubleAmount,
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

    if (currentBatch?.status !== 'aprobado') {
      toast({
        title: "Planilla no aprobada",
        description: "El lote debe estar en estado 'Aprobado' para generar colillas.",
        variant: "destructive",
      });
      return;
    }

    // Redirect to /payslips where generation is triggered
    window.location.href = '/payslips';
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
          <div className="hidden lg:block">
            <ACLLogo variant="compact" size={26} />
          </div>
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
                isUSD={isUSD}
                exchangeRate={exchangeRate}
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
