import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Eye, Search, CheckCircle, FileText, Download, Send } from "lucide-react";
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
  magisterio?: number;
  poliza_vida?: number;
  loan_deduction?: number;
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

export function PreColilla() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollLine | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Fetch payroll batches (only authorized ones for pre-colilla review)
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
  const isEducationSector = companyParams?.is_education_sector || false;

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

  const handleViewPreColilla = (line: PayrollLine) => {
    setSelectedEmployee(line);
    setIsPdfModalOpen(true);
  };

  const handleApproveAndSend = async () => {
    if (!selectedBatchId) return;

    const currentStatus = currentBatch?.status;
    
    if (currentStatus !== 'autorizado') {
      toast({
        title: "Batch no autorizado",
        description: "El batch debe estar en estado 'Autorizado' para enviar colillas. Flujo: Calculado → Aprobado → Autorizado → Enviado",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Funcionalidad pendiente",
      description: "La generación y envío de colillas se ejecuta desde la página de Colillas de Pago",
    });
  };

  // Pre-Colilla PDF Preview Component
  const PreColillaPDFPreview = ({ line }: { line: PayrollLine }) => {
    const detail = line.deductions_detail || {};
    const netUSD = Number(line.net_pay) / exchangeRate;
    const grossCRC = Number(line.gross_salary) * exchangeRate;

    return (
      <div className="bg-white p-6 rounded-lg shadow-inner border max-w-2xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-lg font-bold text-[#0F2A44]">{selectedCompany?.name}</h2>
          <p className="text-sm text-gray-600">Comprobante de Pago</p>
          {currentBatch && (
            <p className="text-xs text-gray-500 mt-1">
              Período: {formatPeriod(currentBatch.period_start, currentBatch.period_end)}
            </p>
          )}
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-500">Empleado</p>
            <p className="font-semibold">{line.employee.full_name}</p>
          </div>
          <div>
            <p className="text-gray-500">Cédula / ID</p>
            <p className="font-semibold">{line.employee.employee_id}</p>
          </div>
          <div>
            <p className="text-gray-500">Fecha Ingreso</p>
            <p className="font-semibold">{new Date(line.employee.hire_date).toLocaleDateString('es-CR')}</p>
          </div>
          <div>
            <p className="text-gray-500">Centro de Costo</p>
            <p className="font-semibold">{line.cost_center?.name || 'N/A'}</p>
          </div>
        </div>

        {/* USD Salary Banner */}
        {line.currency === 'USD' && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-800">Salario Bruto USD:</span>
              <span className="font-bold text-blue-900">${formatNumber(Number(line.gross_salary))}</span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Tipo de Cambio BCCR: ₡{exchangeRate.toFixed(2)} / $1 USD
            </div>
          </div>
        )}

        {/* Earnings */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm border-b pb-1 mb-2 text-green-700">INGRESOS</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Salario Base</span>
              <span className="font-mono">₡{formatNumber(grossCRC)}</span>
            </div>
            {Number(line.additional_bonuses) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Bonificaciones</span>
                <span className="font-mono">₡{formatNumber(Number(line.additional_bonuses))}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Total Ingresos</span>
              <span className="font-mono">₡{formatNumber(grossCRC + Number(line.additional_bonuses || 0))}</span>
            </div>
          </div>
        </div>

        {/* Hours Worked */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm border-b pb-1 mb-2">HORAS TRABAJADAS</h3>
          <div className="grid grid-cols-3 gap-2 text-sm text-center">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-500">Ordinarias</div>
              <div className="font-semibold">{Number(line.regular_hours) || 0}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-500">Extra</div>
              <div className="font-semibold">{Number(line.overtime_hours) || 0}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-xs text-gray-500">Vacaciones</div>
              <div className="font-semibold">{Number(line.vacation_days_taken) || 0} días</div>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm border-b pb-1 mb-2 text-red-700">DEDUCCIONES</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>CCSS Obrero ({detail.ccss_rate || 10.83}%)</span>
              <span className="font-mono text-red-600">-₡{formatNumber(detail.ccss_obrero || 0)}</span>
            </div>
            {Number(detail.isr_neto) > 0 && (
              <div className="flex justify-between">
                <span>Impuesto sobre la Renta</span>
                <span className="font-mono text-red-600">-₡{formatNumber(detail.isr_neto || 0)}</span>
              </div>
            )}
            {isEducationSector && Number(detail.magisterio) > 0 && (
              <div className="flex justify-between">
                <span>Magisterio Nacional</span>
                <span className="font-mono text-red-600">-₡{formatNumber(detail.magisterio || 0)}</span>
              </div>
            )}
            {isEducationSector && Number(detail.poliza_vida) > 0 && (
              <div className="flex justify-between">
                <span>Póliza de Vida</span>
                <span className="font-mono text-red-600">-₡{formatNumber(detail.poliza_vida || 0)}</span>
              </div>
            )}
            {Number(detail.loan_deduction) > 0 && (
              <div className="flex justify-between">
                <span>Préstamos</span>
                <span className="font-mono text-red-600">-₡{formatNumber(detail.loan_deduction || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Total Deducciones</span>
              <span className="font-mono text-red-600">-₡{formatNumber(Number(line.deductions))}</span>
            </div>
          </div>
        </div>

        {/* Accruals */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm border-b pb-1 mb-2 text-blue-700">PROVISIONES</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-blue-50 p-2 rounded">
              <div className="text-xs text-blue-600">Vacaciones Acumuladas</div>
              <div className="font-semibold">{Number(line.vacation_accrued_days).toFixed(2)} días</div>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <div className="text-xs text-blue-600">Aguinaldo Acumulado</div>
              <div className="font-semibold">₡{formatNumber(Number(line.aguinaldo_accrued))}</div>
            </div>
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-green-700 mb-1">TOTAL A DEPOSITAR</p>
          <div className="text-2xl font-bold text-green-700">
            ${netUSD.toFixed(2)} USD
          </div>
          <p className="text-xs text-green-600 mt-1">
            (₡{formatNumber(Number(line.net_pay))} CRC)
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t text-center text-xs text-gray-400">
          <p>Este es un documento de pre-visualización</p>
          <p>ACL Workforce HUB - Gestión de Nómina Costa Rica</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pre-Colilla</h1>
          <p className="text-muted-foreground">
            Revise las colillas antes de enviarlas a los empleados
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Select
            value={selectedBatchId || ""}
            onValueChange={setSelectedBatchId}
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

          {currentBatch?.status === 'autorizado' && (
            <Button onClick={handleApproveAndSend} className="gap-2 bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4" />
              Enviar Colillas
            </Button>
          )}
        </div>
      </div>

      {/* Batch Info */}
      {currentBatch && (
        <div className="flex items-center gap-4">
          {getStatusBadge(currentBatch.status)}
          <Badge variant="outline">TC: ₡{exchangeRate.toFixed(2)}</Badge>
          <span className="text-sm text-muted-foreground">
            {payrollLines?.length || 0} empleados
          </span>
        </div>
      )}

      {!selectedBatchId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            Seleccione un período para revisar las colillas
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
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o cédula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Employees Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Colillas para Revisión ({filteredLines.length} de {payrollLines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Empleado</TableHead>
                      <TableHead>Centro Costo</TableHead>
                      <TableHead className="text-right">Bruto USD</TableHead>
                      <TableHead className="text-right">Deducciones</TableHead>
                      <TableHead className="text-right">Neto USD</TableHead>
                      <TableHead className="text-right">Neto CRC</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLines.map((line) => {
                      const netUSD = Number(line.net_pay) / exchangeRate;
                      
                      return (
                        <TableRow key={line.id} className="text-sm">
                          <TableCell>
                            <div>
                              <div className="font-medium">{line.employee.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.employee.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {line.cost_center?.code || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${formatNumber(Number(line.gross_salary))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            ₡{formatNumber(Number(line.deductions))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            ${netUSD.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ₡{formatNumber(Number(line.net_pay))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewPreColilla(line)}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PDF Preview Modal */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vista Previa de Colilla
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {selectedEmployee && (
              <PreColillaPDFPreview line={selectedEmployee} />
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsPdfModalOpen(false)}>
              Cerrar
            </Button>
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}