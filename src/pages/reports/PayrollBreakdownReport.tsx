import { useState, useMemo } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileSpreadsheet, Printer } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface PayrollLine {
  id: string;
  employee_id: string;
  gross_salary: number;
  deductions: number;
  net_pay: number;
  employer_contrib: number;
  additional_bonuses: number;
  additional_deductions: number;
  currency: string;
  notes: string | null;
  manual_adjustments: {
    ccss?: number;
    magisterio?: number;
    poliza_vida?: number;
    income_tax?: number;
    loan_deduction?: number;
  } | null;
  employee: {
    full_name: string;
    employee_id: string;
    work_email: string;
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

export function PayrollBreakdownReport() {
  const { selectedCompany } = useCompany();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Fetch payroll batches
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["payrollBatches", selectedCompany?.id],
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

  // Fetch payroll lines for selected batch (including exchange_rate_to_base)
  const { data: payrollLines, isLoading: linesLoading } = useQuery({
    queryKey: ["payrollLinesBreakdown", selectedBatchId],
    queryFn: async () => {
      if (!selectedBatchId) return [];

      const { data, error } = await supabase
        .from("payroll_lines")
        .select(`
          *,
          employee:employees!inner(id, employee_id, full_name, work_email)
        `)
        .eq("batch_id", selectedBatchId)
        .order("employee(full_name)");

      if (error) throw error;
      return data as unknown as (PayrollLine & { exchange_rate_to_base?: number })[];
    },
    enabled: !!selectedBatchId,
  });

  // Fetch company parameters to know if it's education sector
  const { data: companyParams } = useQuery({
    queryKey: ["companyParams", selectedCompany?.id],
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

  const isEducationSector = companyParams?.is_education_sector || false;
  const currentBatch = batches?.find(b => b.id === selectedBatchId);
  
  // Get exchange rate from payroll lines
  const exchangeRate = useMemo(() => {
    if (!payrollLines || payrollLines.length === 0) return null;
    const usdLine = payrollLines.find(line => line.currency === 'USD');
    return usdLine ? (usdLine as any).exchange_rate_to_base : null;
  }, [payrollLines]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!payrollLines) return null;

    return payrollLines.reduce(
      (acc, line) => {
        const adjustments = line.manual_adjustments || {};
        return {
          grossSalary: acc.grossSalary + Number(line.gross_salary),
          ccss: acc.ccss + Number(adjustments.ccss || 0),
          magisterio: acc.magisterio + Number(adjustments.magisterio || 0),
          polizaVida: acc.polizaVida + Number(adjustments.poliza_vida || 0),
          incomeTax: acc.incomeTax + Number(adjustments.income_tax || 0),
          loans: acc.loans + Number(adjustments.loan_deduction || 0),
          otherDeductions: acc.otherDeductions + Number(line.additional_deductions || 0) - Number(adjustments.loan_deduction || 0),
          totalDeductions: acc.totalDeductions + Number(line.deductions),
          netPay: acc.netPay + Number(line.net_pay),
          employerContrib: acc.employerContrib + Number(line.employer_contrib),
        };
      },
      {
        grossSalary: 0,
        ccss: 0,
        magisterio: 0,
        polizaVida: 0,
        incomeTax: 0,
        loans: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netPay: 0,
        employerContrib: 0,
      }
    );
  }, [payrollLines]);

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  const handleExportCSV = () => {
    if (!payrollLines || !currentBatch) return;

    const headers = [
      "Empleado",
      "ID",
      "Salario Bruto",
      "CCSS",
      ...(isEducationSector ? ["Magisterio", "Póliza Vida"] : []),
      "ISR",
      "Préstamos",
      "Otras Deducciones",
      "Total Deducciones",
      "Salario Neto",
    ];

    const rows = payrollLines.map((line) => {
      const adjustments = line.manual_adjustments || {};
      const otherDed = Number(line.additional_deductions || 0) - Number(adjustments.loan_deduction || 0);
      
      const baseRow = [
        line.employee.full_name,
        line.employee.employee_id,
        Number(line.gross_salary).toFixed(2),
        Number(adjustments.ccss || 0).toFixed(2),
      ];

      if (isEducationSector) {
        baseRow.push(
          Number(adjustments.magisterio || 0).toFixed(2),
          Number(adjustments.poliza_vida || 0).toFixed(2)
        );
      }

      baseRow.push(
        Number(adjustments.income_tax || 0).toFixed(2),
        Number(adjustments.loan_deduction || 0).toFixed(2),
        otherDed.toFixed(2),
        Number(line.deductions).toFixed(2),
        Number(line.net_pay).toFixed(2)
      );

      return baseRow;
    });

    // Add totals row
    const totalsRow = [
      "TOTALES",
      "",
      totals?.grossSalary.toFixed(2) || "0",
      totals?.ccss.toFixed(2) || "0",
    ];

    if (isEducationSector) {
      totalsRow.push(
        totals?.magisterio.toFixed(2) || "0",
        totals?.polizaVida.toFixed(2) || "0"
      );
    }

    totalsRow.push(
      totals?.incomeTax.toFixed(2) || "0",
      totals?.loans.toFixed(2) || "0",
      totals?.otherDeductions.toFixed(2) || "0",
      totals?.totalDeductions.toFixed(2) || "0",
      totals?.netPay.toFixed(2) || "0"
    );

    rows.push(totalsRow);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `desglose_planilla_${currentBatch.batch_id}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const currency = currentBatch?.base_currency || "CRC";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Reporte de Desglose de Planilla</h1>
          <p className="text-muted-foreground">
            Salario bruto con todos los rebajos detallados
          </p>
        </div>

        <div className="flex gap-2">
          <Select
            value={selectedBatchId || ""}
            onValueChange={(value) => setSelectedBatchId(value)}
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

          {selectedBatchId && payrollLines && payrollLines.length > 0 && (
            <>
              <Button variant="outline" size="icon" onClick={handleExportCSV} title="Exportar CSV">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handlePrint} title="Imprimir">
                <Printer className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-center">{selectedCompany?.name}</h1>
        <h2 className="text-lg text-center">Reporte de Desglose de Planilla</h2>
        {currentBatch && (
          <p className="text-center text-sm">
            Período: {formatPeriod(currentBatch.period_start, currentBatch.period_end)}
          </p>
        )}
      </div>

      {!selectedBatchId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Seleccione un período de planilla para ver el desglose
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Bruto</div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(totals?.grossSalary || 0, currency)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Deducciones</div>
                <div className="text-lg font-bold text-orange-600">
                  {formatCurrency(totals?.totalDeductions || 0, currency)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Total Neto</div>
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(totals?.netPay || 0, currency)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">Empleados</div>
                <div className="text-lg font-bold">{payrollLines.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Exchange Rate Banner */}
          {exchangeRate && (
            <Card className="border-blue-200 bg-blue-50/50 print:break-inside-avoid">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <span className="font-medium">Tipo de Cambio BCCR (Venta):</span>
                  <span className="font-bold">₡{Number(exchangeRate).toFixed(2)}</span>
                  <span className="text-muted-foreground">/ $1 USD</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deductions Breakdown Summary */}
          <Card className="print:break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de Deducciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">CCSS</div>
                  <div className="font-semibold">{formatCurrency(totals?.ccss || 0, currency)}</div>
                </div>
                {isEducationSector && (
                  <>
                    <div>
                      <div className="text-muted-foreground">Magisterio</div>
                      <div className="font-semibold">{formatCurrency(totals?.magisterio || 0, currency)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Póliza Vida</div>
                      <div className="font-semibold">{formatCurrency(totals?.polizaVida || 0, currency)}</div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-muted-foreground">ISR</div>
                  <div className="font-semibold">{formatCurrency(totals?.incomeTax || 0, currency)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Préstamos</div>
                  <div className="font-semibold">{formatCurrency(totals?.loans || 0, currency)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Otros</div>
                  <div className="font-semibold">{formatCurrency(totals?.otherDeductions || 0, currency)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detail Table */}
          <Card className="print:shadow-none print:border-0">
            <CardHeader className="pb-2 print:py-2">
              <CardTitle className="text-base">Detalle por Empleado</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="sticky left-0 bg-background z-10">Empleado</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">CCSS</TableHead>
                      {isEducationSector && (
                        <>
                          <TableHead className="text-right">Magisterio</TableHead>
                          <TableHead className="text-right">Póliza</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">ISR</TableHead>
                      <TableHead className="text-right">Préstamos</TableHead>
                      <TableHead className="text-right">Otros</TableHead>
                      <TableHead className="text-right font-semibold">Total Ded.</TableHead>
                      <TableHead className="text-right font-semibold text-green-600">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollLines.map((line) => {
                      const adjustments = line.manual_adjustments || {};
                      const otherDed = Math.max(0, Number(line.additional_deductions || 0) - Number(adjustments.loan_deduction || 0));
                      
                      return (
                        <TableRow key={line.id} className="text-xs">
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div>
                              <div className="font-medium">{line.employee.full_name}</div>
                              <div className="text-muted-foreground text-[10px]">
                                {line.employee.employee_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(Number(line.gross_salary))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(Number(adjustments.ccss || 0))}
                          </TableCell>
                          {isEducationSector && (
                            <>
                              <TableCell className="text-right font-mono text-orange-600">
                                {formatNumber(Number(adjustments.magisterio || 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-orange-600">
                                {formatNumber(Number(adjustments.poliza_vida || 0))}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(Number(adjustments.income_tax || 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(Number(adjustments.loan_deduction || 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(otherDed)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-orange-700">
                            {formatNumber(Number(line.deductions))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {formatNumber(Number(line.net_pay))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold text-xs border-t-2">
                      <TableCell className="sticky left-0 bg-muted/50 z-10">
                        TOTALES ({payrollLines.length} empleados)
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(totals?.grossSalary || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatNumber(totals?.ccss || 0)}
                      </TableCell>
                      {isEducationSector && (
                        <>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(totals?.magisterio || 0)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            {formatNumber(totals?.polizaVida || 0)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatNumber(totals?.incomeTax || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatNumber(totals?.loans || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatNumber(totals?.otherDeductions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-700">
                        {formatNumber(totals?.totalDeductions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatNumber(totals?.netPay || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
