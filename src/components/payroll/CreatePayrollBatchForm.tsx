import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calculator, 
  Loader2, 
  AlertCircle, 
  ArrowRight, 
  CalendarDays,
  Clock,
  FileEdit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CreatePayrollBatchFormProps {
  companyId: string;
  companyName: string;
  activeEmployees: number;
  existingBatches: Array<{
    id: string;
    batch_id: string;
    period_start: string;
    period_end: string;
    payroll_type?: string;
  }>;
  onBatchCreated: () => void;
}

export function CreatePayrollBatchForm({
  companyId,
  companyName,
  activeEmployees,
  existingBatches,
  onBatchCreated,
}: CreatePayrollBatchFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Quick selection state
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedQuincena, setSelectedQuincena] = useState<'primera' | 'segunda' | null>(null);
  
  // Manual date override (optional)
  const [useManualDates, setUseManualDates] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  
  // Other options
  const [copyFromPrevious, setCopyFromPrevious] = useState(false);
  const [previousBatchId, setPreviousBatchId] = useState("");
  
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const years = [currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1];

  // Calculate dates based on selection
  const calculatedDates = useMemo(() => {
    if (useManualDates) {
      return { start: periodStart, end: periodEnd };
    }
    
    if (!selectedQuincena) return null;
    
    const year = selectedYear;
    const month = selectedMonth;
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    
    if (selectedQuincena === 'primera') {
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        end: `${year}-${String(month + 1).padStart(2, '0')}-15`,
      };
    } else {
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-16`,
        end: `${year}-${String(month + 1).padStart(2, '0')}-${lastDayOfMonth}`,
      };
    }
  }, [selectedYear, selectedMonth, selectedQuincena, useManualDates, periodStart, periodEnd]);

  // Check if batch already exists for selected period
  const existingBatchForPeriod = useMemo(() => {
    if (!calculatedDates) return null;
    
    return existingBatches.find(batch => 
      batch.period_start === calculatedDates.start && 
      batch.period_end === calculatedDates.end
    );
  }, [calculatedDates, existingBatches]);

  const handleCreateBatch = async () => {
    if (!calculatedDates || !calculatedDates.start || !calculatedDates.end) {
      toast({
        title: "Selección incompleta",
        description: "Selecciona la quincena o ingresa las fechas manualmente",
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

    if (existingBatchForPeriod) {
      toast({
        title: "Período duplicado",
        description: "Ya existe una planilla para este período. Selecciona otro período.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const payrollType = selectedQuincena === 'primera' ? 'adelanto' : 
                          selectedQuincena === 'segunda' ? 'segunda' : 'completa';
      
      const { data, error } = await supabase.functions.invoke('process-payroll', {
        body: {
          companyId,
          periodStart: calculatedDates.start,
          periodEnd: calculatedDates.end,
          frequency: 'quincenal',
          payrollType,
          copyFromBatchId: copyFromPrevious ? previousBatchId : undefined,
        },
      });

      if (error) throw error;

      // Check for ISR validation warnings
      if (data.isrValidationWarnings && data.isrValidationWarnings.length > 0) {
        toast({
          title: "⚠️ Advertencia ISR",
          description: `Los tramos de renta configurados difieren de los vigentes 2026. Se usaron los valores actuales pero considera actualizar los parámetros.`,
          variant: "destructive",
          duration: 8000,
        });
        console.warn('ISR Validation Warnings:', data.isrValidationWarnings);
      }

      toast({
        title: "✓ Planilla creada",
        description: `${data.linesCreated} colaboradores listos para edición`,
      });

      onBatchCreated();

      // Navigate to Pre-Nómina to edit hours
      toast({
        title: "Siguiente paso",
        description: "Ahora puedes agregar horas extra y ajustes en Pre-Nómina",
        duration: 5000,
      });
      
      setTimeout(() => {
        navigate('/reports/pre-nomina');
      }, 1500);

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

  const canCreate = calculatedDates && calculatedDates.start && calculatedDates.end && 
                    activeEmployees > 0 && !existingBatchForPeriod;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Crear Nueva Planilla Quincenal
            </CardTitle>
            <CardDescription className="mt-1">
              {companyName} • {activeEmployees} empleados activos
            </CardDescription>
          </div>
          <Badge variant={activeEmployees > 0 ? "default" : "destructive"}>
            {activeEmployees} activos
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {activeEmployees === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>No hay empleados activos.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/employees')}
              >
                Ir a Empleados
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Select Month/Year */}
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
            Seleccionar Mes y Año
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              value={String(selectedMonth)} 
              onValueChange={(v) => {
                setSelectedMonth(Number(v));
                setSelectedQuincena(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={String(selectedYear)} 
              onValueChange={(v) => {
                setSelectedYear(Number(v));
                setSelectedQuincena(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Step 2: Select Quincena */}
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
            Seleccionar Quincena
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={selectedQuincena === 'primera' ? 'default' : 'outline'}
              className={`h-auto py-4 flex flex-col items-center gap-1 ${
                selectedQuincena === 'primera' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelectedQuincena('primera');
                setUseManualDates(false);
              }}
            >
              <span className="text-lg font-bold">1ra Quincena</span>
              <span className="text-xs opacity-80">
                1 al 15 de {months[selectedMonth]}
              </span>
              <Badge variant="secondary" className="mt-1">Adelanto de Salario</Badge>
            </Button>
            <Button
              type="button"
              variant={selectedQuincena === 'segunda' ? 'default' : 'outline'}
              className={`h-auto py-4 flex flex-col items-center gap-1 ${
                selectedQuincena === 'segunda' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelectedQuincena('segunda');
                setUseManualDates(false);
              }}
            >
              <span className="text-lg font-bold">2da Quincena</span>
              <span className="text-xs opacity-80">
                16 al {new Date(selectedYear, selectedMonth + 1, 0).getDate()} de {months[selectedMonth]}
              </span>
              <Badge variant="secondary" className="mt-1">Pago Final</Badge>
            </Button>
          </div>
          
          {/* Manual date override toggle */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="manual-dates" 
              checked={useManualDates}
              onCheckedChange={(checked) => {
                setUseManualDates(checked as boolean);
                if (checked) setSelectedQuincena(null);
              }}
            />
            <Label htmlFor="manual-dates" className="text-sm cursor-pointer">
              Usar fechas personalizadas
            </Label>
          </div>
          
          {useManualDates && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha Fin</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Exchange Rate */}
        <div className="space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
            Tipo de Cambio (₡/$)
          </Label>
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              El sistema toma automaticamente el tipo de cambio de venta del Banco Central de Costa Rica para la fecha final del periodo.
            </AlertDescription>
          </Alert>
        </div>

        {/* Copy from previous (optional) */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="copy-previous" 
              checked={copyFromPrevious}
              onCheckedChange={(checked) => setCopyFromPrevious(checked as boolean)}
            />
            <Label htmlFor="copy-previous" className="cursor-pointer">
              Copiar horas y bonos de planilla anterior
            </Label>
          </div>
          
          {copyFromPrevious && existingBatches.length > 0 && (
            <Select value={previousBatchId} onValueChange={setPreviousBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar planilla base..." />
              </SelectTrigger>
              <SelectContent>
                {existingBatches.slice(0, 10).map(batch => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.batch_id} ({new Date(batch.period_start).toLocaleDateString('es-CR')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Validation / Duplicate warning */}
        {existingBatchForPeriod && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ya existe una planilla para este período: <strong>{existingBatchForPeriod.batch_id}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary and Create Button */}
        {calculatedDates && !existingBatchForPeriod && (
          <Alert className="bg-primary/5 border-primary/20">
            <Clock className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">
              <strong>Período seleccionado:</strong>{' '}
              {new Date(calculatedDates.start + 'T12:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })}
              {' '}al{' '}
              {new Date(calculatedDates.end + 'T12:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button 
            onClick={handleCreateBatch} 
            disabled={isProcessing || !canCreate}
            className="flex-1 gap-2"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Crear Planilla
              </>
            )}
          </Button>
        </div>

        {/* Workflow hint */}
        <div className="bg-muted/50 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span>Crear Planilla</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex items-center gap-2">
              <FileEdit className="h-4 w-4" />
              <span className="font-medium text-foreground">Pre-Nómina (Horas Extra)</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <span>Pre-Colilla</span>
            <ArrowRight className="h-4 w-4" />
            <span>Aprobar</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
