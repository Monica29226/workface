import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Printer,
  Edit,
  Send,
  Calendar,
  DollarSign,
  Building2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCedula: string;
  email: string;
  position: string;
  period: string;
  month: number;
  year: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  aguinaldo: number;
  generatedDate: string;
  status: 'generated' | 'sent' | 'viewed' | 'printed';
  emailStatus?: 'pending' | 'sent' | 'failed';
  costCenter: string;
  exchangeRate: number;
  currency: 'CRC' | 'USD';
  // Detailed breakdown
  benefits: {
    baseSalary: number;
    overtime: number;
    extraHours: number;
    bonuses: number;
  };
  deductionBreakdown: {
    ccss_employee: number;
    ccss_ivm: number;
    income_tax: number;
    loan_deduction: number;
    other: number;
  };
}

export function Payslips() {
  const { t } = useLanguage();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD' | 'BOTH'>('CRC');
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCompanyEditOpen, setIsCompanyEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(selectedCompany);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (selectedCompany) {
      fetchPayslips();
    }
  }, [selectedCompany, selectedYear]);

  const fetchPayslips = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    try {
      // Fetch payroll lines with batch and employee data
      const { data, error } = await supabase
        .from('payroll_lines')
        .select(`
          *,
          batch:payroll_batches(
            batch_id,
            period_start,
            period_end,
            status
          ),
          employee:employees(
            employee_id,
            full_name,
            work_email
          )
        `)
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to Payslip format
      const transformedPayslips: Payslip[] = (data || []).map((line: any) => {
        const periodStart = new Date(line.batch.period_start);
        const month = periodStart.getMonth() + 1;
        const year = periodStart.getFullYear();
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        return {
          id: line.id,
          employeeId: line.employee.employee_id,
          employeeName: line.employee.full_name,
          employeeCedula: line.employee.employee_id, // Using employee_id as placeholder
          email: line.employee.work_email,
          position: 'Programas', // Placeholder
          period: `${monthNames[month - 1]} ${year}`,
          month,
          year,
          grossSalary: Number(line.gross_salary),
          deductions: Number(line.deductions),
          netSalary: Number(line.net_pay),
          aguinaldo: Number(line.aguinaldo_accrued || 0),
          generatedDate: line.created_at,
          status: line.batch.status === 'aprobado' ? 'sent' : 'generated',
          emailStatus: line.batch.status === 'aprobado' ? 'sent' : 'pending',
          costCenter: 'Programas',
          exchangeRate: Number(line.exchange_rate_to_base),
          currency: line.currency,
          benefits: {
            baseSalary: Number(line.gross_salary),
            overtime: Number(line.overtime || 0),
            extraHours: 0,
            bonuses: 0
          },
          deductionBreakdown: {
            ccss_employee: Math.round(Number(line.gross_salary) * 0.1067),
            ccss_ivm: 0,
            income_tax: 0,
            loan_deduction: 0,
            other: Number(line.deductions) - Math.round(Number(line.gross_salary) * 0.1067)
          }
        };
      });

      setPayslips(transformedPayslips);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las colillas de pago",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const filteredPayslips = payslips.filter(payslip => {
    const matchesSearch = `${payslip.employeeName} ${payslip.employeeCedula} ${payslip.period}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    const matchesYear = payslip.year.toString() === selectedYear;
    
    return matchesSearch && matchesYear;
  });

  // Group data for yearly view
  const yearlyData = viewMode === 'yearly' ? (() => {
    const grouped = filteredPayslips.reduce((acc, payslip) => {
      const key = payslip.employeeId;
      if (!acc[key]) {
        acc[key] = {
          ...payslip,
          id: `yearly-${payslip.employeeId}`,
          period: `Año ${selectedYear}`,
          grossSalary: 0,
          deductions: 0,
          netSalary: 0,
          aguinaldo: 0
        };
      }
      acc[key].grossSalary += payslip.grossSalary;
      acc[key].deductions += payslip.deductions;
      acc[key].netSalary += payslip.netSalary;
      acc[key].aguinaldo += payslip.aguinaldo;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped);
  })() : [];

  const displayData = viewMode === 'yearly' ? yearlyData : filteredPayslips;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando colillas de pago...</p>
        </div>
      </div>
    );
  }

  // Helper functions for currency conversion
  const convertToUSD = (amountCRC: number, exchangeRate: number) => {
    return amountCRC / exchangeRate;
  };

  const convertToCRC = (amountUSD: number, exchangeRate: number) => {
    return amountUSD * exchangeRate;
  };

  const formatAmount = (amount: number, currency: 'CRC' | 'USD', exchangeRate?: number) => {
    if (selectedCurrency === 'BOTH' && currency === 'CRC') {
      const usdAmount = convertToUSD(amount, exchangeRate || 510.27);
      return (
        <div>
          <div>{formatCurrency(amount, 'CRC')}</div>
          <div className="text-xs text-muted-foreground">{formatCurrency(usdAmount, 'USD')}</div>
        </div>
      );
    }
    
    if (selectedCurrency === 'USD' && currency === 'CRC') {
      const usdAmount = convertToUSD(amount, exchangeRate || 510.27);
      return formatCurrency(usdAmount, 'USD');
    }
    
    return formatCurrency(amount, currency);
  };

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

  const handleSendEmail = async (payslip: Payslip) => {
    try {
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Colilla enviada",
        description: `Colilla de ${payslip.employeeName} enviada a ${payslip.email}`,
      });
      
      // Update email status (in real app, would update database)
      console.log(`Email sent to ${payslip.email} for period ${payslip.period}`);
    } catch (error) {
      toast({
        title: "Error al enviar",
        description: "No se pudo enviar la colilla por correo.",
        variant: "destructive",
      });
    }
  };

  const handleEditCompany = () => {
    setEditingCompany(selectedCompany);
    setIsCompanyEditOpen(true);
  };

  const handleSaveCompany = () => {
    if (editingCompany) {
      setSelectedCompany(editingCompany);
      toast({
        title: "Empresa actualizada",
        description: "Los datos de la empresa han sido actualizados correctamente.",
      });
      setIsCompanyEditOpen(false);
    }
  };

  const handleEditPayslip = (payslip: Payslip) => {
    setEditingPayslip({ ...payslip });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingPayslip) {
      // In real app, would save to database
      toast({
        title: "Colilla actualizada",
        description: `Colilla de ${editingPayslip.employeeName} actualizada correctamente.`,
      });
      setIsEditDialogOpen(false);
      setEditingPayslip(null);
    }
  };

  const handleViewPayslip = (payslip: Payslip) => {
    const usdGross = convertToUSD(payslip.grossSalary, payslip.exchangeRate);
    const usdNet = convertToUSD(payslip.netSalary, payslip.exchangeRate);
    const usdDeductions = convertToUSD(payslip.deductions, payslip.exchangeRate);
    
    const payslipWindow = window.open('', '_blank');
    if (payslipWindow) {
      payslipWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Colilla de Pago - ${payslip.employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 28px; font-weight: bold; color: #0B2B4C; margin-bottom: 5px; }
            .company-logo { font-size: 32px; color: #2A9D8F; font-weight: bold; margin-bottom: 10px; }
            .payslip-title { font-size: 18px; margin: 10px 0; color: #2A9D8F; }
            .period { color: #0B2B4C; font-weight: bold; font-size: 16px; }
            .employee-box { border: 3px solid #0B2B4C; padding: 15px; margin: 20px 0; }
            .employee-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .label { font-weight: bold; color: #0B2B4C; }
            .section-title { background: #2A9D8F; color: white; padding: 10px; margin: 20px 0 0 0; font-weight: bold; }
            .benefits-table, .deductions-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .benefits-table th, .benefits-table td, .deductions-table th, .deductions-table td { 
              border: 1px solid #ddd; padding: 10px; text-align: left; 
            }
            .benefits-table th, .deductions-table th { background: #f8f9fa; font-weight: bold; color: #0B2B4C; }
            .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
            .total-row { font-weight: bold; background: #e9ecef; }
            .net-pay { font-size: 20px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; background: #f8f9fa; border: 2px solid #2A9D8F; }
            .footer { margin-top: 40px; font-size: 11px; color: #666; text-align: center; }
            .currency-display { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
            .usd-amount { color: #2A9D8F; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-logo">Horizonte +</div>
            <div class="company-name">${selectedCompany?.name || 'Empresa'}</div>
            <div class="payslip-title">Comprobante de Pago</div>
            <div class="period">Del 01/${payslip.month.toString().padStart(2, '0')}/${payslip.year} al 30/${payslip.month.toString().padStart(2, '0')}/${payslip.year}</div>
          </div>

          <div class="employee-box">
            <h3 style="color: #0B2B4C; margin-top: 0;">Datos Generales</h3>
            <div class="employee-grid">
              <div>
                <div><span class="label">Nombre:</span> ${payslip.employeeName}</div>
                <div><span class="label">Identificación:</span> ${payslip.employeeCedula}</div>
                <div><span class="label">Puesto:</span> ${payslip.position}</div>
                <div><span class="label">Salario Bruto:</span> ${formatCurrency(usdGross, 'USD')}</div>
              </div>
              <div>
                <div><span class="label">Horas Incapacidad CCSS:</span> </div>
                <div><span class="label">Horas Incapacidad INS:</span> </div>
                <div><span class="label">Horas de Ausencia:</span> </div>
              </div>
            </div>
          </div>

          <div class="section-title">Beneficios</div>
          <table class="benefits-table">
            <thead>
              <tr>
                <th></th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Salario Quincenal</td>
                <td class="amount">0.00</td>
                <td class="amount">$ ${usdGross.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Horas Extras</td>
                <td class="amount">0.00</td>
                <td class="amount">$ -</td>
              </tr>
              <tr>
                <td>Horas Mixtas</td>
                <td class="amount">0.00</td>
                <td class="amount">$ -</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="2">Total Beneficios:</td>
                <td class="amount">$ ${usdGross.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="section-title">Deducciones</div>
          <table class="deductions-table">
            <thead>
              <tr>
                <th></th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>LPT Banco Popular</td>
                <td class="amount">$ ${(usdGross * 0.01).toFixed(2)}</td>
                <td class="amount">$ ${(usdGross * 0.01).toFixed(2)}</td>
              </tr>
              <tr>
                <td>SEM Trabajador CCSS</td>
                <td class="amount">$ ${(usdGross * 0.055).toFixed(2)}</td>
                <td class="amount">$ ${(usdGross * 0.055).toFixed(2)}</td>
              </tr>
              <tr>
                <td>IVM Trabajador CCSS</td>
                <td class="amount">$ ${(usdGross * 0.05).toFixed(2)}</td>
                <td class="amount">$ ${(usdGross * 0.05).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Impuesto de Renta</td>
                <td class="amount">$ -</td>
                <td class="amount">$ -</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="2">Total Deducciones:</td>
                <td class="amount">$ ${usdDeductions.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="net-pay">
            Total a Pagar: $ ${usdNet.toFixed(2)}
          </div>

          <div class="currency-display">
            <div><strong>CRC:</strong> ${formatCurrency(payslip.netSalary, 'CRC')}</div>
            <div><strong>USD:</strong> ${formatCurrency(usdNet, 'USD')}</div>
            <div><strong>T.C.:</strong> ₡${payslip.exchangeRate.toFixed(2)}</div>
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
          <Button variant="outline" size="sm" className="gap-2" onClick={handleEditCompany}>
            <Building2 className="h-4 w-4" />
            Editar Empresa
          </Button>
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
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por empleado, cédula o período..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as 'CRC' | 'USD' | 'BOTH')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRC">CRC (₡)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="BOTH">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'monthly' | 'yearly')} className="w-48">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">Mensual</TabsTrigger>
                <TabsTrigger value="yearly">Anual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal">
                {displayData.length}
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
                {viewMode === 'yearly' ? displayData.length : displayData.filter(p => p.emailStatus === 'sent').length}
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
                {viewMode === 'yearly' ? 0 : displayData.filter(p => p.emailStatus === 'pending').length}
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
                {formatCurrency(displayData.reduce((acc, p) => acc + p.netSalary, 0), 'CRC')}
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
          <CardTitle className="text-navy">
            Colillas Generadas - {viewMode === 'yearly' ? `Año ${selectedYear}` : `Setiembre ${selectedYear}`}
          </CardTitle>
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
                {displayData.map((payslip) => (
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
                      {formatAmount(payslip.grossSalary, payslip.currency, payslip.exchangeRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      {formatAmount(payslip.deductions, payslip.currency, payslip.exchangeRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-teal">
                      {formatAmount(payslip.netSalary, payslip.currency, payslip.exchangeRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatAmount(payslip.aguinaldo, payslip.currency, payslip.exchangeRate)}
                    </TableCell>
                    <TableCell className="text-center">
                      {viewMode === 'yearly' ? 
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviada</Badge> :
                        getStatusBadge(payslip.status)
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {viewMode === 'yearly' ? 
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge> :
                        getEmailStatusBadge(payslip.emailStatus)
                      }
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
                          onClick={() => handleSendEmail(payslip)}
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

      {/* Company Edit Dialog */}
      <Dialog open={isCompanyEditOpen} onOpenChange={setIsCompanyEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nombre</Label>
                <Input
                  id="company-name"
                  value={editingCompany?.name || ''}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, name: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-legal">Razón Social</Label>
                <Input
                  id="company-legal"
                  value={editingCompany?.legal_name || ''}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, legal_name: e.target.value} : null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-id">Cédula Jurídica</Label>
                <Input
                  id="company-id"
                  value={editingCompany?.juridical_id || ''}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, juridical_id: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-logo">URL del Logo</Label>
                <Input
                  id="company-logo"
                  value={editingCompany?.logo_url || ''}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, logo_url: e.target.value} : null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Color Primario</Label>
                <Input
                  id="primary-color"
                  type="color"
                  value={editingCompany?.primary_color || '#0B2B4C'}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, primary_color: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Color Acento</Label>
                <Input
                  id="accent-color"
                  type="color"
                  value={editingCompany?.accent_color || '#2A9D8F'}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, accent_color: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="light-color">Color Claro</Label>
                <Input
                  id="light-color"
                  type="color"
                  value={editingCompany?.light_color || '#F5EFE6'}
                  onChange={(e) => setEditingCompany(prev => prev ? {...prev, light_color: e.target.value} : null)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCompanyEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCompany}>
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}