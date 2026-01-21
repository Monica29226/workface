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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Salario Bruto</span>
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(payrollLine.gross_salary, currency)}
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
                  {formatCurrency(totalDeductions, currency)}
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
