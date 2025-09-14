import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Download, 
  Mail, 
  Eye,
  FileText,
  Filter,
  Archive,
  Printer
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  period: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  aguinaldo: number;
  generatedDate: string;
  status: 'generated' | 'sent' | 'viewed' | 'printed';
  emailStatus?: 'pending' | 'sent' | 'failed';
  costCenter: string;
}

export function Payslips() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const getPayslipsData = (): Payslip[] => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      return [
        {
          id: '1',
          employeeId: 'emp1',
          employeeName: 'Andrés Hidalgo Vega',
          employeeCedula: '1-074-50630',
          period: 'Setiembre 2025',
          grossSalary: 3301433,
          deductions: 400000,
          netSalary: 2901433,
          aguinaldo: 275281,
          generatedDate: '2025-09-30',
          status: 'sent',
          emailStatus: 'sent',
          costCenter: 'Administración'
        },
        {
          id: '2',
          employeeId: 'emp2',
          employeeName: 'María González Rojas',
          employeeCedula: '3-456-789',
          period: 'Setiembre 2025',
          grossSalary: 850000,
          deductions: 85000,
          netSalary: 765000,
          aguinaldo: 70833,
          generatedDate: '2025-09-30',
          status: 'generated',
          emailStatus: 'pending',
          costCenter: 'Operaciones'
        }
      ];
    }

    return [
      {
        id: '1',
        employeeId: 'emp1',
        employeeName: 'Gabriel Cordero González',
        employeeCedula: '1-1354-0838',
        period: 'Setiembre 2025',
        grossSalary: 2424480,
        deductions: 290000,
        netSalary: 2134480,
        aguinaldo: 202040,
        generatedDate: '2025-09-30',
        status: 'sent',
        emailStatus: 'sent',
        costCenter: 'Administración'
      },
      {
        id: '2',
        employeeId: 'emp2',
        employeeName: 'Krissya Paulina Gutiérrez Solís',
        employeeCedula: '1-1936-0602',
        period: 'Setiembre 2025',
        grossSalary: 606120,
        deductions: 45000,
        netSalary: 561120,
        aguinaldo: 50510,
        generatedDate: '2025-09-30',
        status: 'viewed',
        emailStatus: 'sent',
        costCenter: 'Programas'
      },
      {
        id: '3',
        employeeId: 'emp3',
        employeeName: 'David Marín Mora',
        employeeCedula: '1-1691-0435',
        period: 'Setiembre 2025',
        grossSalary: 808160,
        deductions: 60000,
        netSalary: 748160,
        aguinaldo: 67347,
        generatedDate: '2025-09-30',
        status: 'generated',
        emailStatus: 'pending',
        costCenter: 'Programas'
      }
    ];
  };

  const payslips = getPayslipsData();
  
  const filteredPayslips = payslips.filter(payslip =>
    `${payslip.employeeName} ${payslip.employeeCedula} ${payslip.period}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generated':
        return <Badge variant="secondary">Generada</Badge>;
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviada</Badge>;
      case 'viewed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Vista</Badge>;
      case 'printed':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Impresa</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailStatusBadge = (emailStatus?: string) => {
    switch (emailStatus) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Falló</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  const handleViewPayslip = (payslip: Payslip) => {
    // Generate Costa Rica payslip format
    const payslipWindow = window.open('', '_blank');
    if (payslipWindow) {
      payslipWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Colilla de Pago - ${payslip.employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #0B2B4C; }
            .payslip-title { font-size: 18px; margin: 10px 0; }
            .period { color: #2A9D8F; font-weight: bold; }
            .employee-box { border: 2px solid #333; padding: 15px; margin: 20px 0; }
            .employee-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .label { font-weight: bold; }
            .section-title { background: #0B2B4C; color: white; padding: 8px; margin: 20px 0 0 0; }
            .benefits-table, .deductions-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .benefits-table th, .benefits-table td, .deductions-table th, .deductions-table td { 
              border: 1px solid #ddd; padding: 8px; text-align: left; 
            }
            .amount { text-align: right; font-family: monospace; }
            .total-row { font-weight: bold; background: #f5f5f5; }
            .net-pay { font-size: 18px; font-weight: bold; text-align: right; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
            <div class="payslip-title">Comprobante de Pago</div>
            <div class="period">Del 01/09/2025 al 30/09/2025</div>
          </div>

          <div class="employee-box">
            <h3>Datos Generales</h3>
            <div class="employee-grid">
              <div>
                <div><span class="label">Nombre:</span> ${payslip.employeeName}</div>
                <div><span class="label">Identificación:</span> ${payslip.employeeCedula}</div>
                <div><span class="label">Centro de Costo:</span> ${payslip.costCenter}</div>
              </div>
              <div>
                <div><span class="label">Período:</span> ${payslip.period}</div>
                <div><span class="label">Fecha Generación:</span> ${formatDate(payslip.generatedDate)}</div>
                <div><span class="label">Moneda:</span> Colones (CRC)</div>
              </div>
            </div>
          </div>

          <div class="section-title">Beneficios</div>
          <table class="benefits-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Salario Mensual</td>
                <td class="amount">1.00</td>
                <td class="amount">${formatCurrency(payslip.grossSalary, 'CRC')}</td>
              </tr>
              <tr>
                <td>Aguinaldo Proporcional</td>
                <td class="amount">0.00</td>
                <td class="amount">${formatCurrency(payslip.aguinaldo, 'CRC')}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="2">Total Beneficios:</td>
                <td class="amount">${formatCurrency(payslip.grossSalary + payslip.aguinaldo, 'CRC')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="section-title">Deducciones</div>
          <table class="deductions-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>SEM Trabajador CCSS</td>
                <td class="amount">${(payslip.grossSalary * 0.055).toFixed(2)}</td>
                <td class="amount">${formatCurrency(payslip.grossSalary * 0.055, 'CRC')}</td>
              </tr>
              <tr>
                <td>IVM Trabajador CCSS</td>
                <td class="amount">${(payslip.grossSalary * 0.05).toFixed(2)}</td>
                <td class="amount">${formatCurrency(payslip.grossSalary * 0.05, 'CRC')}</td>
              </tr>
              <tr>
                <td>Impuesto de Renta</td>
                <td class="amount">0.00</td>
                <td class="amount">${formatCurrency(Math.max(0, payslip.deductions - (payslip.grossSalary * 0.105)), 'CRC')}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="2">Total Deducciones:</td>
                <td class="amount">${formatCurrency(payslip.deductions, 'CRC')}</td>
              </tr>
            </tfoot>
          </table>

          <div class="net-pay">
            Neto a Pagar: ${formatCurrency(payslip.netSalary, 'CRC')}
          </div>

          <div class="footer">
            <p>*Cálculos basados en parámetros configurables para Costa Rica.</p>
            <p>*Este comprobante no sustituye asesoría legal.</p>
            <p>Generado el ${formatDate(new Date())} por ${selectedCompany?.name}</p>
          </div>
        </body>
        </html>
      `);
      payslipWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Colillas de Pago
          </h1>
          <p className="text-muted-foreground">
            Gestión de comprobantes de pago para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Archive className="h-4 w-4" />
            ZIP Colillas
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            Envío Masivo
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <FileText className="h-4 w-4" />
            Generar Nuevas
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por empleado, cédula o período..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal">
                {payslips.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Colillas
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {payslips.filter(p => p.emailStatus === 'sent').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Enviadas
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {payslips.filter(p => p.emailStatus === 'pending').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Pendientes
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-navy">
                {formatCurrency(payslips.reduce((acc, p) => acc + p.netSalary, 0), 'CRC')}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Neto
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Colillas Generadas - Setiembre 2025</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Empleado</TableHead>
                  <TableHead className="font-semibold">Centro de Costo</TableHead>
                  <TableHead className="font-semibold text-right">Bruto</TableHead>
                  <TableHead className="font-semibold text-right">Deducciones</TableHead>
                  <TableHead className="font-semibold text-right">Neto</TableHead>
                  <TableHead className="font-semibold text-right">Aguinaldo</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Email</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayslips.map((payslip) => (
                  <TableRow key={payslip.id} className="hover:bg-muted/25">
                    <TableCell>
                      <div>
                        <div className="font-medium">{payslip.employeeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {payslip.employeeCedula}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{payslip.costCenter}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(payslip.grossSalary, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {formatCurrency(payslip.deductions, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-teal">
                      {formatCurrency(payslip.netSalary, 'CRC')}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatCurrency(payslip.aguinaldo, 'CRC')}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(payslip.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getEmailStatusBadge(payslip.emailStatus)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleViewPayslip(payslip)}
                          title="Ver colilla"
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
                          className="h-8 w-8"
                          title="Enviar por email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
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
    </div>
  );
}