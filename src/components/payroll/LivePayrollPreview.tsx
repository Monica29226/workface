import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { TrendingDown, TrendingUp, Calculator } from "lucide-react";

interface CompanyParams {
  ccss_obrero_total?: number;
  is_education_sector?: boolean;
  magisterio_rate?: number;
  poliza_vida_fija?: number;
  renta_bracket_1_limit?: number;
  renta_bracket_1_rate?: number;
  renta_bracket_2_limit?: number;
  renta_bracket_2_rate?: number;
  renta_bracket_3_limit?: number;
  renta_bracket_3_rate?: number;
  renta_bracket_4_limit?: number;
  renta_bracket_4_rate?: number;
  renta_bracket_5_rate?: number;
}

interface DeductionsDetail {
  ccss_obrero?: number;
  isr_neto?: number;
  banco_popular?: number;
  loan_deduction?: number;
  magisterio?: number;
  poliza_vida?: number;
}

interface LivePayrollPreviewProps {
  currentGross: number;
  newGross: number;
  exchangeRate: number;
  companyParams: CompanyParams | null;
  currency: string;
  currentDeductions: DeductionsDetail | null;
  loanDeduction?: number;
  additionalDeductions?: number;
  payrollType?: string;
  isVisible: boolean;
}

// 2026 Costa Rica ISR brackets
const ISR_BRACKETS_2026 = [
  { limit: 918000, rate: 0 },
  { limit: 1347000, rate: 0.10 },
  { limit: 2364000, rate: 0.15 },
  { limit: 4727000, rate: 0.20 },
  { limit: Infinity, rate: 0.25 },
];

function calculateISR(baseImponible: number): number {
  let isr = 0;
  let remaining = baseImponible;
  let prevLimit = 0;

  for (const bracket of ISR_BRACKETS_2026) {
    if (remaining <= 0) break;
    
    const taxableInBracket = Math.min(remaining, bracket.limit - prevLimit);
    if (taxableInBracket > 0) {
      isr += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
    }
    prevLimit = bracket.limit;
  }

  return Math.max(0, isr);
}

export function LivePayrollPreview({
  currentGross,
  newGross,
  exchangeRate,
  companyParams,
  currency,
  currentDeductions,
  loanDeduction = 0,
  additionalDeductions = 0,
  payrollType,
  isVisible,
}: LivePayrollPreviewProps) {
  const preview = useMemo(() => {
    if (!companyParams || newGross === currentGross) {
      return null;
    }

    // Determine if salary is in USD (convert to CRC) or already CRC
    const isCRC = currency === 'CRC';
    const baseImponibleCRC = isCRC ? newGross : newGross * exchangeRate;
    
    // Calculate CCSS
    const isEducation = companyParams.is_education_sector;
    const ccssRate = isEducation ? 0.067 : (companyParams.ccss_obrero_total || 10.83) / 100;
    const ccssObrero = baseImponibleCRC * ccssRate;

    // Banco Popular (1% standard)
    const bancoPopular = baseImponibleCRC * 0.01;

    // Magisterio for education sector
    const magisterio = isEducation ? baseImponibleCRC * (companyParams.magisterio_rate || 8.5) / 100 : 0;

    // Fixed life insurance for education sector
    const polizaVida = isEducation ? (companyParams.poliza_vida_fija || 0) : 0;

    // ISR calculation
    const isrNeto = calculateISR(baseImponibleCRC);

    // Apply 50% split for biweekly
    const isBiweekly = payrollType === 'adelanto' || payrollType === 'segunda';
    const multiplier = isBiweekly ? 0.5 : 1;

    const totalDeductions = 
      (ccssObrero * multiplier) + 
      (bancoPopular * multiplier) + 
      (magisterio * multiplier) + 
      ((polizaVida / 2) * (isBiweekly ? 1 : 2)) + // Póliza splits differently
      (isrNeto * multiplier) + 
      (loanDeduction * multiplier) +
      additionalDeductions;

    const netPay = baseImponibleCRC - totalDeductions;

    // Calculate difference from current
    const currentNetPay = currentDeductions 
      ? baseImponibleCRC - (
          (currentDeductions.ccss_obrero || 0) +
          (currentDeductions.isr_neto || 0) +
          (currentDeductions.banco_popular || 0) +
          (currentDeductions.loan_deduction || 0) +
          (currentDeductions.magisterio || 0) +
          (currentDeductions.poliza_vida || 0) +
          additionalDeductions
        )
      : 0;

    return {
      baseImponibleCRC,
      ccssObrero: ccssObrero * multiplier,
      bancoPopular: bancoPopular * multiplier,
      magisterio: magisterio * multiplier,
      isrNeto: isrNeto * multiplier,
      totalDeductions,
      netPay,
      netPayUSD: isCRC ? netPay / exchangeRate : netPay / exchangeRate,
      grossDiff: newGross - currentGross,
      isIncrease: newGross > currentGross,
    };
  }, [newGross, currentGross, exchangeRate, companyParams, currency, currentDeductions, loanDeduction, additionalDeductions, payrollType]);

  if (!isVisible || !preview) {
    return null;
  }

  return (
    <div className="absolute left-full ml-2 top-0 z-50 w-64 bg-card border rounded-lg shadow-lg p-3 text-xs animate-in slide-in-from-left-2 duration-200">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b">
        <Calculator className="h-4 w-4 text-primary" />
        <span className="font-semibold">Vista Previa</span>
        {preview.isIncrease ? (
          <TrendingUp className="h-3 w-3 text-success ml-auto" />
        ) : (
          <TrendingDown className="h-3 w-3 text-destructive ml-auto" />
        )}
      </div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Imponible:</span>
          <span className="font-mono">₡{formatNumber(preview.baseImponibleCRC)}</span>
        </div>
        
        <div className="pt-1 border-t border-dashed">
          <div className="text-muted-foreground mb-1">Deducciones estimadas:</div>
        <div className="flex justify-between text-destructive">
          <span>CCSS:</span>
          <span className="font-mono">₡{formatNumber(preview.ccssObrero)}</span>
        </div>
        <div className="flex justify-between text-destructive">
          <span>B. Popular:</span>
          <span className="font-mono">₡{formatNumber(preview.bancoPopular)}</span>
        </div>
        {preview.magisterio > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Magisterio:</span>
            <span className="font-mono">₡{formatNumber(preview.magisterio)}</span>
          </div>
        )}
        <div className="flex justify-between text-destructive">
          <span>ISR:</span>
          <span className="font-mono">₡{formatNumber(preview.isrNeto)}</span>
        </div>
        <div className="flex justify-between font-semibold text-destructive pt-1 border-t">
          <span>Total Ded.:</span>
          <span className="font-mono">₡{formatNumber(preview.totalDeductions)}</span>
        </div>
      </div>
      
      <div className="pt-2 border-t">
        <div className="flex justify-between font-semibold text-success">
          <span>Neto Estimado:</span>
          <span className="font-mono">₡{formatNumber(preview.netPay)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>≈ USD:</span>
          <span className="font-mono">${preview.netPayUSD.toFixed(2)}</span>
        </div>
      </div>
    </div>
      
      <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground italic">
        * Valores estimados. Guarde para confirmar.
      </div>
    </div>
  );
}
