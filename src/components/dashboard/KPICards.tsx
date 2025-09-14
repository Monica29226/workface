import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calculator,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface KPICardsProps {
  language: "es" | "en";
}

const kpiData = {
  grossPayroll: 6894615,
  totalDeductions: 940351,
  netPayable: 5954264,
  employerCharges: 1792600,
  activeEmployees: 7,
  avgCostPerEmployee: 985516
};

export const KPICards = ({ language = "es" }: KPICardsProps) => {
  const labels = {
    es: {
      grossPayroll: "Nómina Bruta",
      totalDeductions: "Deducciones Totales", 
      netPayable: "Neto a Depositar",
      employerCharges: "Cargas Patronales",
      activeEmployees: "Empleados Activos",
      avgCost: "Costo Promedio/Empleado",
      vsLastMonth: "vs mes anterior",
      currency: "₡"
    },
    en: {
      grossPayroll: "Gross Payroll",
      totalDeductions: "Total Deductions",
      netPayable: "Net Payable", 
      employerCharges: "Employer Charges",
      activeEmployees: "Active Employees",
      avgCost: "Avg Cost/Employee",
      vsLastMonth: "vs last month",
      currency: "₡"
    }
  };

  const t = labels[language];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const kpis = [
    {
      title: t.grossPayroll,
      value: `${t.currency}${formatCurrency(kpiData.grossPayroll)}`,
      change: "+12.5%",
      trend: "up" as const,
      icon: DollarSign,
      className: "gradient-navy text-white"
    },
    {
      title: t.totalDeductions,
      value: `${t.currency}${formatCurrency(kpiData.totalDeductions)}`,
      change: "+8.2%", 
      trend: "up" as const,
      icon: Calculator,
      className: "bg-destructive/10 text-destructive border-destructive/20"
    },
    {
      title: t.netPayable,
      value: `${t.currency}${formatCurrency(kpiData.netPayable)}`,
      change: "+14.1%",
      trend: "up" as const,
      icon: TrendingUp,
      className: "gradient-teal text-white"
    },
    {
      title: t.employerCharges,
      value: `${t.currency}${formatCurrency(kpiData.employerCharges)}`,
      change: "+11.8%",
      trend: "up" as const,
      icon: Calculator,
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20"
    },
    {
      title: t.activeEmployees,
      value: kpiData.activeEmployees.toString(),
      change: "+2",
      trend: "up" as const,
      icon: Users,
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20"
    },
    {
      title: t.avgCost,
      value: `${t.currency}${formatCurrency(kpiData.avgCostPerEmployee)}`,
      change: "-2.3%",
      trend: "down" as const,
      icon: DollarSign,
      className: "bg-green-500/10 text-green-600 border-green-500/20"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositiveTrend = kpi.trend === "up";
        
        return (
          <Card key={index} className="card-elevated border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${kpi.className}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">
                {kpi.value}
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isPositiveTrend ? "default" : "secondary"}
                  className="flex items-center gap-1 text-xs"
                >
                  {isPositiveTrend ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {kpi.change}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t.vsLastMonth}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};