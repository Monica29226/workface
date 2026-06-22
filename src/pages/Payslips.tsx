import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search, 
  Download, 
  Mail, 
  Eye,
  FileText,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PayslipData {
  id: string;
  employeeId: string;
  employeeRecordId: string;
  employeeName: string;
  email: string;
  costCenter: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  aguinaldo: number;
  status: 'generated' | 'sent';
  emailStatus: 'sent' | 'pending' | 'failed' | 'no_email';
  currency: 'CRC' | 'USD';
  exchangeRate: number;
  month: number;
  year: number;
  period: string;
  batchId: string;
  batchUuid: string;
  payrollType: 'adelanto' | 'segunda' | 'completa';
}

export function Payslips() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD'>('CRC');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 'all' = todos los meses
  const [emailFilter, setEmailFilter] = useState<'all' | 'ready' | 'sent' | 'missing'>('all');
  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [sendOnGenerate, setSendOnGenerate] = useState(false);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    if (selectedCompany) {
      fetchPayslips();
    }
  }, [selectedCompany, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!selectedCompany) return;
    const prefersUsd = selectedCompany.name?.toLowerCase().includes('horizonte positivo');
    if (prefersUsd) {
      setSelectedCurrency('USD');
    }
  }, [selectedCompany]);

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
            status,
            payroll_type
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

      // Fetch payslip sent_at data to determine email status
      const { data: payslipRecords } = await supabase
        .from('payslips')
        .select('employee_id, batch_id, sent_at')
        .eq('company_id', selectedCompany.id);

      const payslipSentMap = new Map<string, string | null>();
      (payslipRecords || []).forEach((p: any) => {
        payslipSentMap.set(`${p.employee_id}-${p.batch_id}`, p.sent_at);
      });

      const transformedPayslips: PayslipData[] = (data || []).map((line: any) => {
        const periodStart = new Date(line.batch.period_start);
        const month = periodStart.getMonth() + 1;
        const year = periodStart.getFullYear();

        // Determine email status
        const sentAt = payslipSentMap.get(`${line.employee_id}-${line.batch.id}`);
        let emailStatus: 'sent' | 'pending' | 'failed' | 'no_email' = 'pending';
        if (!line.employee.work_email) {
          emailStatus = 'no_email';
        } else if (sentAt) {
          emailStatus = 'sent';
        }

        const payrollType = line.batch.payroll_type || 'completa';
        const payrollTypeLabel =
          payrollType === 'adelanto'
            ? '1ra quincena'
            : payrollType === 'segunda'
              ? '2da quincena'
              : 'Mensual';

        return {
          id: line.id,
          employeeId: line.employee.employee_id,
          employeeRecordId: line.employee.id,
          employeeName: line.employee.full_name,
          email: line.employee.work_email,
          costCenter: 'Programas',
          grossSalary: Number(line.gross_salary),
          deductions: Number(line.deductions),
          netSalary: Number(line.net_pay),
          aguinaldo: Number(line.aguinaldo_accrued || 0),
          status: line.batch.status === 'enviado' ? 'sent' : 'generated',
          emailStatus,
          currency: line.currency,
          exchangeRate: Number(line.exchange_rate_to_base || 1),
          month,
          year,
          period: `${monthNames[month - 1]} ${year} · ${payrollTypeLabel}`,
          batchId: line.batch.batch_id,
          batchUuid: line.batch.id,
          payrollType,
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
      const matchesMonth = viewMode === 'monthly' 
        ? (selectedMonth === 'all' || payslip.month === selectedMonth) 
        : true;
      const matchesEmail =
        emailFilter === 'all' ||
        (emailFilter === 'ready' && payslip.emailStatus === 'pending' && payslip.status === 'generated') ||
        (emailFilter === 'sent' && payslip.emailStatus === 'sent') ||
        (emailFilter === 'missing' && payslip.emailStatus === 'no_email');
      
      return matchesSearch && matchesYear && matchesMonth && matchesEmail;
    });
  }, [payslips, searchTerm, selectedYear, selectedMonth, viewMode, emailFilter]);

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

  const convertAmount = (amount: number, from: 'CRC' | 'USD', to: 'CRC' | 'USD', exchangeRate: number) => {
    if (from === to) return amount;
    if (!exchangeRate || exchangeRate <= 1) return amount;
    return from === 'USD' ? amount * exchangeRate : amount / exchangeRate;
  };

  const getGrossAmount = (payslip: PayslipData) =>
    convertAmount(payslip.grossSalary, payslip.currency, selectedCurrency, payslip.exchangeRate);

  const getDeductionAmount = (payslip: PayslipData) => {
    const sourceCurrency: 'CRC' | 'USD' = payslip.currency === 'USD' && payslip.exchangeRate > 1 ? 'CRC' : payslip.currency;
    return convertAmount(payslip.deductions, sourceCurrency, selectedCurrency, payslip.exchangeRate);
  };

  const getNetAmount = (payslip: PayslipData) => {
    const sourceCurrency: 'CRC' | 'USD' = payslip.currency === 'USD' && payslip.exchangeRate > 1 ? 'CRC' : payslip.currency;
    return convertAmount(payslip.netSalary, sourceCurrency, selectedCurrency, payslip.exchangeRate);
  };

  const getAguinaldoAmount = (payslip: PayslipData) => {
    const sourceCurrency: 'CRC' | 'USD' = payslip.currency === 'USD' && payslip.exchangeRate > 1 ? 'CRC' : payslip.currency;
    return convertAmount(payslip.aguinaldo, sourceCurrency, selectedCurrency, payslip.exchangeRate);
  };

  const stats = useMemo(() => {
    const total = displayData.length;
    const sent = displayData.filter((p) => p.emailStatus === 'sent').length;
    const pending = displayData.filter((p) => p.emailStatus !== 'sent').length;
    const totalNet = displayData.reduce((sum, p) => sum + getNetAmount(p), 0);
    
    return { total, sent, pending, totalNet };
  }, [displayData, selectedCurrency]);

  const operationalStats = useMemo(() => {
    const readyToSend = filteredPayslips.filter(
      (p) => p.emailStatus === 'pending' && p.status === 'generated'
    );
    const missingEmail = filteredPayslips.filter((p) => p.emailStatus === 'no_email');
    const alreadySent = filteredPayslips.filter((p) => p.emailStatus === 'sent');

    return {
      readyToSend,
      missingEmail,
      alreadySent,
    };
  }, [filteredPayslips]);

  const missingEmailPreview = operationalStats.missingEmail.slice(0, 4);

  // Get exchange rate from payslips data
  const currentExchangeRate = useMemo(() => {
    const usdPayslip = displayData.find(p => p.currency === 'USD' && p.exchangeRate > 1);
    return usdPayslip?.exchangeRate || null;
  }, [displayData]);

  const handleGenerateNew = async () => {
    if (!selectedCompany) return;

    if (selectedMonth === 'all') {
      toast({
        title: "Selecciona un mes",
        description: "Debes seleccionar un mes específico para generar colillas",
        variant: "destructive",
      });
      return;
    }

    // Check if there's an authorized batch for the selected period
    const { data: authorizedBatches, error: batchError } = await supabase
      .from('payroll_batches')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .eq('status', 'autorizado' as any) // Type assertion for new enum value
      .gte('period_end', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
      .lt('period_end', `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
      .limit(1);

    if (batchError) {
      console.error('Error checking batches:', batchError);
      toast({
        title: "Error",
        description: "No se pudo verificar planillas autorizadas",
        variant: "destructive",
      });
      return;
    }

    if (!authorizedBatches || authorizedBatches.length === 0) {
      toast({
        title: "No hay planilla autorizada",
        description: `No existe una planilla autorizada para ${monthNames[selectedMonth - 1]} ${selectedYear}. Flujo requerido: Calculado → Aprobado → Autorizado → Enviado`,
        variant: "destructive",
      });
      return;
    }

    const batch = authorizedBatches[0];

    try {
      const { data, error } = await supabase.functions.invoke('generate-payslips', {
        body: {
          batchId: batch.id,
          sendEmails: sendOnGenerate,
        },
      });

      if (error) throw error;

      toast({
        title: "Colillas generadas",
        description: data.message,
      });

      fetchPayslips();
    } catch (error: any) {
      console.error('Error generating payslips:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar las colillas",
        variant: "destructive",
      });
    }
  };

  const sendPayslipEmail = async (payslip: PayslipData) => {
    if (!selectedCompany) return;
    if (!payslip.email) {
      throw new Error(`El colaborador ${payslip.employeeName} no tiene correo registrado`);
    }

    const { data, error } = await supabase.functions.invoke('send-payslip-email', {
      body: {
        payrollLineId: payslip.id,
        companyId: selectedCompany.id,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const handleSendEmail = async (payslip: PayslipData) => {
    try {
      await sendPayslipEmail(payslip);

      toast({
        title: "Colilla enviada",
        description: `Colilla enviada correctamente a ${payslip.email}`,
      });

      fetchPayslips();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Error al enviar colilla",
        description: error.message || "No se pudo enviar la colilla. Verifique el correo del colaborador.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async (payslip: PayslipData) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-payslip-pdf', {
        body: {
          payrollLineId: payslip.id,
          companyId: selectedCompany.id,
        },
      });

      if (error) throw error;

      if (data?.pdfBase64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.pdfBase64}`;
        link.download = data.fileName || `colilla-${payslip.employeeName.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("La respuesta no incluyo un PDF descargable");
      }

      toast({
        title: "PDF generado",
        description: `PDF de ${payslip.employeeName} generado correctamente`,
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  const handleBulkSend = async () => {
    const readyToSend = operationalStats.readyToSend;
    if (!selectedCompany || readyToSend.length === 0) {
      toast({
        title: "Nada por enviar",
        description: operationalStats.missingEmail.length > 0
          ? "No hay colillas listas para enviar. Revise los colaboradores sin correo."
          : "No hay colillas pendientes de envío en el período seleccionado",
        variant: "destructive",
      });
      return;
    }

    setIsBulkSending(true);
    try {
      let sentCount = 0;
      let failedCount = 0;

      for (const payslip of readyToSend) {
        try {
          await sendPayslipEmail(payslip);
          sentCount++;
        } catch (error) {
          failedCount++;
          console.error(`Error sending payslip to ${payslip.employeeName}:`, error);
        }
      }

      await fetchPayslips();

      toast({
        title: "Envío masivo completado",
        description:
          failedCount > 0
            ? `Se enviaron ${sentCount} colillas y ${failedCount} quedaron con error.`
            : `Se enviaron ${sentCount} colillas correctamente.`,
      });
    } catch (error: any) {
      console.error('Error in bulk send:', error);
      toast({
        title: "Error",
        description: "Hubo un error en el envío masivo",
        variant: "destructive",
      });
    } finally {
      setIsBulkSending(false);
    }
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

  const formatAmount = (amount: number) => formatCurrency(amount, selectedCurrency);

  const getStatusBadge = (status: string) => {
    return status === 'sent' 
      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviada</Badge>
      : <Badge variant="secondary">Pendiente</Badge>;
  };

  const getEmailStatusBadge = (emailStatus: string) => {
    switch (emailStatus) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Fallo</Badge>;
      case 'no_email':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Sin correo</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  return (
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="acl-eyebrow mb-2">Operacion RRHH</p>
          <h1 className="text-2xl font-bold">Colillas de pago</h1>
          <p className="text-muted-foreground">
            Gestión de comprobantes de pago para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Checkbox
              checked={sendOnGenerate}
              onCheckedChange={(checked) => setSendOnGenerate(checked === true)}
            />
            <span>Enviar solo si todo esta en orden</span>
          </label>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleBulkSend}
            disabled={isBulkSending || operationalStats.readyToSend.length === 0}
          >
            {isBulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envío Masivo
          </Button>
          <Button size="sm" className="gap-2 bg-navy hover:bg-navy/90 text-white" onClick={handleGenerateNew}>
            <Plus className="h-4 w-4" />
            Generar Nuevas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Listas para enviar</p>
                <p className="text-3xl font-bold">{operationalStats.readyToSend.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Colillas pendientes con correo disponible
                </p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-emerald-500/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sin correo</p>
                <p className="text-3xl font-bold">{operationalStats.missingEmail.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Requieren correo antes del envío automático o manual
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 text-amber-500/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ya enviadas</p>
                <p className="text-3xl font-bold">{operationalStats.alreadySent.length}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Colillas con trazabilidad de correo en este filtro
                </p>
              </div>
              <Mail className="h-10 w-10 text-blue-500/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr,1fr]">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Colas operativas</CardTitle>
            <p className="text-sm text-muted-foreground">Prioridades inmediatas para envio y correccion de datos.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Listas para enviar</p>
              <p className="mt-2 text-2xl font-semibold">{operationalStats.readyToSend.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">Colillas pendientes con correo valido y trazabilidad disponible.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Ya enviadas</p>
              <p className="mt-2 text-2xl font-semibold">{operationalStats.alreadySent.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">No requieren accion adicional salvo reenvio excepcional.</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Bloqueadas</p>
              <p className="mt-2 text-2xl font-semibold">{operationalStats.missingEmail.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">No se pueden enviar hasta completar el correo del colaborador.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Alertas de envio</CardTitle>
            <CardDescription>Casos a corregir antes del proximo envio masivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {missingEmailPreview.length > 0 ? (
              missingEmailPreview.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="font-medium">{item.employeeName}</p>
                  <p className="mt-1 text-muted-foreground">{item.period}</p>
                  <p className="mt-2 text-amber-700">Falta correo laboral para enviar esta colilla.</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                No hay bloqueos por correo en la vista actual.
              </div>
            )}
          </CardContent>
        </Card>
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
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            {viewMode === 'monthly' && (
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
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
            <Select value={emailFilter} onValueChange={(value) => setEmailFilter(value as 'all' | 'ready' | 'sent' | 'missing')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los correos</SelectItem>
                <SelectItem value="ready">Listas para enviar</SelectItem>
                <SelectItem value="sent">Solo enviadas</SelectItem>
                <SelectItem value="missing">Sin correo</SelectItem>
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

      {/* Exchange Rate Banner */}
      {currentExchangeRate && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <span className="font-medium">Tipo de Cambio BCCR (Venta):</span>
                <span className="font-bold">₡{Number(currentExchangeRate).toFixed(2)}</span>
                <span className="text-muted-foreground">/ $1 USD</span>
              </div>
              <div className="text-muted-foreground">
                {operationalStats.readyToSend.length > 0
                  ? `${operationalStats.readyToSend.length} colillas listas para enviar en esta vista`
                  : "No hay colillas listas para enviar en esta vista"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            Colillas Generadas - {viewMode === 'yearly' 
              ? `Año ${selectedYear}` 
              : selectedMonth === 'all' 
                ? `Año ${selectedYear}` 
                : `${monthNames[selectedMonth - 1]} ${selectedYear}`}
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
                  <TableHead className="font-semibold text-center">Correo</TableHead>
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
                        {formatAmount(getGrossAmount(payslip))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {formatAmount(getDeductionAmount(payslip))}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {formatAmount(getNetAmount(payslip))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatAmount(getAguinaldoAmount(payslip))}
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
                            title="Ver colilla"
                            disabled
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
                            disabled={payslip.emailStatus === 'sent' || payslip.emailStatus === 'no_email' || isBulkSending}
                          >
                            <Mail className="h-4 w-4" />
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
