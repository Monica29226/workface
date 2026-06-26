import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp,
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
  FileBadge2,
  Send,
  AlertCircle,
  Palmtree,
  Wallet
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";

// Memoized KPI Card component to prevent unnecessary re-renders
const KPICard = memo(({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconBg, 
  borderColor,
  subtitleIcon: SubtitleIcon,
  subtitleColor 
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  borderColor: string;
  subtitleIcon: React.ElementType;
  subtitleColor: string;
}) => (
  <Card className={`card-elevated group hover:shadow-xl transition-all duration-300 border-l-4 ${borderColor}`}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            <SubtitleIcon className={`h-3 w-3 ${subtitleColor}`} />
            <span className={`text-xs font-medium ${subtitleColor}`}>{subtitle}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
));

KPICard.displayName = "KPICard";

export function Dashboard() {
  const { selectedCompany, isLoading: isLoadingCompanies } = useCompany();
  const navigate = useNavigate();

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Use cached dashboard data hook
  const { kpiData, latestBatch, activeBatch, batches, isLoading } = useDashboardData(selectedBatchId);

  // Memoize quick actions to prevent recreation
  const quickActions = useMemo(() => [
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
    {
      title: "Aprobar Solicitudes",
      description: "Revisar tiempo libre pendiente",
      icon: CalendarDays,
      color: "bg-orange-500",
      action: () => navigate('/vacation-approval'),
    },
    {
      title: "Configurar Empresa",
      description: "Ajustar branding y envío",
      icon: FileBadge2,
      color: "bg-slate-600",
      action: () => navigate('/settings/payslip'),
    },
  ], [navigate]);

  if (isLoading) {
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

  if (!isLoadingCompanies && !selectedCompany) {
    return (
      <Card className="border-dashed border-2 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>No hay una empresa seleccionada</CardTitle>
              <CardDescription>
                Asigna una empresa a tu usuario o crea una nueva para empezar a usar el sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/create-company")}>
            Crear Empresa
          </Button>
          <Button variant="outline" onClick={() => navigate("/users")}>
            Revisar usuarios y accesos
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="absolute inset-x-0 top-0 h-px bg-[hsl(var(--gold))]/70" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--gold-dark))]" />
              <Badge className="border-border bg-secondary text-foreground hover:bg-secondary">
                Sistema Multi-Empresa
              </Badge>
            </div>
            <p className="acl-eyebrow mb-3">ACL Web</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              ACL Web · Planillas
            </h1>
            <p className="text-lg text-foreground">
              {selectedCompany?.legal_name || selectedCompany?.name || 'Seleccione una empresa'}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {selectedCompany?.juridical_id && <span>Cédula jurídica: {selectedCompany.juridical_id}</span>}
              {selectedCompany?.payroll_email_from && <span>Correo planilla: {selectedCompany.payroll_email_from}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              <DollarSign className="h-3 w-3 mr-1" />
              {selectedCompany?.base_currency || 'CRC'}
            </Badge>
            <Button 
              variant="default"
              onClick={() => navigate('/payroll-process')}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Nueva Planilla
            </Button>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <Card className="card-elevated">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Período de planilla:
          </div>
          <Select
            value={activeBatch?.id || ''}
            onValueChange={(v) => setSelectedBatchId(v)}
          >
            <SelectTrigger className="w-full sm:w-[360px]">
              <SelectValue placeholder="Seleccione un período" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label} · {b.status}
                </SelectItem>
              ))}
              {batches.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">Sin planillas</div>
              )}
            </SelectContent>
          </Select>
          {activeBatch && (
            <Badge variant="outline" className="ml-auto">
              {activeBatch.label}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards Grid - Using memoized components */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Salario Bruto Período"
          value={formatCurrency(kpiData.grossPeriod, 'CRC')}
          subtitle={activeBatch?.label || 'Último período'}
          icon={DollarSign}
          iconBg="bg-emerald-100 group-hover:bg-emerald-200 text-emerald-600"
          borderColor="border-l-emerald-500"
          subtitleIcon={TrendingUp}
          subtitleColor="text-emerald-600"
        />
        <KPICard
          title="Salario Neto"
          value={formatCurrency(kpiData.netPay, 'CRC')}
          subtitle="A depositar"
          icon={TrendingUp}
          iconBg="bg-blue-100 group-hover:bg-blue-200 text-blue-600"
          borderColor="border-l-blue-500"
          subtitleIcon={CheckCircle2}
          subtitleColor="text-blue-600"
        />
        <KPICard
          title="Colaboradores Activos"
          value={kpiData.activeEmployees.toString()}
          subtitle="En planilla"
          icon={Users}
          iconBg="bg-purple-100 group-hover:bg-purple-200 text-purple-600"
          borderColor="border-l-purple-500"
          subtitleIcon={Users}
          subtitleColor="text-purple-600"
        />
        <KPICard
          title="Cargas Patronales"
          value={formatCurrency(kpiData.employerCharges, 'CRC')}
          subtitle="CCSS + Otros"
          icon={Building2}
          iconBg="bg-amber-100 group-hover:bg-amber-200 text-amber-600"
          borderColor="border-l-amber-500"
          subtitleIcon={Building2}
          subtitleColor="text-amber-600"
        />
      </div>

      {/* Additional widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard
          title="Días de vacaciones pendientes"
          value={kpiData.pendingVacationDays.toFixed(1)}
          subtitle="Saldo acumulado (empleados activos)"
          icon={Palmtree}
          iconBg="bg-teal-100 group-hover:bg-teal-200 text-teal-600"
          borderColor="border-l-teal-500"
          subtitleIcon={Palmtree}
          subtitleColor="text-teal-600"
        />
        <KPICard
          title="Salarios pagados últimos 6 meses"
          value={formatCurrency(kpiData.netPaid6Months, 'CRC')}
          subtitle="Suma de netos pagados"
          icon={Wallet}
          iconBg="bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600"
          borderColor="border-l-indigo-500"
          subtitleIcon={TrendingUp}
          subtitleColor="text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle>Centro de Operaciones RRHH</CardTitle>
            <CardDescription>
              Visibilidad rápida de solicitudes, colillas y configuración de la empresa activa.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 text-orange-600" />
                <p className="font-medium">Tiempo libre</p>
              </div>
              <p className="text-3xl font-bold">{kpiData.pendingVacations}</p>
              <p className="text-sm text-muted-foreground">
                {kpiData.pendingManagerApprovals} jefe / {kpiData.pendingHRApprovals} RRHH
              </p>
              <Button variant="link" className="px-0 mt-2" onClick={() => navigate('/vacation-approval')}>
                Revisar ahora
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-blue-600" />
                <p className="font-medium">Colillas</p>
              </div>
              <p className="text-3xl font-bold">{kpiData.pendingPayslips}</p>
              <p className="text-sm text-muted-foreground">pendientes de envío</p>
              <Button variant="link" className="px-0 mt-2" onClick={() => navigate('/payslips')}>
                Ir a envíos
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="font-medium">Último lote</p>
              </div>
              <p className="text-lg font-semibold">
                {latestBatch?.status || 'Sin planilla reciente'}
              </p>
              <p className="text-sm text-muted-foreground">
                {latestBatch?.batch_id ? `Lote ${latestBatch.batch_id}` : 'Cree una nueva planilla para iniciar'}
              </p>
              <Button variant="link" className="px-0 mt-2" onClick={() => navigate('/payroll-process')}>
                Abrir flujo
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Portal del Colaborador</CardTitle>
            <CardDescription>
              Puntos clave para el autoservicio sobre el dominio de ACL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
              <p className="text-sm text-muted-foreground">Dominio objetivo</p>
              <p className="font-semibold">aclcostarica.com</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Constancias laborales y salariales listas para autoservicio.</p>
              <p>Solicitudes de vacaciones, día libre, medio día y permiso sin goce.</p>
              <p>Entrega de colillas por empresa con branding y correo emisor configurables.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate('/settings/payslip')}>
              Ajustar identidad de empresa
            </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                onClick={() => navigate('/vacation-approval')}
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Solicitudes de Tiempo Libre</p>
                    <p className="text-sm text-amber-700">
                      {kpiData.pendingManagerApprovals} jefe / {kpiData.pendingHRApprovals} RRHH
                    </p>
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
