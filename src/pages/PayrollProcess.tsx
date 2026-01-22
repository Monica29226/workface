import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  RefreshCw,
  Edit,
  XCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditablePayrollRow } from "@/components/payroll/EditablePayrollRow";

interface PayrollBatch {
  id: string;
  batch_id: string;
  period_start: string;
  period_end: string;
  frequency: string;
  payroll_type?: string;
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
  exchange_rate_to_base?: number;
}

export function PayrollProcess() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [activeEmployees, setActiveEmployees] = useState<number>(0);

  // New batch form
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [frequency, setFrequency] = useState<'mensual' | 'quincenal' | 'semanal'>('mensual');
  const [payrollType, setPayrollType] = useState<'adelanto' | 'segunda' | 'completa'>('completa');
  const [exchangeRate, setExchangeRate] = useState(510.27);
  const [copyFromPrevious, setCopyFromPrevious] = useState(false);
  const [previousBatchId, setPreviousBatchId] = useState<string>("");

  useEffect(() => {
    if (selectedCompany) {
      fetchBatches();
      fetchActiveEmployees();
    }
  }, [selectedCompany]);

  const fetchActiveEmployees = async () => {
    if (!selectedCompany) return;

    try {
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('status', 'activo');

      if (error) throw error;
      setActiveEmployees(count || 0);
    } catch (error) {
      console.error('Error fetching active employees:', error);
    }
  };

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

    if (activeEmployees === 0) {
      toast({
        title: "No hay empleados activos",
        description: "Debes agregar al menos un empleado activo antes de crear una planilla",
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
          payrollType: frequency === 'quincenal' ? payrollType : 'completa',
          exchangeRate,
          copyFromBatchId: copyFromPrevious ? previousBatchId : undefined,
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
      setCopyFromPrevious(false);
      setPreviousBatchId("");
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

  const validatePayrollLines = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const tolerance = 0.01; // Allow for small floating point differences

    payrollLines.forEach((line) => {
      const grossSalary = Number(line.gross_salary) || 0;
      const deductions = Number(line.deductions) || 0;
      const netPay = Number(line.net_pay) || 0;
      
      const expectedNetPay = grossSalary - deductions;
      const difference = Math.abs(netPay - expectedNetPay);
      
      if (difference > tolerance) {
        errors.push(
          `${line.employee.full_name} (${line.employee.employee_id}): ` +
          `Neto esperado ₡${expectedNetPay.toLocaleString('es-CR', { minimumFractionDigits: 2 })} ` +
          `pero tiene ₡${netPay.toLocaleString('es-CR', { minimumFractionDigits: 2 })} ` +
          `(diferencia: ₡${difference.toLocaleString('es-CR', { minimumFractionDigits: 2 })})`
        );
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const handleApprove = async () => {
    if (!selectedBatch) return;

    // Validate all payroll lines before approving
    const { isValid, errors } = validatePayrollLines();
    
    if (!isValid) {
      toast({
        title: "Validación fallida",
        description: (
          <div className="space-y-2">
            <p className="font-medium">Se encontraron errores en el cálculo:</p>
            <ul className="list-disc list-inside text-sm max-h-40 overflow-y-auto">
              {errors.slice(0, 5).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {errors.length > 5 && (
                <li className="text-muted-foreground">...y {errors.length - 5} errores más</li>
              )}
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Por favor recalcula la planilla antes de aprobar.
            </p>
          </div>
        ),
        variant: "destructive",
        duration: 10000, // Show for 10 seconds due to important info
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payroll_batches')
        .update({ status: 'aprobado' })
        .eq('id', selectedBatch);

      if (error) throw error;

      toast({
        title: "✓ Planilla aprobada",
        description: `Validación exitosa: ${payrollLines.length} líneas verificadas correctamente`,
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

  const handleAuthorize = async () => {
    if (!selectedBatch) return;

    const currentBatch = batches.find(b => b.id === selectedBatch);
    if (currentBatch?.status !== 'aprobado') {
      toast({
        title: "Planilla no aprobada",
        description: "Debes aprobar la planilla antes de autorizarla",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Use type assertion since 'autorizado' was just added to the enum
      const { error } = await supabase
        .from('payroll_batches')
        .update({ status: 'autorizado' as any })
        .eq('id', selectedBatch);

      if (error) throw error;

      toast({
        title: "✓ Planilla autorizada",
        description: "Ahora puedes generar y enviar las colillas de pago",
      });

      fetchBatches();
      fetchPayrollLines();
    } catch (error) {
      console.error('Error authorizing batch:', error);
      toast({
        title: "Error",
        description: "No se pudo autorizar la planilla",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePayslips = async () => {
    if (!selectedBatch) return;

    const currentBatch = batches.find(b => b.id === selectedBatch);
    if (currentBatch?.status !== 'autorizado') {
      toast({
        title: "Planilla no autorizada",
        description: "Debes autorizar la planilla antes de generar colillas. Flujo: Calculado → Aprobado → Autorizado → Enviado",
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

  const handleUnapprove = async () => {
    if (!selectedBatch) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('payroll_batches')
        .update({ status: 'calculado' })
        .eq('id', selectedBatch);

      if (error) throw error;

      toast({
        title: "Planilla desaprobada",
        description: "Ahora puedes editar las líneas de planilla",
      });

      fetchBatches();
      fetchPayrollLines();
    } catch (error) {
      console.error('Error unapproving batch:', error);
      toast({
        title: "Error",
        description: "No se pudo desaprobar la planilla",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateLine = async (lineId: string, updates: any) => {
    try {
      const { error } = await supabase.functions.invoke('update-payroll-line', {
        body: {
          lineId,
          updates,
          reason: 'Edición manual desde interfaz'
        },
      });

      if (error) throw error;

      toast({
        title: "Línea actualizada",
        description: "Los cambios se guardaron correctamente",
      });

      setEditingLineId(null);
      fetchPayrollLines();
    } catch (error: any) {
      console.error('Error updating line:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la línea",
        variant: "destructive",
      });
    }
  };

  const handleRecalculate = async () => {
    if (!selectedBatch) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('recalculate-payroll-batch', {
        body: { batchId: selectedBatch },
      });

      if (error) throw error;

      toast({
        title: "Planilla recalculada",
        description: "Todos los totales han sido actualizados",
      });

      fetchPayrollLines();
    } catch (error: any) {
      console.error('Error recalculating batch:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo recalcular la planilla",
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
      autorizado: { label: "Autorizado", className: "bg-amber-100 text-amber-800" },
      enviado: { label: "Enviado", className: "bg-purple-100 text-purple-800" },
    };
    const variant = variants[status] || variants.borrador;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getPayrollTypeBadge = (type?: string) => {
    if (!type || type === 'completa') return null;
    const variants: Record<string, { label: string; className: string }> = {
      adelanto: { label: "1ra Quincena", className: "bg-indigo-100 text-indigo-800" },
      segunda: { label: "2da Quincena", className: "bg-teal-100 text-teal-800" },
    };
    const variant = variants[type];
    if (!variant) return null;
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear Nueva Planilla
            </div>
            <Badge variant={activeEmployees > 0 ? "default" : "destructive"}>
              {activeEmployees} empleados activos
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeEmployees === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>No hay empleados activos. Debes agregar empleados antes de crear una planilla.</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.href = '/employees'}
                  className="ml-2"
                >
                  Ir a Empleados
                </Button>
              </AlertDescription>
            </Alert>
          )}
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
              <Select value={frequency} onValueChange={(v: any) => {
                setFrequency(v);
                // Reset payroll type when changing frequency
                if (v !== 'quincenal') setPayrollType('completa');
              }}>
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
            {frequency === 'quincenal' && (
              <div className="space-y-2">
                <Label>Tipo de Quincena *</Label>
                <Select value={payrollType} onValueChange={(v: any) => setPayrollType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adelanto">1ra Quincena - Adelanto de Salario</SelectItem>
                    <SelectItem value="segunda">2da Quincena - Pago Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
          
          {/* Biweekly info banner */}
          {frequency === 'quincenal' && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>{payrollType === 'adelanto' ? 'Adelanto de Salario:' : 'Segunda Quincena:'}</strong>{' '}
                {payrollType === 'adelanto' 
                  ? 'Se calculará el 50% del salario neto estimado con 50% de las deducciones mensuales.'
                  : 'Se calculará el 50% restante del salario con el otro 50% de las deducciones.'}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Copy from previous month option */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="copy-previous" 
                checked={copyFromPrevious}
                onCheckedChange={(checked) => setCopyFromPrevious(checked as boolean)}
              />
              <Label htmlFor="copy-previous" className="cursor-pointer">
                Copiar datos del mes anterior (horas, bonos, deducciones)
              </Label>
            </div>
            
            {copyFromPrevious && batches.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar planilla base</Label>
                <Select value={previousBatchId} onValueChange={setPreviousBatchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar planilla anterior" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(batch => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.batch_id} - {new Date(batch.period_start).toLocaleDateString('es-CR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button 
            onClick={handleCreateBatch} 
            disabled={isProcessing || !periodStart || !periodEnd || activeEmployees === 0}
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
                <div className="flex gap-2">
                  {currentBatch && getPayrollTypeBadge(currentBatch.payroll_type)}
                  {currentBatch && getStatusBadge(currentBatch.status)}
                </div>
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
                      {batches.map(batch => {
                        const typeLabel = batch.payroll_type === 'adelanto' ? ' [Adelanto]' : 
                                          batch.payroll_type === 'segunda' ? ' [2da Quincena]' : '';
                        return (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.batch_id}{typeLabel} - {new Date(batch.period_start).toLocaleDateString('es-CR')} 
                            {' '}al{' '}
                            {new Date(batch.period_end).toLocaleDateString('es-CR')}
                            {' '}({batch.status})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {currentBatch && (
                  <div className="flex gap-2">
                    {currentBatch.status === 'calculado' && (
                      <>
                        <Button 
                          onClick={handleRecalculate} 
                          disabled={isProcessing} 
                          variant="outline"
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Recalcular
                        </Button>
                        <Button onClick={handleApprove} disabled={isProcessing} className="gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Aprobar Planilla
                        </Button>
                      </>
                    )}
                    {currentBatch.status === 'aprobado' && (
                      <>
                        <Button 
                          onClick={handleUnapprove} 
                          disabled={isProcessing} 
                          variant="outline"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Desaprobar
                        </Button>
                        <Button onClick={handleAuthorize} disabled={isProcessing} className="gap-2 bg-amber-600 hover:bg-amber-700">
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Autorizar Envío
                        </Button>
                      </>
                    )}
                    {currentBatch.status === 'autorizado' && (
                      <>
                        <Button onClick={handleGeneratePayslips} disabled={isProcessing} className="gap-2">
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          Generar Colillas
                        </Button>
                      </>
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
                        {formatCurrency(stats.totalDeductions, 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Deducciones (CRC)
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.totalNet, 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Neto a Pagar (CRC)
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(stats.totalEmployerContrib, 'CRC')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Cargas Patronales (CRC)
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payroll Lines Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Detalle de Planilla ({payrollLines.length} empleados)</span>
                    {currentBatch?.status === 'calculado' && (
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Haz clic en una fila para editarla
                        </span>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">✓</TableHead>
                          <TableHead>Empleado</TableHead>
                          <TableHead className="text-right">Horas</TableHead>
                          <TableHead className="text-right">Ausencias/Vac</TableHead>
                          <TableHead className="text-right">Bruto</TableHead>
                          <TableHead className="text-right">Deducciones</TableHead>
                          <TableHead className="text-right">Neto</TableHead>
                          <TableHead className="text-right">Cargas Patronales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollLines.map((line) => {
                          // Validate: NET = GROSS - DEDUCTIONS
                          const grossSalary = Number(line.gross_salary) || 0;
                          const deductions = Number(line.deductions) || 0;
                          const netPay = Number(line.net_pay) || 0;
                          const expectedNetPay = grossSalary - deductions;
                          const isValid = Math.abs(netPay - expectedNetPay) < 0.01;

                          return currentBatch?.status === 'calculado' ? (
                            <EditablePayrollRow
                              key={line.id}
                              line={line}
                              isEditing={editingLineId === line.id}
                              onStartEdit={() => setEditingLineId(line.id)}
                              onSave={handleUpdateLine}
                              onCancel={() => setEditingLineId(null)}
                              isValid={isValid}
                            />
                          ) : (
                            <TableRow key={line.id} className={!isValid ? 'bg-destructive/5' : ''}>
                              <TableCell>
                                {isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <div className="relative group">
                                    <AlertCircle className="h-4 w-4 text-destructive cursor-help" />
                                    <div className="absolute left-6 top-0 z-50 hidden group-hover:block bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border w-48">
                                      <p className="font-semibold text-destructive">Error de cálculo</p>
                                      <p>Esperado: {formatCurrency(expectedNetPay, line.currency)}</p>
                                      <p>Actual: {formatCurrency(netPay, line.currency)}</p>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{line.employee.full_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {line.employee.employee_id}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                <div>H.Reg: {(line as any).regular_hours || 0}</div>
                                <div className="text-muted-foreground">H.Extra: {(line as any).overtime_hours || 0}</div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                <div>Aus: {(line as any).absence_days || 0}</div>
                                <div className="text-muted-foreground">Vac: {(line as any).vacation_days_taken || 0}</div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(Number(line.gross_salary), line.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-destructive">
                                {formatCurrency(Number(line.deductions), 'CRC')}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-green-600">
                                <div>{formatCurrency(Number(line.net_pay), 'CRC')}</div>
                                {line.currency === 'USD' && line.exchange_rate_to_base && (
                                  <div className="text-xs text-muted-foreground">
                                    ≈ {formatCurrency(Number(line.net_pay) / Number(line.exchange_rate_to_base), 'USD')}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-primary">
                                {formatCurrency(Number(line.employer_contrib), 'CRC')}
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
        </>
      )}
    </div>
  );
}
