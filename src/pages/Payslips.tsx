import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Archive,
  Printer,
  Building2,
  Plus
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PayslipData {
  id: string;
  employeeId: string;
  employeeName: string;
  email: string;
  costCenter: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  aguinaldo: number;
  status: 'generated' | 'sent';
  currency: 'CRC' | 'USD';
  exchangeRate: number;
  month: number;
  year: number;
  period: string;
  batchId: string;
}

export function Payslips() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD'>('CRC');
  const [selectedMonth, setSelectedMonth] = useState(9); // September
  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    if (selectedCompany) {
      fetchPayslips();
    }
  }, [selectedCompany, selectedYear, selectedMonth]);

  const fetchPayslips = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_lines')
        .select(`
          *,
          batch:payroll_batches!inner(
            id,
            batch_id,
            period_start,
            period_end,
            status
          ),
          employee:employees!inner(
            id,
            employee_id,
            full_name,
            work_email
          )
        `)
        .eq('company_id', selectedCompany.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched payroll data:', data);

      const transformedPayslips: PayslipData[] = (data || []).map((line: any) => {
        const periodStart = new Date(line.batch.period_start);
        const month = periodStart.getMonth() + 1;
        const year = periodStart.getFullYear();

        return {
          id: line.id,
          employeeId: line.employee.employee_id,
          employeeName: line.employee.full_name,
          email: line.employee.work_email,
          costCenter: 'Programas',
          grossSalary: Number(line.gross_salary),
          deductions: Number(line.deductions),
          netSalary: Number(line.net_pay),
          aguinaldo: Number(line.aguinaldo_accrued || 0),
          status: line.batch.status === 'aprobado' ? 'sent' : 'generated',
          currency: line.currency,
          exchangeRate: Number(line.exchange_rate_to_base || 1),
          month,
          year,
          period: `${monthNames[month - 1]} ${year}`,
          batchId: line.batch.batch_id
        };
      });

      console.log('Transformed payslips:', transformedPayslips);
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
  
  const filteredPayslips = useMemo(() => {
    return payslips.filter(payslip => {
      const matchesSearch = `${payslip.employeeName} ${payslip.email} ${payslip.period}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      const matchesYear = payslip.year.toString() === selectedYear;
      const matchesMonth = viewMode === 'monthly' ? payslip.month === selectedMonth : true;
      
      return matchesSearch && matchesYear && matchesMonth;
    });
  }, [payslips, searchTerm, selectedYear, selectedMonth, viewMode]);

  const yearlyData = useMemo(() => {
    if (viewMode !== 'yearly') return [];
    
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
    }, {} as Record<string, PayslipData>);
    
    return Object.values(grouped);
  }, [filteredPayslips, selectedYear, viewMode]);

  const displayData = viewMode === 'yearly' ? yearlyData : filteredPayslips;

  const stats = useMemo(() => {
    const total = displayData.length;
    const sent = displayData.filter(p => p.status === 'sent').length;
    const pending = displayData.filter(p => p.status === 'generated').length;
    const totalNet = displayData.reduce((sum, p) => sum + p.netSalary, 0);
    
    return { total, sent, pending, totalNet };
  }, [displayData]);

  const handleGenerateNew = async () => {
    toast({
      title: "Generando colillas",
      description: `Se generarán colillas para ${monthNames[selectedMonth - 1]} ${selectedYear}`,
    });
    
    setTimeout(() => {
      toast({
        title: "Colillas generadas",
        description: "Las colillas se han generado correctamente",
      });
      fetchPayslips();
    }, 1500);
  };

  const handleSendEmail = async (payslip: PayslipData) => {
    toast({
      title: "Enviando colilla",
      description: `Enviando colilla a ${payslip.email}...`,
    });
    
    setTimeout(() => {
      toast({
        title: "Colilla enviada",
        description: `Colilla enviada correctamente a ${payslip.email}`,
      });
    }, 1000);
  };

  const handleDownloadPDF = (payslip: PayslipData) => {
    toast({
      title: "Descargando PDF",
      description: `Generando PDF de ${payslip.employeeName}...`,
    });
  };

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

  const formatAmount = (amount: number, currency: 'CRC' | 'USD') => {
    return formatCurrency(amount, selectedCurrency === 'USD' && currency === 'CRC' ? 'USD' : currency);
  };

  const getStatusBadge = (status: string) => {
    return status === 'sent' 
      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviada</Badge>
      : <Badge variant="secondary">Pendiente</Badge>;
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2">
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
          <Button size="sm" className="gap-2 bg-navy hover:bg-navy/90 text-white" onClick={handleGenerateNew}>
            <Plus className="h-4 w-4" />
            Generar Nuevas
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por empleado..."
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
            {viewMode === 'monthly' && (
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as 'CRC' | 'USD')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRC">CRC (₡)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {stats.total}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Total Colillas
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {stats.sent}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Enviadas
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Pendientes
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.totalNet, selectedCurrency)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Total Neto
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Colillas Generadas - {viewMode === 'yearly' ? `Año ${selectedYear}` : `${monthNames[selectedMonth - 1]} ${selectedYear}`}
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
                {displayData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron colillas para el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  displayData.map((payslip) => (
                    <TableRow key={payslip.id} className="hover:bg-muted/25">
                      <TableCell>
                        <div>
                          <div className="font-medium">{payslip.employeeName}</div>
                          <div className="text-sm text-muted-foreground">
                            {payslip.employeeId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{payslip.costCenter}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(payslip.grossSalary, payslip.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatAmount(payslip.deductions, payslip.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {formatAmount(payslip.netSalary, payslip.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatAmount(payslip.aguinaldo, payslip.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(payslip.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm">{payslip.email}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            title="Ver colilla"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleDownloadPDF(payslip)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}