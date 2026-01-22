import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  History, 
  Download,
  Loader2,
  Eye,
  Building2,
  DollarSign,
  TrendingUp,
  FileText,
  AlertTriangle,
  ArrowLeft,
  User,
  Calendar,
  Briefcase,
  CreditCard,
  Palmtree,
  Clock,
  Mail,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMonths, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { SalaryDetailModal } from "@/components/payroll/SalaryDetailModal";
import { useCompany } from "@/contexts/CompanyContext";

interface EmployeeData {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  hire_date: string | null;
  contract_type: string;
  currency: string;
  status: string;
  company_id: string;
  base_salary: number;
  hourly_rate: number | null;
  vac_balance_days: number | null;
  loan_amount: number | null;
  loan_monthly_deduction: number | null;
  cost_center?: {
    name: string;
    code: string;
  } | null;
}

interface PayslipWithLine {
  id: string;
  period_label: string;
  created_at: string;
  pdf_file_path: string | null;
  batch_id: string;
  payroll_line?: {
    id: string;
    gross_salary: number;
    deductions: number;
    deductions_detail: any;
    net_pay: number;
    total_to_pay: number;
    currency: string;
    additional_bonuses: number;
    project_hours_amount: number;
    exchange_rate_to_base: number;
    manual_adjustments: any;
  } | null;
}

interface VacationRecord {
  id: string;
  year: number;
  days_accrued: number;
  days_taken: number;
  days_pending: number | null;
  expiry_date: string | null;
  daily_rate: number | null;
  pending_amount: number | null;
}

interface LoanRecord {
  id: string;
  loan_type: string;
  original_amount: number;
  remaining_balance: number;
  monthly_deduction: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
}

interface CompanyData {
  id: string;
  display_name: string;
  logo_url: string | null;
  tax_id: string | null;
}

export function EmployeeProfileHR() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [payslips, setPayslips] = useState<PayslipWithLine[]>([]);
  const [vacations, setVacations] = useState<VacationRecord[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Salary detail modal
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipWithLine | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    if (!employeeId) return;
    
    setIsLoading(true);
    try {
      // Get employee record
      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select(`
          id, employee_id, full_name, work_email, hire_date, contract_type, 
          currency, status, company_id, base_salary, hourly_rate, 
          vac_balance_days, loan_amount, loan_monthly_deduction,
          cost_center:cost_centers(name, code)
        `)
        .eq("id", employeeId)
        .single();

      if (empError) throw empError;
      if (!employeeData) throw new Error("Empleado no encontrado");

      setEmployee(employeeData);

      // Get company info
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, display_name, logo_url, tax_id")
        .eq("id", employeeData.company_id)
        .single();

      if (companyData) setCompany(companyData);

      // Fetch payslips with payroll line data
      const { data: payslipsData } = await supabase
        .from("payslips")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false });

      if (payslipsData && payslipsData.length > 0) {
        const batchIds = payslipsData.map(p => p.batch_id);
        const { data: payrollLines } = await supabase
          .from("payroll_lines")
          .select("id, batch_id, gross_salary, deductions, deductions_detail, net_pay, total_to_pay, currency, additional_bonuses, project_hours_amount, exchange_rate_to_base, manual_adjustments")
          .eq("employee_id", employeeData.id)
          .in("batch_id", batchIds);

        const payslipsWithLines = payslipsData.map(payslip => ({
          ...payslip,
          payroll_line: payrollLines?.find(pl => pl.batch_id === payslip.batch_id) || null
        }));

        setPayslips(payslipsWithLines);
      }

      // Fetch vacation records
      const { data: vacationData } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("year", { ascending: false });

      if (vacationData) setVacations(vacationData);

      // Fetch loan records
      const { data: loanData } = await supabase
        .from("employee_loans")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("start_date", { ascending: false });

      if (loanData) setLoans(loanData);

    } catch (error) {
      console.error("Error fetching employee data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del empleado",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetail = (payslip: PayslipWithLine) => {
    setSelectedPayslip(payslip);
    setIsDetailModalOpen(true);
  };

  const handleDownloadPDF = async (payslip?: PayslipWithLine) => {
    const targetPayslip = payslip || selectedPayslip;
    if (!targetPayslip) return;
    
    setIsDownloadingPDF(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payslip-pdf', {
        body: { payslipId: targetPayslip.id }
      });

      if (error) throw error;

      if (data?.pdfBuffer) {
        const blob = new Blob([new Uint8Array(data.pdfBuffer)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${targetPayslip.period_label}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "PDF generado",
        description: "El comprobante se ha descargado correctamente",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el comprobante PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Summary statistics
  const stats = useMemo(() => {
    if (!payslips.length) return null;
    
    const totalNetPaid = payslips.reduce((sum, p) => sum + (p.payroll_line?.net_pay || 0), 0);
    const avgNetPay = totalNetPaid / payslips.length;
    const latestPayslip = payslips[0];
    
    return {
      totalPayslips: payslips.length,
      totalNetPaid,
      avgNetPay,
      latestNetPay: latestPayslip?.payroll_line?.net_pay || 0,
      currency: latestPayslip?.payroll_line?.currency || 'CRC'
    };
  }, [payslips]);

  // Vacation summary
  const vacationSummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentVacation = vacations.find(v => v.year === currentYear);
    const totalPending = vacations.reduce((sum, v) => sum + (v.days_pending || (v.days_accrued - v.days_taken)), 0);
    const totalPendingAmount = vacations.reduce((sum, v) => sum + (v.pending_amount || 0), 0);
    
    return {
      currentYear: currentVacation,
      totalPending,
      totalPendingAmount
    };
  }, [vacations]);

  // Loan summary
  const loanSummary = useMemo(() => {
    const activeLoans = loans.filter(l => l.status === 'activo');
    const totalRemaining = activeLoans.reduce((sum, l) => sum + l.remaining_balance, 0);
    const totalMonthlyDeduction = activeLoans.reduce((sum, l) => sum + l.monthly_deduction, 0);
    
    return {
      activeCount: activeLoans.length,
      totalRemaining,
      totalMonthlyDeduction
    };
  }, [loans]);

  // Calculate tenure
  const tenure = useMemo(() => {
    if (!employee?.hire_date) return null;
    const hireDate = new Date(employee.hire_date);
    const years = differenceInYears(new Date(), hireDate);
    const months = differenceInMonths(new Date(), hireDate) % 12;
    return { years, months };
  }, [employee?.hire_date]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando perfil del empleado...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Empleado no encontrado</h2>
            <p className="text-muted-foreground">
              No se encontró el registro del empleado solicitado.
            </p>
            <Button className="mt-4" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-14 w-14 rounded-xl border bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{employee.full_name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{employee.employee_id}</span>
              <span>•</span>
              <span>{company?.display_name}</span>
              <Badge variant={employee.status === 'activo' ? 'default' : 'secondary'}>
                {employee.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Salarios</span>
          </TabsTrigger>
          <TabsTrigger value="vacations" className="gap-2">
            <Palmtree className="h-4 w-4" />
            <span className="hidden sm:inline">Vacaciones</span>
          </TabsTrigger>
          <TabsTrigger value="loans" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Préstamos</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Contract Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Información de Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline">
                    {employee.contract_type === 'mensual' ? 'Mensual' : 'Por Horas'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moneda:</span>
                  <span className="font-medium">{employee.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salario Base:</span>
                  <span className="font-medium">{formatCurrency(employee.base_salary, employee.currency)}</span>
                </div>
                {employee.hourly_rate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarifa/Hora:</span>
                    <span className="font-medium">{formatCurrency(employee.hourly_rate, employee.currency)}</span>
                  </div>
                )}
                {employee.cost_center && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Centro Costo:</span>
                    <span className="font-medium">{employee.cost_center.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tenure & Dates Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Antigüedad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Ingreso:</span>
                  <span className="font-medium">
                    {employee.hire_date 
                      ? format(new Date(employee.hire_date), "dd MMM yyyy", { locale: es })
                      : 'No registrada'}
                  </span>
                </div>
                {tenure && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiempo en empresa:</span>
                    <span className="font-medium">
                      {tenure.years > 0 && `${tenure.years} año${tenure.years > 1 ? 's' : ''}`}
                      {tenure.years > 0 && tenure.months > 0 && ', '}
                      {tenure.months > 0 && `${tenure.months} mes${tenure.months > 1 ? 'es' : ''}`}
                      {tenure.years === 0 && tenure.months === 0 && 'Menos de 1 mes'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correo:</span>
                  <span className="font-medium text-sm truncate max-w-[150px]">{employee.work_email}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumen Rápido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Pago:</span>
                  <span className="font-medium text-primary">
                    {stats ? formatCurrency(stats.latestNetPay, stats.currency) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vac. Pendientes:</span>
                  <span className="font-medium">
                    {vacationSummary.totalPending.toFixed(1)} días
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Préstamos Activos:</span>
                  <span className="font-medium">
                    {loanSummary.activeCount > 0 
                      ? formatCurrency(loanSummary.totalRemaining, employee.currency)
                      : 'Ninguno'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Payslips in Overview */}
          {payslips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Últimos Pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Deducciones</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.slice(0, 3).map((payslip) => {
                      const line = payslip.payroll_line;
                      return (
                        <TableRow key={payslip.id}>
                          <TableCell className="font-medium">{payslip.period_label}</TableCell>
                          <TableCell className="text-right font-mono">
                            {line ? formatCurrency(line.gross_salary, line.currency) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            {line ? `-${formatCurrency(line.deductions, line.currency)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">
                            {line ? formatCurrency(line.total_to_pay || line.net_pay, line.currency) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetail(payslip)} disabled={!line}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(payslip)} disabled={isDownloadingPDF}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {payslips.length > 3 && (
                  <div className="mt-4 text-center">
                    <Button variant="link" onClick={() => setActiveTab("payroll")}>
                      Ver historial completo ({payslips.length} registros)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Último Salario Neto</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(stats.latestNetPay, stats.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Promedio Mensual</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgNetPay, stats.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Pagado</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalNetPaid, stats.currency)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Colillas</p>
                  <p className="text-2xl font-bold">{stats.totalPayslips}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos Completo</CardTitle>
            </CardHeader>
            <CardContent>
              {payslips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No hay colillas de pago registradas</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Deducciones</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((payslip) => {
                      const line = payslip.payroll_line;
                      return (
                        <TableRow key={payslip.id}>
                          <TableCell className="font-medium">{payslip.period_label}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(payslip.created_at), "dd MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {line ? formatCurrency(line.gross_salary, line.currency) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            {line ? `-${formatCurrency(line.deductions, line.currency)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">
                            {line ? formatCurrency(line.total_to_pay || line.net_pay, line.currency) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{line?.currency || 'CRC'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetail(payslip)} disabled={!line}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(payslip)} disabled={isDownloadingPDF}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vacations Tab */}
        <TabsContent value="vacations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Días Pendientes Total</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{vacationSummary.totalPending.toFixed(1)} días</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Provisión Acumulada</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(vacationSummary.totalPendingAmount, employee.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Año Actual ({new Date().getFullYear()})</p>
                <p className="text-2xl font-bold">
                  {vacationSummary.currentYear 
                    ? `${vacationSummary.currentYear.days_accrued.toFixed(1)} acumulados`
                    : 'Sin datos'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Vacaciones por Año</CardTitle>
            </CardHeader>
            <CardContent>
              {vacations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Palmtree className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No hay registros de vacaciones</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Año</TableHead>
                      <TableHead className="text-right">Acumulados</TableHead>
                      <TableHead className="text-right">Tomados</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                      <TableHead className="text-right">Provisión</TableHead>
                      <TableHead>Vencimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vacations.map((vac) => (
                      <TableRow key={vac.id}>
                        <TableCell className="font-medium">{vac.year}</TableCell>
                        <TableCell className="text-right">{vac.days_accrued.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{vac.days_taken.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {(vac.days_pending || (vac.days_accrued - vac.days_taken)).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {vac.pending_amount 
                            ? formatCurrency(vac.pending_amount, employee.currency)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {vac.expiry_date 
                            ? format(new Date(vac.expiry_date), "dd MMM yyyy", { locale: es })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loans Tab */}
        <TabsContent value="loans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Préstamos Activos</p>
                <p className="text-2xl font-bold">{loanSummary.activeCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Saldo Pendiente Total</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(loanSummary.totalRemaining, employee.currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Deducción Mensual</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(loanSummary.totalMonthlyDeduction, employee.currency)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historial de Préstamos</CardTitle>
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No hay préstamos registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead className="text-right">Monto Original</TableHead>
                      <TableHead className="text-right">Saldo Pendiente</TableHead>
                      <TableHead className="text-right">Deducción/Mes</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium capitalize">{loan.loan_type}</TableCell>
                        <TableCell>
                          {format(new Date(loan.start_date), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(loan.original_amount, employee.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {formatCurrency(loan.remaining_balance, employee.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(loan.monthly_deduction, employee.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={loan.status === 'activo' ? 'default' : 'secondary'}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Salary Detail Modal */}
      <SalaryDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPayslip(null);
        }}
        payrollLine={selectedPayslip?.payroll_line ? {
          ...selectedPayslip.payroll_line,
          period_label: selectedPayslip.period_label
        } : null}
        company={company}
        periodLabel={selectedPayslip?.period_label || ''}
        onDownloadPDF={() => handleDownloadPDF()}
        isDownloading={isDownloadingPDF}
      />
    </div>
  );
}
