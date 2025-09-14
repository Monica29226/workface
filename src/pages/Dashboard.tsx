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

export function Dashboard() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();

  // Demo KPIs data based on selected company
  const getKPIData = () => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      // Alturas de Tenorio data
      return {
        grossPeriod: 4261433,
        totalDeductions: 613063,
        netPay: 3648370,
        employerCharges: 1107972,
        activeEmployees: 3,
        avgCostEmployee: 1788457
      };
    }
    
    // Horizonte Positivo data (default)
    return {
      grossPeriod: 5469315,
      totalDeductions: 563671,
      netPay: 4905644,
      employerCharges: 1421962,
      activeEmployees: 5,
      avgCostEmployee: 1093863
    };
  };

  const kpiData = getKPIData();

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground">
            {selectedCompany?.name} - Setiembre 2025
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {t('status.approved')}
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {t('common.export')}
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <FileText className="h-4 w-4" />
            Ver Colillas
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="card-elevated hover:scale-[1.02] transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-navy">
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
        {/* Gross vs Deductions Chart */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy">
              Bruto vs Deducciones por Centro de Costo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001' ? (
                // Alturas de Tenorio data
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Operaciones</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600">₡3,301,433</span>
                      <span className="text-sm text-red-600">₡400,000</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Administración</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600">₡960,000</span>
                      <span className="text-sm text-red-600">₡213,063</span>
                    </div>
                  </div>
                </>
              ) : (
                // Horizonte Positivo data
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Administración</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600">₡2,424,480</span>
                      <span className="text-sm text-red-600">₡290,000</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Programas</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600">₡3,044,835</span>
                      <span className="text-sm text-red-600">₡273,671</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Employees by Department */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy">
              Empleados por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Campo</span>
                    <Badge variant="secondary">2</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Administración</span>
                    <Badge variant="secondary">1</Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Finanzas</span>
                    <Badge variant="secondary">2</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Programas Sociales</span>
                    <Badge variant="secondary">2</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Administración</span>
                    <Badge variant="secondary">1</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Acciones Rápidas</CardTitle>
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