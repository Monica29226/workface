import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  History, 
  Download,
  Loader2,
  Eye,
  Building2,
  DollarSign,
  TrendingUp,
  FileText,
  AlertTriangle,
  FileBadge,
  CalendarDays
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { SalaryDetailModal } from "@/components/payroll/SalaryDetailModal";
import { useNavigate } from "react-router-dom";

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

interface CompanyData {
  id: string;
  display_name: string;
  logo_url: string | null;
  tax_id: string | null;
}

export function EmployeeProfile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [payslips, setPayslips] = useState<PayslipWithLine[]>([]);

  // Salary detail modal
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipWithLine | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Get employee record for current user
      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, work_email, hire_date, contract_type, currency, status, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empError) throw empError;
      
      if (!employeeData) {
        setIsLoading(false);
        return;
      }

      setEmployee(employeeData);

      // Get company info with logo
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, display_name, logo_url, tax_id")
        .eq("id", employeeData.company_id)
        .single();

      if (companyData) setCompany(companyData);

      // Fetch payslips with payroll line data for detailed view
      const { data: payslipsData } = await supabase
        .from("payslips")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false });

      if (payslipsData && payslipsData.length > 0) {
        // Get payroll lines for these payslips
        const batchIds = payslipsData.map(p => p.batch_id);
        const { data: payrollLines } = await supabase
          .from("payroll_lines")
          .select("id, batch_id, gross_salary, deductions, deductions_detail, net_pay, total_to_pay, currency, additional_bonuses, project_hours_amount, exchange_rate_to_base, manual_adjustments")
          .eq("employee_id", employeeData.id)
          .in("batch_id", batchIds);

        // Map payroll lines to payslips
        const payslipsWithLines = payslipsData.map(payslip => ({
          ...payslip,
          payroll_line: payrollLines?.find(pl => pl.batch_id === payslip.batch_id) || null
        }));

        setPayslips(payslipsWithLines);
      }

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

      // Handle PDF download
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

  const quickActions = [
    {
      title: "Ver constancias",
      description: "Genera constancias laborales y salariales",
      icon: FileBadge,
      action: () => navigate("/employee-certificates"),
    },
    {
      title: "Solicitar tiempo libre",
      description: "Vacaciones, dia libre, medio dia o permiso",
      icon: CalendarDays,
      action: () => navigate("/employee-vacations"),
    },
    {
      title: "Ultima colilla",
      description: payslips[0]?.period_label || "Descarga tu comprobante mas reciente",
      icon: Download,
      action: () => {
        if (payslips[0]) {
          void handleDownloadPDF(payslips[0]);
        }
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando historial salarial...</p>
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
            <h2 className="text-xl font-semibold mb-2">Sin perfil de empleado</h2>
            <p className="text-muted-foreground">
              Tu cuenta no está asociada a un registro de empleado. Contacta a tu administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Company Logo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {company?.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.display_name}
              className="h-14 w-14 object-contain rounded-xl border bg-background p-2"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl border bg-muted flex items-center justify-center">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Mi Historial Salarial</h1>
            <p className="text-muted-foreground">{employee.full_name} • {company?.display_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/employee-certificates")}>
            <FileText className="mr-2 h-4 w-4" />
            Mis Constancias
          </Button>
          <Button variant="outline" onClick={() => navigate("/employee-vacations")}>
            <History className="mr-2 h-4 w-4" />
            Tiempo Libre
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Último Salario Neto</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(stats.latestNetPay, stats.currency)}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Promedio Mensual</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.avgNetPay, stats.currency)}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Recibido</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totalNetPaid, stats.currency)}
                  </p>
                </div>
                <History className="h-10 w-10 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Colillas Generadas</p>
                  <p className="text-2xl font-bold">{stats.totalPayslips}</p>
                </div>
                <FileText className="h-10 w-10 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 card-elevated">
          <CardHeader>
            <CardTitle>Atajos del portal</CardTitle>
            <CardDescription>
              Las tareas mas usadas por el colaborador desde un solo lugar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickActions.map((item) => (
              <button
                key={item.title}
                onClick={item.action}
                className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40"
              >
                <item.icon className="h-5 w-5 text-primary mb-3" />
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Estado de tu portal</CardTitle>
            <CardDescription>
              Resumen rapido de la informacion disponible para autoservicio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Colillas disponibles</span>
              <Badge variant="outline">{payslips.length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Correo laboral</span>
              <span className="font-medium truncate max-w-[180px] text-right">
                {employee.work_email || "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-medium text-right">{company?.display_name || "No definida"}</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
              Si ves algun dato incorrecto, RRHH puede corregirlo antes del siguiente envio de colillas.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Pagos
          </CardTitle>
          <CardDescription>Todas tus colillas de pago y comprobantes</CardDescription>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No tienes colillas de pago registradas</p>
              <p className="text-sm mt-2">Cuando se procese tu planilla, aparecerán aquí</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Salario Bruto</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto a Recibir</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => {
                  const line = payslip.payroll_line;
                  const isUSD = line?.currency === 'USD';
                  const exchangeRate = line?.exchange_rate_to_base || 505.10;
                  
                  return (
                    <TableRow key={payslip.id}>
                      <TableCell>
                        <div className="font-medium">{payslip.period_label}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(payslip.created_at), "dd MMM yyyy", { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line ? (
                          isUSD ? (
                            <span>${(line.gross_salary / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            formatCurrency(line.gross_salary, line.currency)
                          )
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {line ? (
                          isUSD ? (
                            <span>-${(line.deductions / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            `-${formatCurrency(line.deductions, line.currency)}`
                          )
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {line ? (
                          isUSD ? (
                            <span>${((line.total_to_pay || line.net_pay) / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            formatCurrency(line.total_to_pay || line.net_pay, line.currency)
                          )
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {line?.currency || 'CRC'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(payslip)}
                            disabled={!line}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPDF(payslip)}
                            disabled={isDownloadingPDF}
                          >
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
