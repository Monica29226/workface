import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
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
  onViewDetail 
}: { 
  line: PayrollLine;
  exchangeRate: number;
  onViewDetail: () => void;
}) {
  const grossCRC = line.currency === 'USD' 
    ? Number(line.gross_salary) * exchangeRate 
    : Number(line.gross_salary);

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

        {/* Salary Breakdown */}
        <div className="space-y-3">
          {/* Gross Salary */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">Bruto</Badge>
              <span className="text-sm text-muted-foreground">Salario Bruto</span>
            </div>
            <span className="font-mono text-base font-medium text-foreground">
              ₡{formatNumber(grossCRC)}
            </span>
          </div>

          {/* Deductions */}
          <div className="flex items-center justify-between py-2 px-3 bg-destructive/5 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal text-orange-600 border-orange-200 bg-orange-50">
                <Minus className="h-3 w-3 mr-1" />
                Deduc.
              </Badge>
              <span className="text-sm text-muted-foreground">Deducciones</span>
            </div>
            <span className="font-mono text-base font-medium text-orange-600">
              –₡{formatNumber(Number(line.deductions))}
            </span>
          </div>

          {/* Net Pay - Highlighted */}
          <div className="flex items-center justify-between py-3 px-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Badge className="text-xs font-normal bg-green-600 hover:bg-green-600">Neto</Badge>
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Salario Neto</span>
            </div>
            <span className="font-mono text-xl font-bold text-green-700 dark:text-green-400">
              ₡{formatNumber(Number(line.net_pay))}
            </span>
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
            Ver Detalle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Detail Modal Component
function PayrollDetailModal({
  isOpen,
  onClose,
  line,
  exchangeRate,
  companyName,
  periodLabel,
  onDownloadPDF,
  isDownloading
}: {
  isOpen: boolean;
  onClose: () => void;
  line: PayrollLine | null;
  exchangeRate: number;
  companyName: string;
  periodLabel: string;
  onDownloadPDF: () => void;
  isDownloading: boolean;
}) {
  if (!line) return null;

  const detail = line.deductions_detail || {};
  const grossCRC = line.currency === 'USD' 
    ? Number(line.gross_salary) * exchangeRate 
    : Number(line.gross_salary);

  // Build deductions list from detail
  const deductionItems = detail.items || [
    { code: 'ccss', label: 'CCSS Obrero', amount: detail.ccss_obrero || 0 },
    ...(detail.isr_neto && detail.isr_neto > 0 ? [{ code: 'isr', label: 'Impuesto sobre la Renta', amount: detail.isr_neto }] : []),
    ...(detail.magisterio && detail.magisterio > 0 ? [{ code: 'mag', label: 'Magisterio Nacional', amount: detail.magisterio }] : []),
    ...(detail.poliza_vida && detail.poliza_vida > 0 ? [{ code: 'pol', label: 'Póliza de Vida', amount: detail.poliza_vida }] : []),
    ...(detail.loan_deduction && detail.loan_deduction > 0 ? [{ code: 'loan', label: 'Préstamos', amount: detail.loan_deduction }] : []),
  ].filter(item => item.amount > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <img src={logoACL} alt="ACL" className="h-8 w-auto" />
            <div>
              <DialogTitle className="text-lg">Detalle de Colilla</DialogTitle>
              <p className="text-sm text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Employee Header */}
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{line.employee.full_name}</h3>
                <p className="text-sm text-muted-foreground">{line.employee.employee_id}</p>
                {line.cost_center && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Centro de Costo: {line.cost_center.name}
                  </p>
                )}
              </div>
            </div>

            {/* USD Banner if applicable */}
            {line.currency === 'USD' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700 dark:text-blue-400">Salario Original (USD):</span>
                  <span className="font-mono font-semibold text-blue-800 dark:text-blue-300">
                    ${formatNumber(Number(line.gross_salary))}
                  </span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  T.C. BCCR: ₡{exchangeRate.toFixed(2)} / $1 USD
                </p>
              </div>
            )}

            {/* Gross Salary */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Ingresos
              </h4>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span>Salario Bruto</span>
                  <span className="font-mono text-lg font-semibold">₡{formatNumber(grossCRC)}</span>
                </div>
                {Number(line.additional_bonuses) > 0 && (
                  <div className="flex justify-between items-center mt-2 text-green-600">
                    <span>Bonificaciones</span>
                    <span className="font-mono">+₡{formatNumber(Number(line.additional_bonuses))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-orange-500" />
                Deducciones
              </h4>
              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-4 space-y-2">
                {deductionItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-orange-600">–₡{formatNumber(item.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-orange-200 dark:border-orange-800 font-medium">
                  <span>Total Deducciones</span>
                  <span className="font-mono text-orange-700">–₡{formatNumber(Number(line.deductions))}</span>
                </div>
              </div>
            </div>

            {/* Net Pay - Highlighted */}
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-5 text-center border-2 border-green-300 dark:border-green-700">
              <p className="text-sm text-green-700 dark:text-green-400 mb-1 font-medium uppercase tracking-wide">
                Salario Neto a Depositar
              </p>
              <p className="font-mono text-3xl font-bold text-green-700 dark:text-green-400">
                ₡{formatNumber(Number(line.net_pay))}
              </p>
            </div>

            {/* Accruals */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Provisiones Acumuladas
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Vacaciones</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {Number(line.vacation_accrued_days).toFixed(2)} días
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Aguinaldo</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    ₡{formatNumber(Number(line.aguinaldo_accrued))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="pt-4 border-t flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            ACL Workforce HUB
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button 
              size="sm" 
              className="gap-2"
              onClick={onDownloadPDF}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PreColilla() {
  const { selectedCompany } = useCompany();
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
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      calculado: { label: "Calculado", variant: "secondary" },
      aprobado: { label: "Aprobado", variant: "default" },
      autorizado: { label: "Autorizado", variant: "outline" },
      enviado: { label: "Enviado", variant: "outline" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPayrollTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; className: string }> = {
      adelanto: { label: "1ª Quincena", className: "bg-amber-100 text-amber-800 border-amber-200" },
      segunda: { label: "2ª Quincena", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
      completa: { label: "Mensual", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    };
    const config = typeConfig[type] || { label: type, className: "" };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
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
            <h1 className="text-2xl font-bold text-foreground">Pre-Colilla</h1>
            <p className="text-muted-foreground">
              Revise y valide las colillas antes del envío
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select
            value={selectedBatchId || ""}
            onValueChange={setSelectedBatchId}
          >
            <SelectTrigger className="w-full sm:w-[320px]">
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
                    {formatPeriod(batch.period_start, batch.period_end)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {currentBatch?.status === 'autorizado' && (
            <Button onClick={handleApproveAndSend} className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              <Send className="h-4 w-4" />
              Enviar Colillas
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
                {payrollLines?.length || 0} colaboradores
              </span>
              
              {/* Summary Totals */}
              <div className="ml-auto flex flex-wrap gap-4 text-sm">
                <div className="text-muted-foreground">
                  Bruto: <span className="font-mono font-medium text-foreground">₡{formatNumber(totals.gross)}</span>
                </div>
                <div className="text-muted-foreground">
                  Deduc: <span className="font-mono font-medium text-orange-600">–₡{formatNumber(totals.deductions)}</span>
                </div>
                <div className="text-muted-foreground">
                  Neto: <span className="font-mono font-bold text-green-600">₡{formatNumber(totals.net)}</span>
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
            <p className="text-lg font-medium mb-1">Seleccione un período</p>
            <p className="text-sm">Elija un período de planilla para revisar las colillas</p>
          </CardContent>
        </Card>
      ) : linesLoading ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Cargando datos de planilla...</p>
          </CardContent>
        </Card>
      ) : !payrollLines || payrollLines.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay datos para este período</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador por nombre o código..."
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
              />
            ))}
          </div>

          {filteredLines.length === 0 && searchTerm && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>No se encontraron colaboradores que coincidan con "{searchTerm}"</p>
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
      />
    </div>
  );
}
