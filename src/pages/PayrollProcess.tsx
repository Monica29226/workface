import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar,
  Calculator,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PayrollBatch {
  id: string;
  batch_id: string;
  period_start: string;
  period_end: string;
  frequency: string;
  status: string;
  base_currency: string;
}

interface PayrollLine {
  id: string;
  employee: {
    full_name: string;
    employee_id: string;
  };
  gross_salary: number;
  deductions: number;
  net_pay: number;
  employer_contrib: number;
  aguinaldo_accrued: number;
  currency: string;
}

export function PayrollProcess() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New batch form
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [frequency, setFrequency] = useState<'mensual' | 'quincenal' | 'semanal'>('mensual');
  const [exchangeRate, setExchangeRate] = useState(510.27);

  useEffect(() => {
    if (selectedCompany) {
      fetchBatches();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedBatch) {
      fetchPayrollLines();
    }
  }, [selectedBatch]);

  const fetchBatches = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_batches')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
      
      if (data && data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las planillas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayrollLines = async () => {
    if (!selectedBatch) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_lines')
        .select(`
          *,
          employee:employees!inner(
            full_name,
            employee_id
          )
        `)
        .eq('batch_id', selectedBatch);

      if (error) throw error;
      setPayrollLines(data || []);
    } catch (error) {
      console.error('Error fetching payroll lines:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las líneas de planilla",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedCompany || !periodStart || !periodEnd) {
      toast({
        title: "Datos incompletos",
        description: "Completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-payroll', {
        body: {
          companyId: selectedCompany.id,
          periodStart,
          periodEnd,
          frequency,
          exchangeRate,
        },
      });

      if (error) throw error;

      toast({
        title: "Planilla procesada",
        description: `Se crearon ${data.linesCreated} líneas de planilla`,
      });

      // Refresh batches and select the new one
      await fetchBatches();
      
      // Clear form
      setPeriodStart("");
      setPeriodEnd("");
    } catch (error: any) {
      console.error('Error processing payroll:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la planilla",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedBatch) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payroll_batches')
        .update({ status: 'aprobado' })
        .eq('id', selectedBatch);

      if (error) throw error;

      toast({
        title: "Planilla aprobada",
        description: "La planilla ha sido aprobada correctamente",
      });

      fetchBatches();
      fetchPayrollLines();
    } catch (error) {
      console.error('Error approving batch:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la planilla",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePayslips = async () => {
    if (!selectedBatch) return;

    const currentBatch = batches.find(b => b.id === selectedBatch);
    if (currentBatch?.status !== 'aprobado') {
      toast({
        title: "Planilla no aprobada",
        description: "Debes aprobar la planilla antes de generar colillas",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payslips', {
        body: { batchId: selectedBatch },
      });

      if (error) throw error;

      toast({
        title: "Colillas generadas",
        description: data.message,
      });

      fetchBatches();
    } catch (error: any) {
      console.error('Error generating payslips:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar las colillas",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBatch = batches.find(b => b.id === selectedBatch);
  const stats = {
    totalGross: payrollLines.reduce((sum, line) => sum + Number(line.gross_salary), 0),
    totalDeductions: payrollLines.reduce((sum, line) => sum + Number(line.deductions), 0),
    totalNet: payrollLines.reduce((sum, line) => sum + Number(line.net_pay), 0),
    totalEmployerContrib: payrollLines.reduce((sum, line) => sum + Number(line.employer_contrib), 0),
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      borrador: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
      calculado: { label: "Calculado", className: "bg-blue-100 text-blue-800" },
      aprobado: { label: "Aprobado", className: "bg-green-100 text-green-800" },
      enviado: { label: "Enviado", className: "bg-purple-100 text-purple-800" },
    };
    const variant = variants[status] || variants.borrador;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (isLoading && batches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando planillas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Proceso de Planilla
          </h1>
          <p className="text-muted-foreground">
            {selectedCompany?.name} - Workflow completo de nómina
          </p>
        </div>
      </div>

      {/* Create New Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear Nueva Planilla
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio *</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin *</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Frecuencia *</Label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Cambio</Label>
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
              />
            </div>
          </div>
          <Button 
            onClick={handleCreateBatch} 
            disabled={isProcessing || !periodStart || !periodEnd}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Procesar Planilla
              </>
            )}
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este proceso creará automáticamente líneas de planilla para todos los empleados activos, 
              calculando salarios, deducciones (CCSS, renta), aguinaldo y días de vacaciones.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Existing Batches */}
      {batches.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Planilla Seleccionada
                </span>
                {currentBatch && getStatusBadge(currentBatch.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Seleccionar Planilla</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map(batch => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batch_id} - {new Date(batch.period_start).toLocaleDateString('es-CR')} 
                          {' '}al{' '}
                          {new Date(batch.period_end).toLocaleDateString('es-CR')}
                          {' '}({batch.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentBatch && (
                  <div className="flex gap-2">
                    {currentBatch.status === 'calculado' && (
                      <Button onClick={handleApprove} disabled={isProcessing} className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Aprobar Planilla
                      </Button>
                    )}
                    {currentBatch.status === 'aprobado' && (
                      <Button onClick={handleGeneratePayslips} disabled={isProcessing} className="gap-2">
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        Generar Colillas
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {payrollLines.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(stats.totalGross, currentBatch?.base_currency || 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Total Bruto
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(stats.totalDeductions, currentBatch?.base_currency || 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Deducciones
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.totalNet, currentBatch?.base_currency || 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Neto a Pagar
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(stats.totalEmployerContrib, currentBatch?.base_currency || 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Cargas Patronales
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payroll Lines Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalle de Planilla ({payrollLines.length} empleados)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleado</TableHead>
                          <TableHead className="text-right">Bruto</TableHead>
                          <TableHead className="text-right">Deducciones</TableHead>
                          <TableHead className="text-right">Neto</TableHead>
                          <TableHead className="text-right">Cargas Patronales</TableHead>
                          <TableHead className="text-right">Aguinaldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{line.employee.full_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {line.employee.employee_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(line.gross_salary), line.currency)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-orange-600">
                              {formatCurrency(Number(line.deductions), line.currency)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-green-600">
                              {formatCurrency(Number(line.net_pay), line.currency)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-blue-600">
                              {formatCurrency(Number(line.employer_contrib), line.currency)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-primary">
                              {formatCurrency(Number(line.aguinaldo_accrued), line.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
