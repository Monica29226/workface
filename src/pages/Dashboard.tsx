import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Download, 
  FileText, 
  Users, 
  DollarSign, 
  TrendingUp,
  Building2,
  Calculator
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
    avgCostEmployee: 0
  });
  const [loading, setLoading] = useState(true);

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
        .select('id, period_start, period_end')
        .eq('company_id', selectedCompany.id)
        .in('status', ['aprobado', 'enviado'])
        .order('period_end', { ascending: false })
        .limit(1)
        .single();

      if (latestBatch) {
        // Get payroll lines for the latest batch
        const { data: payrollLines } = await supabase
          .from('payroll_lines')
          .select('gross_salary, deductions, net_pay, employer_contrib, currency, exchange_rate_to_base')
          .eq('batch_id', latestBatch.id);

        if (payrollLines) {
          // Convert all to CRC for totals
          let totalGross = 0;
          let totalDeductions = 0;
          let totalNetPay = 0;
          let totalEmployerCharges = 0;

          payrollLines.forEach(line => {
            const rate = line.exchange_rate_to_base || 1;
            const multiplier = line.currency === 'CRC' ? 1 : rate;
            
            totalGross += line.gross_salary * multiplier;
            totalDeductions += (line.deductions || 0) * multiplier;
            totalNetPay += line.net_pay * multiplier;
            totalEmployerCharges += (line.employer_contrib || 0) * multiplier;
          });

          // Get active employees count
          const { count: activeEmployeesCount } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', selectedCompany.id)
            .eq('status', 'activo');

          const employeeCount = activeEmployeesCount || 1;
          
          setKpiData({
            grossPeriod: totalGross,
            totalDeductions: totalDeductions,
            netPay: totalNetPay,
            employerCharges: totalEmployerCharges,
            activeEmployees: employeeCount,
            avgCostEmployee: totalGross / employeeCount
          });
        }
      } else {
        // No payroll data yet, just show employee count
        const { count: activeEmployeesCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', selectedCompany.id)
          .eq('status', 'activo');

        setKpiData({
          grossPeriod: 0,
          totalDeductions: 0,
          netPay: 0,
          employerCharges: 0,
          activeEmployees: activeEmployeesCount || 0,
          avgCostEmployee: 0
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = [
    {
      title: t('dashboard.gross_period'),
      value: formatCurrency(kpiData.grossPeriod, 'CRC'),
      icon: DollarSign,
      trend: '+8.2%',
      trendColor: 'text-green-600'
    },
    {
      title: t('dashboard.total_deductions'),
      value: formatCurrency(kpiData.totalDeductions, 'CRC'),
      icon: Calculator,
      trend: '+2.1%',
      trendColor: 'text-orange-600'
    },
    {
      title: t('dashboard.net_pay'),
      value: formatCurrency(kpiData.netPay, 'CRC'),
      icon: TrendingUp,
      trend: '+9.5%',
      trendColor: 'text-green-600'
    },
    {
      title: t('dashboard.employer_charges'),
      value: formatCurrency(kpiData.employerCharges, 'CRC'),
      icon: Building2,
      trend: '+8.2%',
      trendColor: 'text-blue-600'
    },
    {
      title: t('dashboard.active_employees'),
      value: kpiData.activeEmployees.toString(),
      icon: Users,
      trend: '0%',
      trendColor: 'text-gray-600'
    },
    {
      title: t('dashboard.avg_cost_employee'),
      value: formatCurrency(kpiData.avgCostEmployee, 'CRC'),
      icon: BarChart3,
      trend: '+8.2%',
      trendColor: 'text-green-600'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando datos del dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            ACL Payroll CR
          </h1>
          <p className="text-muted-foreground">
            {selectedCompany?.legal_name || selectedCompany?.name} - Sistema Multi-Empresa & Multi-Moneda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
            CRC
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {t('common.export')}
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <FileText className="h-4 w-4" />
            Ver Boletas
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="card-elevated hover:scale-[1.02] transition-all duration-200 border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {kpi.value}
              </div>
              <p className={`text-xs ${kpi.trendColor} flex items-center gap-1 mt-1`}>
                <TrendingUp className="h-3 w-3" />
                {kpi.trend} desde período anterior
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Note: Charts would show real data when cost centers are implemented */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-primary">
              Bruto vs Deducciones por Centro de Costo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              Datos de centros de costo disponibles cuando se procesen planillas
            </div>
          </CardContent>
        </Card>

        {/* Employees by Department */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-primary">
              Empleados por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              Datos de departamento disponibles cuando se configuren en empleados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-primary">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="justify-start gap-2 h-12"
              onClick={() => navigate('/employees')}
            >
              <Users className="h-4 w-4" />
              Nuevo Empleado
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2 h-12"
              onClick={() => navigate('/payroll-process')}
            >
              <FileText className="h-4 w-4" />
              Generar Planilla
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2 h-12"
              onClick={() => navigate('/payroll-process')}
            >
              <Calculator className="h-4 w-4" />
              Procesar Nómina
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2 h-12"
              onClick={() => navigate('/liquidations')}
            >
              <Download className="h-4 w-4" />
              Archivo Bancario
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}