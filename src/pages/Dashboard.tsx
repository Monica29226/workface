import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Download, 
  FileText, 
  Users, 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  Building2,
  Calculator,
  Mail,
  UserPlus,
  CalendarDays,
  Receipt,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface KPIData {
  grossPeriod: number;
  totalDeductions: number;
  netPay: number;
  employerCharges: number;
  activeEmployees: number;
  avgCostEmployee: number;
  pendingVacations: number;
  pendingPayslips: number;
}

interface RecentActivity {
  id: string;
  type: 'payroll' | 'employee' | 'vacation' | 'email';
  title: string;
  description: string;
  date: string;
  status: 'success' | 'pending' | 'warning';
}

export function Dashboard() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [kpiData, setKpiData] = useState<KPIData>({
    grossPeriod: 0,
    totalDeductions: 0,
    netPay: 0,
    employerCharges: 0,
    activeEmployees: 0,
    avgCostEmployee: 0,
    pendingVacations: 0,
    pendingPayslips: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    if (selectedCompany?.id) {
      loadDashboardData();
    }
  }, [selectedCompany?.id]);

  const loadDashboardData = async () => {
    if (!selectedCompany?.id) return;
    
    setLoading(true);
    try {
      // Get the most recent approved or sent payroll batch
      const { data: latestBatch } = await supabase
        .from('payroll_batches')
        .select('id, period_start, period_end, status, batch_id')
        .eq('company_id', selectedCompany.id)
        .in('status', ['aprobado', 'enviado', 'calculado'])
        .order('period_end', { ascending: false })
        .limit(1)
        .single();

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNetPay = 0;
      let totalEmployerCharges = 0;

      if (latestBatch) {
        const { data: payrollLines } = await supabase
          .from('payroll_lines')
          .select('gross_salary, deductions, net_pay, employer_contrib, currency, exchange_rate_to_base')
          .eq('batch_id', latestBatch.id);

        if (payrollLines) {
          payrollLines.forEach(line => {
            const rate = line.exchange_rate_to_base || 1;
            const multiplier = line.currency === 'CRC' ? 1 : rate;
            
            totalGross += line.gross_salary * multiplier;
            totalDeductions += (line.deductions || 0) * multiplier;
            totalNetPay += line.net_pay * multiplier;
            totalEmployerCharges += (line.employer_contrib || 0) * multiplier;
          });
        }
      }

      // Get active employees count
      const { count: activeEmployeesCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('status', 'activo');

      // Get pending vacation requests
      const { count: pendingVacations } = await supabase
        .from('vacation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('status', 'pending');

      // Get payslips not sent yet
      const { count: pendingPayslips } = await supabase
        .from('payslips')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .is('sent_at', null);

      const employeeCount = activeEmployeesCount || 1;
      
      setKpiData({
        grossPeriod: totalGross,
        totalDeductions: totalDeductions,
        netPay: totalNetPay,
        employerCharges: totalEmployerCharges,
        activeEmployees: employeeCount,
        avgCostEmployee: totalGross / employeeCount,
        pendingVacations: pendingVacations || 0,
        pendingPayslips: pendingPayslips || 0
      });

      // Build recent activity from various sources
      const activities: RecentActivity[] = [];
      
      if (latestBatch) {
        activities.push({
          id: latestBatch.id,
          type: 'payroll',
          title: 'Planilla Procesada',
          description: `Lote ${latestBatch.batch_id} - ${latestBatch.status}`,
          date: latestBatch.period_end,
          status: latestBatch.status === 'enviado' ? 'success' : 'pending'
        });
      }

      setRecentActivity(activities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: "Nuevo Empleado",
      description: "Agregar colaborador al sistema",
      icon: UserPlus,
      color: "bg-emerald-500",
      action: () => navigate('/employees'),
    },
    {
      title: "Procesar Planilla",
      description: "Generar nómina del período",
      icon: Calculator,
      color: "bg-blue-500",
      action: () => navigate('/payroll-process'),
    },
    {
      title: "Enviar Boletas",
      description: "Distribuir comprobantes de pago",
      icon: Mail,
      color: "bg-purple-500",
      action: () => navigate('/payslips'),
    },
    {
      title: "Generar Reportes",
      description: "Exportar informes y datos",
      icon: BarChart3,
      color: "bg-amber-500",
      action: () => navigate('/historico'),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-6 w-6 text-yellow-300" />
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                Sistema Multi-Empresa
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              ACL Payroll CR
            </h1>
            <p className="text-white/80 text-lg">
              {selectedCompany?.legal_name || selectedCompany?.name || 'Seleccione una empresa'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="bg-white/10 text-white border-white/30 text-sm px-3 py-1">
              <DollarSign className="h-3 w-3 mr-1" />
              CRC
            </Badge>
            <Button 
              variant="secondary" 
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
              onClick={() => navigate('/payroll-process')}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Nueva Planilla
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Salary */}
        <Card className="card-elevated group hover:shadow-xl transition-all duration-300 border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Salario Bruto Período
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpiData.grossPeriod, 'CRC')}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">Último período</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Pay */}
        <Card className="card-elevated group hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Salario Neto
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpiData.netPay, 'CRC')}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">A depositar</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Employees */}
        <Card className="card-elevated group hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Colaboradores Activos
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {kpiData.activeEmployees}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Users className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-purple-600 font-medium">En planilla</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employer Contributions */}
        <Card className="card-elevated group hover:shadow-xl transition-all duration-300 border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Cargas Patronales
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpiData.employerCharges, 'CRC')}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Building2 className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-amber-600 font-medium">CCSS + Otros</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="card-elevated overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Acciones Rápidas</CardTitle>
              <CardDescription>Tareas frecuentes para gestión de planillas</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Acceso directo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="group relative flex flex-col items-start p-5 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-300 text-left"
              >
                <div className={`p-3 rounded-lg ${action.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
                <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Pending Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Items */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kpiData.pendingVacations > 0 && (
              <div 
                className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={() => navigate('/reports/vacations')}
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Solicitudes de Vacaciones</p>
                    <p className="text-sm text-amber-700">{kpiData.pendingVacations} pendiente(s) de aprobación</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-600" />
              </div>
            )}
            {kpiData.pendingPayslips > 0 && (
              <div 
                className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => navigate('/payslips')}
              >
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Boletas por Enviar</p>
                    <p className="text-sm text-blue-700">{kpiData.pendingPayslips} boleta(s) sin enviar</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-600" />
              </div>
            )}
            {kpiData.pendingVacations === 0 && kpiData.pendingPayslips === 0 && (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 mr-2 text-emerald-500" />
                <span>Todo al día, sin pendientes</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Resumen del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Total Deducciones</span>
                <span className="font-semibold text-destructive">
                  -{formatCurrency(kpiData.totalDeductions, 'CRC')}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-muted-foreground">Costo Promedio / Empleado</span>
                <span className="font-semibold">
                  {formatCurrency(kpiData.avgCostEmployee, 'CRC')}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <span className="font-medium text-primary">Costo Total Empresa</span>
                <span className="font-bold text-primary text-lg">
                  {formatCurrency(kpiData.grossPeriod + kpiData.employerCharges, 'CRC')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}