import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Eye, Search, FileText, Download, Send, ArrowDown, Minus, Building2, User } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import logoACL from "@/assets/logotipo_acl.png";

// Format CRC without decimals
const formatCRC = (amount: number): string => {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
};

// Format USD without decimals
const formatUSD = (amount: number): string => {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
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

// Employee Card Component
function EmployeePayrollCard({ 
  line, 
  exchangeRate,
  onViewDetail,
  t
}: { 
  line: PayrollLine;
  exchangeRate: number;
  onViewDetail: () => void;
  t: (key: string) => string;
}) {
  const grossCRC = line.currency === 'USD' 
    ? Number(line.gross_salary) * exchangeRate 
    : Number(line.gross_salary);
  
  const grossUSD = grossCRC / exchangeRate;
  const netUSD = Number(line.net_pay) / exchangeRate;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
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
          {line.cost_center && (
            <Badge variant="outline" className="text-xs gap-1">
              <Building2 className="h-3 w-3" />
              {line.cost_center.code}
            </Badge>
          )}
        </div>

        {/* Salary Breakdown with dual currency */}
        <div className="space-y-3">
          {/* Gross Salary */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">{t('payroll.gross')}</Badge>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-medium text-foreground tabular-nums block">
                {formatCRC(grossCRC)}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {formatUSD(grossUSD)}
              </span>
            </div>
          </div>

          {/* Deductions */}
          <div className="flex items-center justify-between py-2 px-3 bg-destructive/5 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-destructive border-destructive/20">
                <Minus className="h-3 w-3 mr-1" />
                {t('payroll.deductions')}
              </Badge>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-medium text-destructive tabular-nums block">
                -{formatCRC(Number(line.deductions))}
              </span>
            </div>
          </div>

          {/* Net Pay - Highlighted with dual currency */}
          <div className="bg-primary rounded-lg p-3">
            <div className="flex items-center justify-between">
              <Badge className="text-xs font-normal bg-white/20 text-white hover:bg-white/20">{t('payroll.net')}</Badge>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-white tabular-nums block">
                  {formatCRC(Number(line.net_pay))}
                </span>
                <span className="font-mono text-sm text-white/80 tabular-nums">
                  {formatUSD(netUSD)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-3 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2 hover:bg-primary/5"
            onClick={onViewDetail}
          >
            <Eye className="h-4 w-4" />
            {t('common.view_detail')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Detail Modal Component - Unified with Histórico view (CRC/USD dual display)
function PayrollDetailModal({
  isOpen,
  onClose,
  line,
  exchangeRate,
  companyName,
  periodLabel,
  onDownloadPDF,
  isDownloading,
  t
}: {
  isOpen: boolean;
  onClose: () => void;
  line: PayrollLine | null;
  exchangeRate: number;
  companyName: string;
  periodLabel: string;
  onDownloadPDF: () => void;
  isDownloading: boolean;
  t: (key: string) => string;
}) {
  if (!line) return null;

  const detail = line.deductions_detail || {};
  const grossCRC = line.currency === 'USD' 
    ? Number(line.gross_salary) * exchangeRate 
    : Number(line.gross_salary);
  
  // USD conversions
  const grossUSD = grossCRC / exchangeRate;
  const deductionsUSD = Number(line.deductions) / exchangeRate;
  const netUSD = Number(line.net_pay) / exchangeRate;

  // Build deductions list from detail with translations
  const deductionItems = detail.items || [
    { code: 'ccss', label: t('deduction.ccss'), amount: detail.ccss_obrero || 0 },
    ...(detail.isr_neto && detail.isr_neto > 0 ? [{ code: 'isr', label: t('deduction.isr'), amount: detail.isr_neto }] : []),
    ...(detail.magisterio && detail.magisterio > 0 ? [{ code: 'mag', label: t('deduction.magisterio'), amount: detail.magisterio }] : []),
    ...(detail.poliza_vida && detail.poliza_vida > 0 ? [{ code: 'pol', label: t('deduction.poliza'), amount: detail.poliza_vida }] : []),
    ...(detail.loan_deduction && detail.loan_deduction > 0 ? [{ code: 'loan', label: t('deduction.loans'), amount: detail.loan_deduction }] : []),
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
          {/* Summary Cards - CRC with USD below */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>+ {t('payroll.gross_salary')}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatCRC(grossCRC)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>− {t('payroll.total_deductions')}</span>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatCRC(Number(line.deductions))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Net Pay Highlight - CRC primary, USD secondary */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('payroll.total_to_receive')}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {formatCRC(Number(line.net_pay))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatUSD(netUSD)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exchange Rate Info */}
          <Card className="bg-accent/30 border-accent">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-accent-foreground">{t('payroll.exchange_rate_bccr')}:</span>
                <Badge variant="outline" className="bg-accent text-accent-foreground border-accent">
                  {formatCRC(exchangeRate)} / $1 USD
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Deductions Breakdown */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              − {t('payroll.deductions_breakdown')}
            </h4>
            
            {deductionItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">{t('payroll.concept')}</th>
                      <th className="text-right p-3 font-medium">CRC</th>
                      <th className="text-right p-3 font-medium">USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductionItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.label}</td>
                        <td className="p-3 text-right font-mono text-destructive">
                          -{formatCRC(item.amount)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          -{formatUSD(item.amount / exchangeRate)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="p-3">{t('payroll.total')}</td>
                      <td className="p-3 text-right font-mono text-destructive">
                        -{formatCRC(Number(line.deductions))}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        -{formatUSD(deductionsUSD)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('precolilla.no_deductions')}
              </p>
            )}
          </div>

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
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollLine | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Fetch company parameters
  const { data: companyParams } = useQuery({
    queryKey: ["companyParamsPreColilla", selectedCompany?.id],
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
  const exchangeRate = payrollLines?.[0]?.exchange_rate_to_base || 505.10;

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

  // Summary totals
  const totals = useMemo(() => {
    if (!payrollLines) return { gross: 0, deductions: 0, net: 0 };
    return payrollLines.reduce((acc, line) => {
      const grossCRC = line.currency === 'USD' 
        ? Number(line.gross_salary) * exchangeRate 
        : Number(line.gross_salary);
      return {
        gross: acc.gross + grossCRC,
        deductions: acc.deductions + Number(line.deductions),
        net: acc.net + Number(line.net_pay),
      };
    }, { gross: 0, deductions: 0, net: 0 });
  }, [payrollLines, exchangeRate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={logoACL} alt="ACL" className="h-10 w-auto hidden lg:block" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('precolilla.title')}</h1>
            <p className="text-muted-foreground">
              {t('precolilla.description')}
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

      {/* Batch Info Bar */}
      {currentBatch && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {getStatusBadge(currentBatch.status)}
              {currentBatch.payroll_type && getPayrollTypeBadge(currentBatch.payroll_type)}
              <Badge variant="outline" className="gap-1">
                T.C. ₡{exchangeRate.toFixed(2)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {payrollLines?.length || 0} {t('common.collaborators')}
              </span>
              
              {/* Summary Totals */}
              <div className="ml-auto flex flex-wrap gap-4 text-sm">
                <div className="text-muted-foreground">
                  {t('payroll.gross')}: <span className="font-mono font-medium text-foreground">₡{formatNumber(totals.gross)}</span>
                </div>
                <div className="text-muted-foreground">
                  {t('payroll.deductions')}: <span className="font-mono font-medium text-orange-600">–₡{formatNumber(totals.deductions)}</span>
                </div>
                <div className="text-muted-foreground">
                  {t('payroll.net')}: <span className="font-mono font-bold text-green-600">₡{formatNumber(totals.net)}</span>
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
              <EmployeePayrollCard
                key={line.id}
                line={line}
                exchangeRate={exchangeRate}
                onViewDetail={() => handleViewDetail(line)}
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
        exchangeRate={exchangeRate}
        companyName={selectedCompany?.name || ''}
        periodLabel={currentBatch ? formatPeriod(currentBatch.period_start, currentBatch.period_end) : ''}
        onDownloadPDF={handleDownloadPDF}
        isDownloading={isDownloading}
        t={t}
      />
    </div>
  );
}
