import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  CheckCircle, 
  Circle, 
  Clock,
  Calculator,
  FileText,
  Download,
  Mail,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PayrollStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export function PayrollProcess() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [currentStep, setCurrentStep] = useState(1);
  
  const steps: PayrollStep[] = [
    {
      id: 1,
      title: "Configuración del Período",
      description: "Definir fechas, tipo de cambio y estado",
      completed: false,
      current: currentStep === 1
    },
    {
      id: 2,
      title: "Consolidar Horas",
      description: "Revisar timesheets y variables",
      completed: false,
      current: currentStep === 2
    },
    {
      id: 3,
      title: "Aplicar Deducciones",
      description: "CCSS, renta, embargos y préstamos",
      completed: false,
      current: currentStep === 3
    },
    {
      id: 4,
      title: "Previsualizar Planilla",
      description: "Revisar cálculos y hacer ajustes",
      completed: false,
      current: currentStep === 4
    },
    {
      id: 5,
      title: "Generar Artefactos",
      description: "Colillas, archivos y asientos",
      completed: false,
      current: currentStep === 5
    }
  ];

  const [periodConfig, setPeriodConfig] = useState({
    name: "Setiembre 2025",
    startDate: "2025-09-01",
    endDate: "2025-09-30",
    exchangeRate: 510.27,
    status: "Draft"
  });

  const getStepIcon = (step: PayrollStep) => {
    if (step.completed) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (step.current) return <Clock className="h-5 w-5 text-blue-600" />;
    return <Circle className="h-5 w-5 text-gray-400" />;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Configuración del Período de Planilla
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="periodName">Nombre del Período</Label>
                  <Input
                    id="periodName"
                    value={periodConfig.name}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select 
                    value={periodConfig.status} 
                    onValueChange={(value) => setPeriodConfig(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft - Edición Total</SelectItem>
                      <SelectItem value="In Review">En Revisión - Restringido</SelectItem>
                      <SelectItem value="Approved">Aprobado - Solo Colillas</SelectItem>
                      <SelectItem value="Closed">Cerrado - Solo Consulta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={periodConfig.startDate}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={periodConfig.endDate}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exchangeRate">Tipo de Cambio (₡ por $1)</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.01"
                    value={periodConfig.exchangeRate}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div className="text-sm text-blue-800">
                  <strong>Estado Draft:</strong> Permite edición completa de empleados, contratos, timesheets y deducciones.
                  El tipo de cambio se aplicará a todos los salarios en USD.
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-navy">Consolidación de Horas y Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="timesheets" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                    <TabsTrigger value="overtime">Horas Extra</TabsTrigger>
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="timesheets" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">168</div>
                        <div className="text-sm text-green-600">Horas Regulares</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">24</div>
                        <div className="text-sm text-blue-600">Horas Fin de Semana</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="text-2xl font-bold text-orange-700">8</div>
                        <div className="text-sm text-orange-600">Horas Extra</div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="overtime" className="space-y-4">
                    <div className="p-4 text-center text-muted-foreground">
                      Configuración de recargos: 1.5x hora extra, 1.0x sábado, 1.5x domingo
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="variables" className="space-y-4">
                    <div className="p-4 text-center text-muted-foreground">
                      Comisiones y bonos adicionales para el período
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-navy">Aplicación de Deducciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Deducciones Obligatorias</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>CCSS Empleado (10.5%)</span>
                      <span className="font-mono text-teal">{formatCurrency(547379, 'CRC')}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Impuesto de Renta</span>
                      <span className="font-mono text-orange-600">{formatCurrency(16292, 'CRC')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Otras Deducciones</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Préstamos/Adelantos</span>
                      <span className="font-mono text-red-600">{formatCurrency(0, 'CRC')}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Embargos/Pensión</span>
                      <span className="font-mono text-red-600">{formatCurrency(0, 'CRC')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-navy">Previsualización de Planilla</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(5469315, 'CRC')}
                    </div>
                    <div className="text-sm text-green-600">Total Bruto</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(563671, 'CRC')}
                    </div>
                    <div className="text-sm text-orange-600">Deducciones</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 rounded-lg">
                    <div className="text-2xl font-bold text-teal-700">
                      {formatCurrency(4905644, 'CRC')}
                    </div>
                    <div className="text-sm text-teal-600">Neto a Pagar</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(1421962, 'CRC')}
                    </div>
                    <div className="text-sm text-blue-600">Cargas Patronales</div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">Revisión Final</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Revise todos los cálculos antes de proceder a la generación. 
                    Los ajustes manuales pueden realizarse empleado por empleado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-navy">Generación de Artefactos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Documentos de Planilla</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <FileText className="h-4 w-4" />
                      Generar Colillas PDF
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Download className="h-4 w-4" />
                      Resumen XLSX/CSV
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Download className="h-4 w-4" />
                      Archivo Bancario CSV
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Notificaciones</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Mail className="h-4 w-4" />
                      Enviar Colillas por Email
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Mail className="h-4 w-4" />
                      Notificar a Gerencia
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return <div>Paso no válido</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Proceso de Planilla
          </h1>
          <p className="text-muted-foreground">
            {selectedCompany?.name} - Workflow completo de nómina
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {periodConfig.status}
          </Badge>
          <Badge variant="secondary">
            Paso {currentStep} de {steps.length}
          </Badge>
        </div>
      </div>

      {/* Steps Progress */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step.current ? 'border-blue-600 bg-blue-50' :
                    step.completed ? 'border-green-600 bg-green-50' : 
                    'border-gray-300 bg-gray-50'
                  }`}>
                    {getStepIcon(step)}
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-sm font-medium ${
                      step.current ? 'text-blue-600' :
                      step.completed ? 'text-green-600' :
                      'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    steps[index + 1].completed || step.completed ? 'bg-green-300' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              disabled={currentStep === 1}
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-2">
              {currentStep < steps.length ? (
                <Button 
                  onClick={() => setCurrentStep(prev => Math.min(steps.length, prev + 1))}
                  className="gap-2 gradient-navy text-white"
                >
                  Siguiente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="gap-2 gradient-teal text-white">
                  <CheckCircle className="h-4 w-4" />
                  Finalizar Proceso
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}