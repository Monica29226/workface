import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, DollarSign, Mail, FileText, Download, Calculator, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { calcularLiquidacion, ResultadoLiquidacion } from "@/lib/liquidacion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { estaBajoSalarioMinimo, getSalarioMinimoBase, getDiferenciaSalarioMinimo } from "@/lib/salariosMinimos2026";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  base_salary: number;
  hire_date: string;
}

export function Liquidations() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [motivoSalida, setMotivoSalida] = useState<'despido_con_responsabilidad' | 'despido_sin_responsabilidad' | 'renuncia'>('despido_sin_responsabilidad');
  const [preavisoTrabajado, setPreavisoTrabajado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLiquidacion | null>(null);
  const [salaryInfo, setSalaryInfo] = useState<{ amount: number; monthsUsed: number; usedFallback: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);


  // Tipo de cambio de referencia CRC→USD. Si la empresa tiene moneda base USD se usa 1.
  const EXCHANGE_RATE_REFERENCE = 510.27;
  const usdRate = selectedCompany?.base_currency === 'USD' ? 1 : EXCHANGE_RATE_REFERENCE;

  useEffect(() => {
    if (selectedCompany) {
      fetchEmployees();
    }
  }, [selectedCompany]);

  const fetchEmployees = async () => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los empleados",
        variant: "destructive",
      });
    }
  };

  const handleCalcularLiquidacion = async () => {
    const empleado = employees.find(e => e.id === selectedEmployee);
    if (!empleado || !fechaSalida) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un empleado y una fecha de salida",
        variant: "destructive",
      });
      return;
    }

    const fechaIngreso = new Date(empleado.hire_date);
    const fechaSalidaDate = new Date(fechaSalida);

    if (fechaSalidaDate <= fechaIngreso) {
      toast({
        title: "Fecha inválida",
        description: "La fecha de salida debe ser posterior a la fecha de ingreso",
        variant: "destructive",
      });
      return;
    }

    // Obtener saldo real de vacaciones pendientes del año en curso
    let diasVacacionesPendientes = 0;
    try {
      const { data: vacRows } = await (supabase as any)
        .from('employee_vacations')
        .select('days_pending')
        .eq('employee_id', empleado.id)
        .eq('year', fechaSalidaDate.getFullYear());
      diasVacacionesPendientes = (vacRows || []).reduce(
        (sum: number, r: any) => sum + Number(r.days_pending || 0),
        0
      );
    } catch (err) {
      console.error('No se pudo leer saldo de vacaciones, se usará proporcional:', err);
    }

    // Calcular salario promedio mensual de los últimos 6 meses calendario
    // (Código de Trabajo CR: liquidación se calcula sobre salario promedio ordinario).
    let salarioPromedio = empleado.base_salary;
    let monthsUsed = 0;
    let usedFallback = true;
    try {
      const seisMesesAtras = new Date(fechaSalidaDate);
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

      const { data: lines } = await (supabase as any)
        .from('payroll_lines')
        .select('gross_salary, currency, exchange_rate_to_base, payroll_batches!inner(period_start, period_end, company_id)')
        .eq('employee_id', empleado.id)
        .eq('payroll_batches.company_id', selectedCompany?.id)
        .gte('payroll_batches.period_start', seisMesesAtras.toISOString().slice(0, 10))
        .lt('payroll_batches.period_start', fechaSalidaDate.toISOString().slice(0, 10));

      // Agrupar por YYYY-MM y sumar gross_salary en CRC
      const byMonth = new Map<string, number>();
      for (const l of lines || []) {
        const pStart: string = l.payroll_batches?.period_start;
        if (!pStart) continue;
        const ym = pStart.slice(0, 7);
        const tc = Number(l.exchange_rate_to_base) || 1;
        const grossCRC = l.currency === 'USD' ? Number(l.gross_salary) * tc : Number(l.gross_salary);
        byMonth.set(ym, (byMonth.get(ym) || 0) + grossCRC);
      }

      if (byMonth.size > 0) {
        const totals = Array.from(byMonth.values());
        salarioPromedio = totals.reduce((a, b) => a + b, 0) / totals.length;
        monthsUsed = totals.length;
        usedFallback = false;
      }
    } catch (err) {
      console.error('No se pudo calcular promedio salarial; se usa base_salary:', err);
    }
    setSalaryInfo({ amount: salarioPromedio, monthsUsed, usedFallback });

    const result = calcularLiquidacion({
      fechaIngreso,
      fechaSalida: fechaSalidaDate,
      salarioPromedio,
      motivoSalida,
      preavisoTrabajado,
      diasVacacionesPendientes: diasVacacionesPendientes > 0 ? diasVacacionesPendientes : undefined,
    });

    setResultado(result);

    toast({
      title: "Liquidación calculada",
      description: usedFallback
        ? "Sin historial de planilla; se usó el salario base."
        : `Promedio de ${monthsUsed} mes(es) de planilla.`,
    });
  };


  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);

  const generateLiquidationPDF = () => {
    if (!selectedEmployeeData || !resultado) return;

    const liquidationWindow = window.open('', '_blank');
    if (liquidationWindow) {
      liquidationWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Liquidación Laboral - ${selectedEmployeeData.full_name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 40px; 
              line-height: 1.6; 
              color: #0B2B4C;
            }
            .header { 
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              border-bottom: 3px solid #2A9D8F;
              padding-bottom: 20px;
            }
            .company-logo { 
              font-size: 48px; 
              color: #2A9D8F; 
              font-weight: bold; 
            }
            .company-name { 
              font-size: 24px; 
              font-weight: bold; 
              color: #0B2B4C; 
            }
            .document-info {
              text-align: right;
            }
            .document-title { 
              font-size: 24px; 
              color: #2A9D8F;
              font-weight: bold;
              margin: 5px 0;
            }
            .subtitle { 
              color: #666; 
              font-size: 14px; 
            }
            .employee-box { 
              border: 3px solid #0B2B4C; 
              padding: 20px; 
              margin: 30px 0;
              background: #f8f9fa;
            }
            .section-title { 
              background: #2A9D8F; 
              color: white; 
              padding: 12px 15px; 
              font-weight: bold;
              font-size: 16px;
              margin: 25px 0 15px 0;
            }
            .data-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 15px;
              margin: 15px 0;
            }
            .data-row {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              border-bottom: 1px solid #ddd;
            }
            .label { 
              font-weight: bold; 
              color: #0B2B4C; 
            }
            .value {
              text-align: right;
              font-family: 'Courier New', monospace;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: left; 
            }
            th { 
              background: #f8f9fa; 
              font-weight: bold; 
              color: #0B2B4C; 
            }
            .amount { 
              text-align: right; 
              font-family: 'Courier New', monospace; 
              font-weight: 600;
            }
            .total-row { 
              font-weight: bold; 
              background: #2A9D8F; 
              color: white;
              font-size: 18px;
            }
            .detail-cell {
              color: #666;
              font-size: 14px;
              font-style: italic;
            }
            .final-box { 
              border: 3px solid #2A9D8F; 
              padding: 25px; 
              margin: 30px 0;
              text-align: center;
              background: #f0fdf4;
            }
            .final-amount {
              font-size: 36px;
              font-weight: bold;
              color: #2A9D8F;
              margin: 15px 0;
            }
            .legal-note {
              background: #fff3cd;
              border: 2px solid #ffc107;
              padding: 15px;
              margin: 25px 0;
              border-radius: 5px;
            }
            .mtss-reference {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #ddd;
            }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company-logo">${selectedCompany?.name || 'Empresa'}</div>
              <div class="company-name">${selectedCompany?.legal_name || selectedCompany?.name || ''}</div>
            </div>
            <div class="document-info">
              <div class="document-title">LIQUIDACIÓN LABORAL</div>
              <div class="subtitle">Según Código de Trabajo de Costa Rica</div>
              <div class="subtitle">Fecha de emisión: ${new Date().toLocaleDateString('es-CR')}</div>
            </div>
          </div>

          <div class="employee-box">
            <h3 style="margin-top: 0; color: #0B2B4C;">Información del Colaborador</h3>
            <div class="data-grid">
              <div>
                <div class="data-row">
                  <span class="label">Nombre Completo:</span>
                  <span class="value">${selectedEmployeeData.full_name}</span>
                </div>
                <div class="data-row">
                  <span class="label">Identificación:</span>
                  <span class="value">${selectedEmployeeData.employee_id}</span>
                </div>
                <div class="data-row">
                  <span class="label">Correo Electrónico:</span>
                  <span class="value">${selectedEmployeeData.work_email}</span>
                </div>
              </div>
              <div>
                <div class="data-row">
                  <span class="label">Fecha de Ingreso:</span>
                  <span class="value">${new Date(selectedEmployeeData.hire_date).toLocaleDateString('es-CR')}</span>
                </div>
                <div class="data-row">
                  <span class="label">Fecha de Salida:</span>
                  <span class="value">${new Date(fechaSalida).toLocaleDateString('es-CR')}</span>
                </div>
                <div class="data-row">
                  <span class="label">Tiempo Laborado:</span>
                  <span class="value">${resultado.añosTrabajados} años, ${resultado.mesesTrabajados % 12} meses</span>
                </div>
                <div class="data-row">
                  <span class="label">Salario Base:</span>
                  <span class="value">${formatCurrency(selectedEmployeeData.base_salary, 'CRC')}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section-title">Detalle de Liquidación</div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Base Legal</th>
                <th class="amount">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Preaviso</strong>
                  <div class="detail-cell">${resultado.detalles.preaviso}</div>
                </td>
                <td class="detail-cell">Art. 28 Código de Trabajo</td>
                <td class="amount">${formatCurrency(resultado.preaviso, 'CRC')}</td>
              </tr>
              <tr>
                <td>
                  <strong>Cesantía</strong>
                  <div class="detail-cell">${resultado.detalles.cesantia}</div>
                </td>
                <td class="detail-cell">Art. 29 Código de Trabajo</td>
                <td class="amount">${formatCurrency(resultado.cesantia, 'CRC')}</td>
              </tr>
              <tr>
                <td>
                  <strong>Vacaciones Proporcionales</strong>
                  <div class="detail-cell">${resultado.detalles.vacaciones}</div>
                </td>
                <td class="detail-cell">Art. 153-159 Código de Trabajo</td>
                <td class="amount">${formatCurrency(resultado.vacaciones, 'CRC')}</td>
              </tr>
              <tr>
                <td>
                  <strong>Aguinaldo Proporcional</strong>
                  <div class="detail-cell">${resultado.detalles.aguinaldo}</div>
                </td>
                <td class="detail-cell">Ley 2412</td>
                <td class="amount">${formatCurrency(resultado.aguinaldo, 'CRC')}</td>
              </tr>
              <tr class="total-row">
                <td colspan="2"><strong>TOTAL A PAGAR</strong></td>
                <td class="amount">${formatCurrency(resultado.total, 'CRC')}</td>
              </tr>
            </tbody>
          </table>

          <div class="legal-note">
            <strong>⚠️ Nota Importante:</strong><br>
            Este cálculo se basa en las disposiciones del Código de Trabajo de Costa Rica y 
            la calculadora del Ministerio de Trabajo y Seguridad Social (MTSS). Los montos son 
            estimados y pueden variar según circunstancias particulares del caso.
          </div>

          <div class="final-box">
            <h2 style="margin-top: 0; color: #0B2B4C;">Monto Total de Liquidación</h2>
            <div class="final-amount">${formatCurrency(resultado.total, 'CRC')}</div>
            <p style="color: #666; margin-top: 20px;">
              (${new Intl.NumberFormat('es-CR', {
                style: 'currency',
                currency: 'USD'
              }).format(resultado.total / usdRate)})
              <br/>
              <small style="font-size:11px;color:#888;">Tipo de cambio de referencia: ${usdRate.toFixed(2)} CRC/USD</small>
            </p>
          </div>

          <div class="mtss-reference">
            <p>Cálculo realizado según la metodología del Ministerio de Trabajo y Seguridad Social</p>
            <p><strong>Referencia:</strong> https://www.mtss.go.cr/buscador/Liquidacion.aspx</p>
            <p style="margin-top: 10px;">
              Este documento es informativo y no constituye un documento legal oficial.<br>
              Para consultas específicas, contactar al Ministerio de Trabajo y Seguridad Social.
            </p>
          </div>

          <div style="margin-top: 50px; text-align: center;">
            <button onclick="window.print()" style="
              background: #2A9D8F;
              color: white;
              border: none;
              padding: 15px 40px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              margin-right: 10px;
              font-weight: bold;
            ">Imprimir Documento</button>
            <button onclick="window.close()" style="
              background: #0B2B4C;
              color: white;
              border: none;
              padding: 15px 40px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: bold;
            ">Cerrar Ventana</button>
          </div>
        </body>
        </html>
      `);
      liquidationWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Calculadora de Liquidaciones</h1>
          <p className="text-muted-foreground">
            Según el Ministerio de Trabajo y Seguridad Social de Costa Rica
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Esta calculadora utiliza la metodología oficial del MTSS para calcular: <strong>preaviso, cesantía, vacaciones y aguinaldo</strong> según el Código de Trabajo de Costa Rica.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Datos para el Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Empleado *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Salida *</Label>
              <Input
                type="date"
                value={fechaSalida}
                onChange={(e) => setFechaSalida(e.target.value)}
              />
            </div>
          </div>

          {selectedEmployeeData && (
            <>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-semibold">Información del Empleado</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fecha de Ingreso:</span>
                    <p className="font-medium">{new Date(selectedEmployeeData.hire_date).toLocaleDateString('es-CR')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Salario Base:</span>
                    <p className="font-medium">{formatCurrency(selectedEmployeeData.base_salary, 'CRC')}</p>
                  </div>
                </div>
              </div>

              {estaBajoSalarioMinimo(selectedEmployeeData.base_salary) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>⚠️ Salario por debajo del mínimo legal</AlertTitle>
                  <AlertDescription>
                    El salario de este empleado ({formatCurrency(selectedEmployeeData.base_salary, 'CRC')}) está <strong>{formatCurrency(getDiferenciaSalarioMinimo(selectedEmployeeData.base_salary), 'CRC')}</strong> por debajo del salario mínimo legal vigente para Costa Rica 2025.
                    <br />
                    <br />
                    <strong>Salario mínimo (Trabajador No Calificado): {formatCurrency(getSalarioMinimoBase(), 'CRC')}</strong>
                    <br />
                    <br />
                    Según el Ministerio de Trabajo y Seguridad Social, todos los trabajadores deben recibir al menos el salario mínimo correspondiente a su categoría ocupacional. Esto podría resultar en sanciones legales para el empleador.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo de Salida *</Label>
              <Select value={motivoSalida} onValueChange={(value: any) => setMotivoSalida(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despido_sin_responsabilidad">
                    Despido con responsabilidad patronal (sin justa causa) — SÍ paga cesantía
                  </SelectItem>
                  <SelectItem value="despido_con_responsabilidad">
                    Despido con justa causa (falta del trabajador) — NO paga cesantía
                  </SelectItem>
                  <SelectItem value="renuncia">
                    Renuncia voluntaria — NO paga cesantía
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="preaviso"
                checked={preavisoTrabajado}
                onCheckedChange={(checked) => setPreavisoTrabajado(checked as boolean)}
              />
              <label
                htmlFor="preaviso"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                El preaviso fue trabajado (no se paga)
              </label>
            </div>
          </div>

          <Button 
            onClick={handleCalcularLiquidacion}
            className="w-full bg-navy hover:bg-navy/90 text-white"
            size="lg"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Calcular Liquidación
          </Button>
        </CardContent>
      </Card>

      {resultado && selectedEmployeeData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resultado del Cálculo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Tiempo Laborado</div>
                    <div className="text-2xl font-bold text-primary">
                      {resultado.añosTrabajados} años
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {resultado.mesesTrabajados} meses totales
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Días Trabajados</div>
                    <div className="text-2xl font-bold text-primary">
                      {resultado.diasTrabajados}
                    </div>
                    <div className="text-sm text-muted-foreground">días</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <div className="text-sm text-muted-foreground">Total a Pagar</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(resultado.total, 'CRC')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ≈ {formatCurrency(resultado.total / usdRate, 'USD')}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Preaviso</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {resultado.detalles.preaviso}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(resultado.preaviso, 'CRC')}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Cesantía</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {resultado.detalles.cesantia}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(resultado.cesantia, 'CRC')}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Vacaciones</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {resultado.detalles.vacaciones}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(resultado.vacaciones, 'CRC')}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Aguinaldo</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {resultado.detalles.aguinaldo}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(resultado.aguinaldo, 'CRC')}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono text-lg text-primary">
                        {formatCurrency(resultado.total, 'CRC')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              onClick={generateLiquidationPDF}
              className="flex-1 gap-2"
              size="lg"
            >
              <Download className="h-4 w-4" />
              Generar PDF
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              size="lg"
              disabled={isSendingEmail || !selectedEmployeeData?.work_email}
              onClick={async () => {
                if (!selectedEmployeeData || !resultado) return;
                if (!selectedEmployeeData.work_email) {
                  toast({
                    title: "Sin correo",
                    description: "El colaborador no tiene correo registrado",
                    variant: "destructive",
                  });
                  return;
                }
                setIsSendingEmail(true);
                try {
                  const row = (concept: string, detail: string, amount: number) => `
                    <tr>
                      <td style="padding:8px;border-bottom:1px solid #eee"><strong>${concept}</strong><br/><span style="color:#666;font-size:12px">${detail}</span></td>
                      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${formatCurrency(amount, 'CRC')}</td>
                    </tr>`;
                  const html = `
                    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0B2B4C">
                      <h2 style="color:#0B2B4C">Liquidación Laboral</h2>
                      <p>Hola <strong>${selectedEmployeeData.full_name}</strong>,</p>
                      <p>Adjuntamos el detalle de su liquidación calculado según el Código de Trabajo de Costa Rica:</p>
                      <table style="width:100%;border-collapse:collapse;margin-top:12px">
                        <thead>
                          <tr style="background:#0B2B4C;color:#fff">
                            <th style="padding:10px;text-align:left">Concepto</th>
                            <th style="padding:10px;text-align:right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${row('Preaviso', resultado.detalles.preaviso, resultado.preaviso)}
                          ${row('Cesantía', resultado.detalles.cesantia, resultado.cesantia)}
                          ${row('Vacaciones', resultado.detalles.vacaciones, resultado.vacaciones)}
                          ${row('Aguinaldo', resultado.detalles.aguinaldo, resultado.aguinaldo)}
                          <tr style="background:#F5EFE6">
                            <td style="padding:10px"><strong>TOTAL A PAGAR</strong></td>
                            <td style="padding:10px;text-align:right;font-family:monospace;font-size:16px"><strong>${formatCurrency(resultado.total, 'CRC')}</strong></td>
                          </tr>
                        </tbody>
                      </table>
                      <p style="margin-top:16px;font-size:12px;color:#666">
                        Equivalente referencial: ${formatCurrency(resultado.total / usdRate, 'USD')} (TC ${usdRate.toFixed(2)} CRC/USD)
                      </p>
                      <p style="margin-top:20px;font-size:12px;color:#888">
                        ${selectedCompany?.name || ''} · Documento informativo basado en la metodología MTSS.
                      </p>
                    </div>`;

                  const { error } = await supabase.functions.invoke('send-email', {
                    body: {
                      to: [selectedEmployeeData.work_email],
                      subject: `Liquidación Laboral - ${selectedEmployeeData.full_name}`,
                      html,
                      companyId: selectedCompany?.id,
                    },
                  });
                  if (error) throw error;
                  toast({
                    title: "Correo enviado",
                    description: `Liquidación enviada a ${selectedEmployeeData.work_email}`,
                  });
                } catch (err: any) {
                  toast({
                    title: "Error al enviar",
                    description: err?.message ?? "No se pudo enviar el correo",
                    variant: "destructive",
                  });
                } finally {
                  setIsSendingEmail(false);
                }
              }}
            >
              <Mail className="h-4 w-4" />
              {isSendingEmail ? "Enviando..." : "Enviar por Correo"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}