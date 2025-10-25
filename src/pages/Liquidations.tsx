import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, DollarSign, Mail, FileText, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PayrollLine {
  id: string;
  gross_salary: number;
  deductions: number;
  net_pay: number;
  aguinaldo_accrued: number;
  period_start: string;
  period_end: string;
  currency: string;
  exchange_rate_to_base: number;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  base_salary: number;
}

export function Liquidations() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [payrollHistory, setPayrollHistory] = useState<PayrollLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      fetchEmployees();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedEmployee && selectedYear) {
      fetchPayrollHistory();
    }
  }, [selectedEmployee, selectedYear]);

  const fetchEmployees = async () => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'activo')
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

  const fetchPayrollHistory = async () => {
    if (!selectedEmployee || !selectedCompany) return;

    setIsLoading(true);
    try {
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from('payroll_lines')
        .select(`
          *,
          batch:payroll_batches(
            period_start,
            period_end,
            status
          )
        `)
        .eq('employee_id', selectedEmployee)
        .eq('company_id', selectedCompany.id)
        .gte('batch.period_start', yearStart)
        .lte('batch.period_end', yearEnd)
        .order('batch.period_start', { ascending: true });

      if (error) throw error;

      const transformedData = (data || []).map((line: any) => ({
        id: line.id,
        gross_salary: Number(line.gross_salary),
        deductions: Number(line.deductions),
        net_pay: Number(line.net_pay),
        aguinaldo_accrued: Number(line.aguinaldo_accrued || 0),
        period_start: line.batch.period_start,
        period_end: line.batch.period_end,
        currency: line.currency,
        exchange_rate_to_base: Number(line.exchange_rate_to_base)
      }));

      setPayrollHistory(transformedData);
    } catch (error) {
      console.error('Error fetching payroll history:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de planillas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAguinaldo = () => {
    if (payrollHistory.length === 0) return 0;
    
    const totalGross = payrollHistory.reduce((sum, line) => sum + line.gross_salary, 0);
    const monthsWorked = payrollHistory.length;
    
    // Aguinaldo = promedio mensual * (meses trabajados / 12)
    const averageMonthly = totalGross / monthsWorked;
    const aguinaldo = (averageMonthly * monthsWorked) / 12;
    
    return aguinaldo;
  };

  const calculateTotals = () => {
    const totalGross = payrollHistory.reduce((sum, line) => sum + line.gross_salary, 0);
    const totalDeductions = payrollHistory.reduce((sum, line) => sum + line.deductions, 0);
    const totalNet = payrollHistory.reduce((sum, line) => sum + line.net_pay, 0);
    const aguinaldo = calculateAguinaldo();
    
    return {
      totalGross,
      totalDeductions,
      totalNet,
      aguinaldo,
      monthsWorked: payrollHistory.length
    };
  };

  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);
  const totals = calculateTotals();

  const generateLiquidationPDF = () => {
    if (!selectedEmployeeData) return;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const liquidationWindow = window.open('', '_blank');
    if (liquidationWindow) {
      liquidationWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Liquidación - ${selectedEmployeeData.full_name}</title>
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
              font-size: 20px; 
              color: #2A9D8F;
              margin: 5px 0;
            }
            .period { 
              color: #0B2B4C; 
              font-size: 14px; 
            }
            .employee-box { 
              border: 3px solid #0B2B4C; 
              padding: 20px; 
              margin: 30px 0;
            }
            .section-title { 
              background: #2A9D8F; 
              color: white; 
              padding: 10px 15px; 
              font-weight: bold;
              font-size: 16px;
              margin: 20px 0 0 0;
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
              padding: 8px 0;
              border-bottom: 1px solid #e0e0e0;
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
            }
            .total-row { 
              font-weight: bold; 
              background: #e9ecef; 
              font-size: 16px;
            }
            .aguinaldo-highlight {
              background: #d4edda;
              font-weight: bold;
              color: #155724;
            }
            .final-box { 
              border: 3px solid #2A9D8F; 
              padding: 20px; 
              margin: 30px 0;
              text-align: center;
            }
            .final-amount {
              font-size: 28px;
              font-weight: bold;
              color: #2A9D8F;
              margin: 10px 0;
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
              <div class="company-logo">Horizonte +</div>
              <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
            </div>
            <div class="document-info">
              <div class="document-title">Liquidación Laboral</div>
              <div class="period">Año ${selectedYear}</div>
              <div class="period">Fecha: ${new Date().toLocaleDateString('es-CR')}</div>
            </div>
          </div>

          <div class="employee-box">
            <h3 style="margin-top: 0; color: #0B2B4C;">Datos del Empleado</h3>
            <div class="data-grid">
              <div>
                <div class="data-row">
                  <span class="label">Nombre:</span>
                  <span class="value">${selectedEmployeeData.full_name}</span>
                </div>
                <div class="data-row">
                  <span class="label">Identificación:</span>
                  <span class="value">${selectedEmployeeData.employee_id}</span>
                </div>
              </div>
              <div>
                <div class="data-row">
                  <span class="label">Correo:</span>
                  <span class="value">${selectedEmployeeData.work_email}</span>
                </div>
                <div class="data-row">
                  <span class="label">Meses trabajados:</span>
                  <span class="value">${totals.monthsWorked} meses</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section-title">Detalle de Salarios del Año ${selectedYear}</div>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th class="amount">Salario Bruto</th>
                <th class="amount">Deducciones</th>
                <th class="amount">Salario Neto</th>
              </tr>
            </thead>
            <tbody>
              ${payrollHistory.map(line => {
                const date = new Date(line.period_start);
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `
                  <tr>
                    <td>${month} ${year}</td>
                    <td class="amount">${formatCurrency(line.gross_salary, line.currency)}</td>
                    <td class="amount">${formatCurrency(line.deductions, line.currency)}</td>
                    <td class="amount">${formatCurrency(line.net_pay, line.currency)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td>TOTALES</td>
                <td class="amount">${formatCurrency(totals.totalGross, 'CRC')}</td>
                <td class="amount">${formatCurrency(totals.totalDeductions, 'CRC')}</td>
                <td class="amount">${formatCurrency(totals.totalNet, 'CRC')}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Cálculo de Aguinaldo</div>
          <table>
            <tbody>
              <tr>
                <td class="label">Total Salarios Brutos del Año</td>
                <td class="amount">${formatCurrency(totals.totalGross, 'CRC')}</td>
              </tr>
              <tr>
                <td class="label">Meses Trabajados</td>
                <td class="amount">${totals.monthsWorked} meses</td>
              </tr>
              <tr>
                <td class="label">Promedio Mensual</td>
                <td class="amount">${formatCurrency(totals.totalGross / totals.monthsWorked, 'CRC')}</td>
              </tr>
              <tr class="aguinaldo-highlight">
                <td class="label">AGUINALDO (1/12 por mes trabajado)</td>
                <td class="amount">${formatCurrency(totals.aguinaldo, 'CRC')}</td>
              </tr>
            </tbody>
          </table>

          <div class="final-box">
            <h2 style="margin-top: 0; color: #0B2B4C;">Total de Liquidación</h2>
            <div class="final-amount">${formatCurrency(totals.aguinaldo, 'CRC')}</div>
            <p style="color: #666; margin-top: 20px;">
              Este documento certifica el cálculo de liquidación correspondiente<br>
              al período del 01 de enero al 31 de diciembre de ${selectedYear}
            </p>
          </div>

          <div style="margin-top: 50px; text-align: center;">
            <button onclick="window.print()" style="
              background: #2A9D8F;
              color: white;
              border: none;
              padding: 12px 30px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
              margin-right: 10px;
            ">Imprimir</button>
            <button onclick="window.close()" style="
              background: #0B2B4C;
              color: white;
              border: none;
              padding: 12px 30px;
              font-size: 16px;
              border-radius: 5px;
              cursor: pointer;
            ">Cerrar</button>
          </div>
        </body>
        </html>
      `);
      liquidationWindow.document.close();
    }
  };

  const handleSendEmail = async () => {
    if (!selectedEmployeeData) return;

    setIsSendingEmail(true);
    try {
      toast({
        title: "Función no implementada",
        description: "Para enviar correos, necesitas configurar Resend. Ve a Settings y agrega RESEND_API_KEY como secreto.",
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Liquidaciones</h1>
          <p className="text-muted-foreground">
            Calcula aguinaldos y genera liquidaciones laborales
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Empleado y Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Empleado</Label>
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
              <Label>Año</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        </div>
      ) : selectedEmployee && payrollHistory.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Historial de Planillas {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Salario Bruto</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Salario Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollHistory.map((line, index) => {
                    const date = new Date(line.period_start);
                    const monthNames = [
                      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ];
                    const period = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{period}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.gross_salary, line.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.deductions, line.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.net_pay, line.currency)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold bg-muted">
                    <TableCell>TOTALES</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalGross, 'CRC')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalDeductions, 'CRC')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalNet, 'CRC')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cálculo de Aguinaldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Salarios Brutos</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.totalGross, 'CRC')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Meses Trabajados</p>
                    <p className="text-2xl font-bold">{totals.monthsWorked} meses</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Promedio Mensual</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.totalGross / totals.monthsWorked, 'CRC')}</p>
                  </div>
                  <div className="col-span-2 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-500">
                    <p className="text-sm text-muted-foreground">Aguinaldo (1/12 por mes trabajado)</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.aguinaldo, 'CRC')}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={generateLiquidationPDF} className="flex-1">
                    <FileText className="mr-2 h-4 w-4" />
                    Ver Liquidación
                  </Button>
                  <Button 
                    onClick={handleSendEmail} 
                    disabled={isSendingEmail}
                    variant="outline"
                    className="flex-1"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {isSendingEmail ? "Enviando..." : "Enviar por Correo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : selectedEmployee ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay registros de planilla para este empleado en {selectedYear}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecciona un empleado para ver su liquidación</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
