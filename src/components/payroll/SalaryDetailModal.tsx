import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Download, Building2, Calendar, DollarSign, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DeductionItem {
  code: string;
  label: string;
  type: 'percentage' | 'fixed' | 'calculated';
  rate?: number;
  amount: number;
}

interface DeductionsDetail {
  items: DeductionItem[];
  total_deductions: number;
}

interface ManualAdjustments {
  original_currency?: string;
  original_salary?: number;
  exchange_rate_applied?: number;
  [key: string]: any;
}

interface PayrollLineData {
  id: string;
  gross_salary: number;
  deductions: number;
  deductions_detail?: DeductionsDetail;
  net_pay: number;
  total_to_pay?: number;
  currency: string;
  period_label?: string;
  additional_bonuses?: number;
  project_hours_amount?: number;
  exchange_rate_to_base?: number;
  manual_adjustments?: ManualAdjustments;
}

interface CompanyData {
  id: string;
  display_name: string;
  logo_url?: string | null;
  tax_id?: string | null;
}

interface SalaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollLine: PayrollLineData | null;
  company: CompanyData | null;
  periodLabel: string;
  onDownloadPDF?: () => void;
  isDownloading?: boolean;
}

export function SalaryDetailModal({
  isOpen,
  onClose,
  payrollLine,
  company,
  periodLabel,
  onDownloadPDF,
  isDownloading = false
}: SalaryDetailModalProps) {
  if (!payrollLine) return null;

  const currency = payrollLine.currency || 'CRC';
  const deductionsDetail = payrollLine.deductions_detail as DeductionsDetail | undefined;
  const deductionItems = deductionsDetail?.items || [];
  const totalDeductions = deductionsDetail?.total_deductions || payrollLine.deductions || 0;
  const totalToPay = payrollLine.total_to_pay || payrollLine.net_pay;

  // Exchange rate information for USD salaries
  const manualAdjustments = payrollLine.manual_adjustments as ManualAdjustments | undefined;
  const exchangeRate = payrollLine.exchange_rate_to_base || manualAdjustments?.exchange_rate_applied;
  const originalCurrency = manualAdjustments?.original_currency;
  const originalSalary = manualAdjustments?.original_salary;
  const showExchangeRate = originalCurrency === 'USD' && exchangeRate && exchangeRate > 1;

  // Format percentage for display
  const formatPercentage = (rate?: number) => {
    if (!rate) return '';
    return `${(rate * 100).toFixed(1)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          {/* Company Header with Logo */}
          <div className="flex items-center gap-4">
            {company?.logo_url ? (
              <img 
                src={company.logo_url} 
                alt={company.display_name}
                className="h-12 w-12 object-contain rounded-lg border bg-white p-1"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <DialogTitle className="text-lg font-semibold">
                {company?.display_name || 'Detalle de mi Salario'}
              </DialogTitle>
              {company?.tax_id && (
                <p className="text-sm text-muted-foreground">
                  Cédula: {company.tax_id}
                </p>
              )}
            </div>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Período: {periodLabel}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Exchange Rate Banner for USD Salaries */}
          {showExchangeRate && (
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300">Salario Original:</span>
                    <span className="font-semibold text-blue-800 dark:text-blue-200">
                      ${originalSalary?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                    TC: ₡{exchangeRate?.toFixed(2)}
                  </Badge>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Tipo de cambio BCCR (venta) aplicado a la fecha del período
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Salario Bruto {showExchangeRate ? '(CRC)' : ''}</span>
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(payrollLine.gross_salary, 'CRC')}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Minus className="h-4 w-4 text-destructive" />
                  <span>Total Deducciones</span>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(totalDeductions, 'CRC')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Net Pay Highlight */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-medium">Total a Recibir</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(totalToPay, currency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Deductions Breakdown Table */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Minus className="h-4 w-4" />
              Desglose de Deducciones
            </h4>
            
            {deductionItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-center">Porcentaje</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductionItems.map((item, index) => (
                    <TableRow key={`${item.code}-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs font-mono"
                          >
                            {item.code}
                          </Badge>
                          <span className="text-sm">{item.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.type === 'percentage' && item.rate 
                          ? formatPercentage(item.rate) 
                          : item.type === 'fixed' 
                            ? 'Fijo' 
                            : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        -{formatCurrency(item.amount, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Total Row */}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={2}>Total Deducciones</TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      -{formatCurrency(totalDeductions, currency)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay detalles de deducciones disponibles para este período.
              </p>
            )}
          </div>

          {/* Income Breakdown (if bonuses exist) */}
          {(payrollLine.additional_bonuses || payrollLine.project_hours_amount) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Desglose de Ingresos
                </h4>
                <Table>
                  <TableBody>
                    {payrollLine.additional_bonuses && payrollLine.additional_bonuses > 0 && (
                      <TableRow>
                        <TableCell>Bonificaciones</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          +{formatCurrency(payrollLine.additional_bonuses, currency)}
                        </TableCell>
                      </TableRow>
                    )}
                    {payrollLine.project_hours_amount && payrollLine.project_hours_amount > 0 && (
                      <TableRow>
                        <TableCell>Horas de Proyecto</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          +{formatCurrency(payrollLine.project_hours_amount, currency)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <Separator />

          {/* Download Button */}
          <div className="flex justify-end pt-2">
            <Button 
              onClick={onDownloadPDF}
              disabled={isDownloading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Generando...' : 'Descargar Comprobante PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
