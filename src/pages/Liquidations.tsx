import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CheckCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate, calculateVacationAmount, calculateAguinaldo } from "@/lib/utils";

interface Liquidation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  terminationDate: string;
  cause: string;
  withEmployerLiability: boolean;
  vacationDays: number;
  vacationAmount: number;
  aguinaldoAmount: number;
  preaviso: number;
  cesantia: number;
  pendingSalaries: number;
  finalDeductions: number;
  totalToPay: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  createdDate: string;
}

export function Liquidations() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [showNewLiquidation, setShowNewLiquidation] = useState(false);
  
  const [newLiquidation, setNewLiquidation] = useState({
    employeeId: '',
    terminationDate: new Date().toISOString().split('T')[0],
    cause: '',
    withEmployerLiability: true
  });

  const getLiquidationsData = (): Liquidation[] => {
    return [
      {
        id: '1',
        employeeId: 'emp1',
        employeeName: 'Ejemplo de Liquidación',
        employeeCedula: '1-1234-5678',
        terminationDate: '2025-09-15',
        cause: 'Renuncia voluntaria',
        withEmployerLiability: false,
        vacationDays: 15.5,
        vacationAmount: 465000,
        aguinaldoAmount: 185000,
        preaviso: 0,
        cesantia: 620000,
        pendingSalaries: 0,
        finalDeductions: 45000,
        totalToPay: 1225000,
        status: 'calculated',
        createdDate: '2025-09-10'
      }
    ];
  };

  const liquidations = getLiquidationsData();

  // Costa Rica severance calculation matrix (simplified)
  const calculateCesantia = (yearsWorked: number, monthlySalary: number) => {
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
      case 'paid':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Pagada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
              <Label htmlFor="employee">Empleado</Label>
              <Select onValueChange={(value) => setNewLiquidation(prev => ({ ...prev, employeeId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emp1">Gabriel Cordero González</SelectItem>
                  <SelectItem value="emp2">Krissya Paulina Gutiérrez Solís</SelectItem>
                  <SelectItem value="emp3">David Marín Mora</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terminationDate">Fecha de Corte</Label>
              <Input
                id="terminationDate"
                type="date"
                value={newLiquidation.terminationDate}
                onChange={(e) => setNewLiquidation(prev => ({ ...prev, terminationDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cause">Causal de Terminación</Label>
              <Select onValueChange={(value) => setNewLiquidation(prev => ({ ...prev, cause: value }))}>
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

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="withLiability"
                checked={newLiquidation.withEmployerLiability}
                onChange={(e) => setNewLiquidation(prev => ({ ...prev, withEmployerLiability: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="withLiability">Con responsabilidad patronal</Label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-navy">Cálculo Automático</h3>
            <div className="p-4 bg-muted/25 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Vacaciones Pendientes:</span>
                <span className="font-mono text-teal">15.5 días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Valor Vacaciones:</span>
                <span className="font-mono text-teal">{formatCurrency(465000, 'CRC')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Aguinaldo Proporcional:</span>
                <span className="font-mono text-teal">{formatCurrency(185000, 'CRC')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Cesantía:</span>
                <span className="font-mono text-teal">{formatCurrency(620000, 'CRC')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Preaviso:</span>
                <span className="font-mono text-orange-600">{formatCurrency(0, 'CRC')}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total a Pagar:</span>
                  <span className="font-mono text-navy">{formatCurrency(1225000, 'CRC')}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gradient-navy text-white">
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

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-800">Importante - Legislación Costarricense</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Los cálculos se basan en la matriz de cesantía vigente. Vacaciones: 1.25 días por mes trabajado.
                Aguinaldo proporcional del período 01-dic a 30-nov. Consulte con su asesor legal para casos específicos.
              </p>
            </div>
          </div>
        </div>
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
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-green-600 hover:text-green-600"
                          title="Aprobar"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
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