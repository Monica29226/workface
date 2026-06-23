import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { TrendingDown, TrendingUp, Calculator } from "lucide-react";
import { calculatePayrollDeductions, type PayrollCompanyParams } from "@/lib/payrollDeductions";

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
  companyParams: PayrollCompanyParams | null;
  currency: string;
  currentDeductions: DeductionsDetail | null;
  loanDeduction?: number;
  additionalDeductions?: number;
  taxCredit?: number;
  payrollType?: string;
  isVisible: boolean;
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
  taxCredit = 0,
  payrollType,
  isVisible,
}: LivePayrollPreviewProps) {
  const preview = useMemo(() => {
    if (!companyParams || newGross === currentGross) {
      return null;
    }

    const isCRC = currency === 'CRC';
    const baseImponibleCRC = isCRC ? newGross : newGross * exchangeRate;

    const calc = calculatePayrollDeductions({
      grossSalary: baseImponibleCRC,
      params: companyParams,
      loanDeduction,
      additionalDeductions: 0,
      taxCredit,
    });

    const isBiweekly = payrollType === 'adelanto' || payrollType === 'segunda';
    const m = isBiweekly ? 0.5 : 1;

    const ccssObrero = calc.ccssObrero * m;
    const magisterio = calc.magisterio * m;
    const polizaVida = calc.polizaVida;
    const isr = calc.isr * m;
    const loan = loanDeduction * m;

    const totalDeductions = ccssObrero + magisterio + polizaVida + isr + loan + additionalDeductions;
    const netPay = baseImponibleCRC - totalDeductions;

    return {
      baseImponibleCRC,
      ccssObrero,
      ccssLabel: calc.ccssLabel,
      magisterio,
      polizaVida,
      isrNeto: isr,
      isrBruto: calc.isrBreakdown.isr_bruto * m,
      isrCredito: calc.isrBreakdown.isr_credito * m,
      totalDeductions,
      netPay,
      netPayUSD: exchangeRate > 0 ? netPay / exchangeRate : 0,
      grossDiff: newGross - currentGross,
      isIncrease: newGross > currentGross,
    };
  }, [newGross, currentGross, exchangeRate, companyParams, currency, currentDeductions, loanDeduction, additionalDeductions, taxCredit, payrollType]);


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
            <span>{preview.ccssLabel}:</span>
            <span className="font-mono">₡{formatNumber(preview.ccssObrero)}</span>
          </div>
          {preview.magisterio > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Magisterio:</span>
              <span className="font-mono">₡{formatNumber(preview.magisterio)}</span>
            </div>
          )}
          {preview.polizaVida > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Póliza Vida:</span>
              <span className="font-mono">₡{formatNumber(preview.polizaVida)}</span>
            </div>
          )}
          <div className="flex justify-between text-destructive">
            <span>ISR{preview.isrCredito > 0 ? ' (neto)' : ''}:</span>
            <span className="font-mono">₡{formatNumber(preview.isrNeto)}</span>
          </div>
          {preview.isrCredito > 0 && (
            <div className="flex justify-between text-[10px] text-muted-foreground pl-2">
              <span>(ISR bruto ₡{formatNumber(preview.isrBruto)} − crédito ₡{formatNumber(preview.isrCredito)})</span>
            </div>
          )}

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
