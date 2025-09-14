import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Calculator, 
  FileText, 
  Download, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Mail,
  Edit,
  Save,
  ArrowLeft,
  ArrowRight,
  X,
  Info,
  History,
  Building2,
  User,
  Calendar,
  DollarSign,
  HelpCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Main liquidation interface for display
interface Liquidation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  terminationDate: string;
  cause: string;
  vacationAmount: number;
  aguinaldoAmount: number;
  preaviso: number;
  cesantia: number;
  totalToPay: number;
  status: 'draft' | 'calculated' | 'approved' | 'closed';
  createdDate: string;
}

export function Liquidaciones() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [showNewLiquidation, setShowNewLiquidation] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [cause, setCause] = useState('');

  // Sample employees data
  const employees = [
    {
      id: 'emp1',
      name: 'Gabriel Cordero González',
      cedula: '1-1354-0838',
      email: 'gabriel.cordero@horizontepositivo.org',
      position: 'Director Ejecutivo',
      department: 'Administración',
      hireDate: '2020-01-15',
      monthlySalary: 2424480
    },
    {
      id: 'emp2',
      name: 'Krissya Paulina Gutiérrez Solís',
      cedula: '1-1936-0602',
      email: 'krissya.gutierrez@horizontepositivo.org',
      position: 'Soporte Interno',
      department: 'Programas',
      hireDate: '2021-03-01',
      monthlySalary: 606120
    }
  ];

  // Sample liquidations data
  useEffect(() => {
    setLiquidations([
      {
        id: '1',
        employeeId: 'emp1',
        employeeName: 'Gabriel Cordero González',
        employeeCedula: '1-1354-0838',
        terminationDate: '2025-09-15',
        cause: 'Renuncia voluntaria',
        vacationAmount: 465000,
        aguinaldoAmount: 185000,
        preaviso: 0,
        cesantia: 620000,
        totalToPay: 1225000,
        status: 'calculated',
        createdDate: '2025-09-10'
      }
    ]);
  }, []);

  // Calculation functions
  const calculateYearsWorked = (hireDate: string, terminationDate: string): number => {
    const start = new Date(hireDate);
    const end = new Date(terminationDate);
    return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  };

  const calculateVacationDays = (hireDate: string, terminationDate: string): number => {
    const yearsWorked = calculateYearsWorked(hireDate, terminationDate);
    return yearsWorked * 12 * 1.25; // 1.25 days per month
  };

  const calculateSeverance = (yearsWorked: number, monthlySalary: number): number => {
    let severanceDays = 0;
    
    if (yearsWorked >= 1 && yearsWorked < 2) severanceDays = 19.5;
    else if (yearsWorked >= 2 && yearsWorked < 3) severanceDays = 20;
    else if (yearsWorked >= 3 && yearsWorked < 4) severanceDays = 20.5;
    else if (yearsWorked >= 4 && yearsWorked < 5) severanceDays = 21;
    else if (yearsWorked >= 5) severanceDays = 21.24;
    
    const dailySalary = monthlySalary / 30;
    const maxAmount = 8 * monthlySalary; // Maximum 8 salaries in Costa Rica
    
    return Math.min(severanceDays * dailySalary, maxAmount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Borrador</Badge>;
      case 'calculated':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Calculada</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprobada</Badge>;
      case 'closed':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Cerrada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCalculate = () => {
    if (!selectedEmployee || !terminationDate || !cause) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;

    const yearsWorked = calculateYearsWorked(employee.hireDate, terminationDate);
    const vacationDays = calculateVacationDays(employee.hireDate, terminationDate);
    const dailySalary = employee.monthlySalary / 30;
    const vacationAmount = Math.round(vacationDays * dailySalary);
    const aguinaldoAmount = Math.round((employee.monthlySalary * Math.min(yearsWorked * 12, 12)) / 12);
    const cesantiaAmount = calculateSeverance(yearsWorked, employee.monthlySalary);
    const totalToPay = vacationAmount + aguinaldoAmount + cesantiaAmount;

    const newLiquidation: Liquidation = {
      id: Date.now().toString(),
      employeeId: selectedEmployee,
      employeeName: employee.name,
      employeeCedula: employee.cedula,
      terminationDate,
      cause,
      vacationAmount,
      aguinaldoAmount,
      preaviso: 0,
      cesantia: Math.round(cesantiaAmount),
      totalToPay: Math.round(totalToPay),
      status: 'calculated',
      createdDate: new Date().toISOString().split('T')[0]
    };

    setLiquidations(prev => [...prev, newLiquidation]);
    setShowNewLiquidation(false);
    setSelectedEmployee('');
    setCause('');

    toast({
      title: "Liquidación calculada",
      description: `Liquidación para ${employee.name} calculada correctamente.`,
    });
  };

  const handleGeneratePDF = (liquidation: Liquidation) => {
    const employee = employees.find(e => e.id === liquidation.employeeId);
    if (!employee) return;

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow) {
      pdfWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Carta de Liquidación - ${employee.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0B2B4C; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; color: #0B2B4C; }
            .company-logo { color: #2A9D8F; font-size: 20px; margin-bottom: 10px; }
            .title { font-size: 18px; margin: 20px 0; color: #2A9D8F; text-align: center; }
            .employee-info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #2A9D8F; }
            .calculation-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .calculation-table th, .calculation-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .calculation-table th { background: #f8f9fa; font-weight: bold; }
            .amount { text-align: right; font-family: monospace; }
            .total-row { background: #e9ecef; font-weight: bold; }
            .signature-section { margin-top: 50px; }
            .signature-box { border: 1px solid #ccc; height: 80px; margin: 20px 0; position: relative; }
            .signature-label { position: absolute; bottom: 5px; left: 10px; font-size: 12px; color: #666; }
            .footer { margin-top: 40px; font-size: 11px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-logo">Horizonte +</div>
            <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
            <div>Cédula Jurídica: ${selectedCompany?.juridical_id || 'N/A'}</div>
          </div>

          <div class="title">CARTA DE LIQUIDACIÓN LABORAL</div>

          <div class="employee-info">
            <h3>DATOS DEL COLABORADOR</h3>
            <p><strong>Nombre:</strong> ${employee.name}</p>
            <p><strong>Cédula:</strong> ${employee.cedula}</p>
            <p><strong>Puesto:</strong> ${employee.position}</p>
            <p><strong>Fecha de Ingreso:</strong> ${formatDate(employee.hireDate)}</p>
            <p><strong>Fecha de Corte:</strong> ${formatDate(liquidation.terminationDate)}</p>
            <p><strong>Causal:</strong> ${liquidation.cause}</p>
            <p><strong>Salario Mensual:</strong> ${formatCurrency(employee.monthlySalary, 'CRC')}</p>
          </div>

          <table class="calculation-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Vacaciones no disfrutadas</td>
                <td class="amount">${formatCurrency(liquidation.vacationAmount, 'CRC')}</td>
              </tr>
              <tr>
                <td>Aguinaldo proporcional</td>
                <td class="amount">${formatCurrency(liquidation.aguinaldoAmount, 'CRC')}</td>
              </tr>
              ${liquidation.cesantia > 0 ? `
              <tr>
                <td>Cesantía</td>
                <td class="amount">${formatCurrency(liquidation.cesantia, 'CRC')}</td>
              </tr>` : ''}
              <tr class="total-row">
                <td><strong>TOTAL A PAGAR</strong></td>
                <td class="amount"><strong>${formatCurrency(liquidation.totalToPay, 'CRC')}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <p>En conformidad con lo anterior, las partes firman la presente liquidación:</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px;">
              <div>
                <div class="signature-box">
                  <div class="signature-label">Firma del Colaborador</div>
                </div>
                <p style="text-align: center; margin-top: 10px;">${employee.name}</p>
                <p style="text-align: center;">Cédula: ${employee.cedula}</p>
              </div>
              
              <div>
                <div class="signature-box">
                  <div class="signature-label">Representante de la Empresa</div>
                </div>
                <p style="text-align: center; margin-top: 10px;">${selectedCompany?.name}</p>
                <p style="text-align: center;">Cédula Jurídica: ${selectedCompany?.juridical_id}</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Nota Legal:</strong> Esta liquidación se calcula con base en la legislación laboral costarricense vigente.</p>
            <p>Generado el ${formatDate(new Date().toISOString())} por ${selectedCompany?.name}</p>
          </div>
        </body>
        </html>
      `);
      pdfWindow.document.close();
    }
  };

  const renderLiquidationCalculator = () => (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-navy flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculadora de Liquidación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Empleado *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} - {employee.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terminationDate">Fecha de Corte *</Label>
              <Input
                id="terminationDate"
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cause">Causal de Terminación *</Label>
              <Select value={cause} onValueChange={setCause}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar causal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renuncia">Renuncia Voluntaria</SelectItem>
                  <SelectItem value="despido_con_causa">Despido con Responsabilidad Patronal</SelectItem>
                  <SelectItem value="despido_sin_causa">Despido sin Responsabilidad Patronal</SelectItem>
                  <SelectItem value="mutuo_acuerdo">Mutuo Acuerdo</SelectItem>
                  <SelectItem value="vencimiento">Vencimiento de Contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {selectedEmployee && (
              <Card className="p-4 bg-muted/25">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información del Empleado
                </h4>
                {(() => {
                  const employee = employees.find(e => e.id === selectedEmployee);
                  if (!employee) return null;
                  
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Nombre:</span>
                        <span className="font-medium">{employee.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Puesto:</span>
                        <span className="font-medium">{employee.position}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fecha Ingreso:</span>
                        <span className="font-medium">{formatDate(employee.hireDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Salario Mensual:</span>
                        <span className="font-medium">{formatCurrency(employee.monthlySalary, 'CRC')}</span>
                      </div>
                      {terminationDate && (
                        <>
                          <Separator className="my-2" />
                          <div className="flex justify-between">
                            <span>Antigüedad:</span>
                            <span className="font-medium">
                              {calculateYearsWorked(employee.hireDate, terminationDate).toFixed(2)} años
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Salario Diario:</span>
                            <span className="font-medium">
                              {formatCurrency(employee.monthlySalary / 30, 'CRC')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            <div className="flex gap-2">
              <Button 
                className="flex-1 gradient-navy text-white"
                onClick={handleCalculate}
                disabled={!selectedEmployee || !terminationDate || !cause}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calcular
              </Button>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Vista Previa
              </Button>
            </div>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante - Legislación Costarricense:</strong> Los cálculos se basan en la matriz de cesantía vigente. 
            Vacaciones: 1.25 días por mes trabajado. Aguinaldo proporcional del período 01-dic a 30-nov. 
            Consulte con su asesor legal para casos específicos.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Liquidaciones
          </h1>
          <p className="text-muted-foreground">
            Cálculo de prestaciones laborales - {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowNewLiquidation(!showNewLiquidation)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Liquidación
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* New Liquidation Form */}
      {showNewLiquidation && renderLiquidationCalculator()}

      {/* Liquidations Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Liquidaciones Generadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Empleado</TableHead>
                  <TableHead className="font-semibold">Fecha Corte</TableHead>
                  <TableHead className="font-semibold">Causal</TableHead>
                  <TableHead className="font-semibold text-right">Vacaciones</TableHead>
                  <TableHead className="font-semibold text-right">Aguinaldo</TableHead>
                  <TableHead className="font-semibold text-right">Cesantía</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.map((liquidation) => (
                  <TableRow key={liquidation.id} className="hover:bg-muted/25">
                    <TableCell>
                      <div>
                        <div className="font-medium">{liquidation.employeeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {liquidation.employeeCedula}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(liquidation.terminationDate)}</TableCell>
                    <TableCell>{liquidation.cause}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.vacationAmount, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.aguinaldoAmount, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(liquidation.cesantia, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-navy">
                      {formatCurrency(liquidation.totalToPay, 'CRC')}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(liquidation.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleGeneratePDF(liquidation)}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Enviar por correo"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        {liquidation.status === 'calculated' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            title="Aprobar"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legal Information */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Matriz de Cesantía - Costa Rica 2025</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Años de Servicio - Días de Cesantía</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>1 año a menos de 2:</span>
                  <span className="font-mono">19.5 días</span>
                </div>
                <div className="flex justify-between">
                  <span>2 años a menos de 3:</span>
                  <span className="font-mono">20 días</span>
                </div>
                <div className="flex justify-between">
                  <span>3 años a menos de 4:</span>
                  <span className="font-mono">20.5 días</span>
                </div>
                <div className="flex justify-between">
                  <span>4 años a menos de 5:</span>
                  <span className="font-mono">21 días</span>
                </div>
                <div className="flex justify-between">
                  <span>5 años o más:</span>
                  <span className="font-mono">21.24 días</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Límites y Consideraciones</h4>
              <div className="space-y-2 text-sm">
                <p>• <strong>Tope máximo:</strong> 8 salarios mensuales</p>
                <p>• <strong>Vacaciones:</strong> 1.25 días por mes trabajado</p>
                <p>• <strong>Aguinaldo:</strong> Proporcional del período</p>
                <p>• <strong>Preaviso:</strong> Según causal de despido</p>
                <p className="text-muted-foreground italic">
                  *Los cálculos son referenciales. Consulte asesoría legal.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}