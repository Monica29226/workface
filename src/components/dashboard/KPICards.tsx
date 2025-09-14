import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, Clock, FileText } from "lucide-react";

interface KPICardsProps {
  language: "es" | "en";
}

export function KPICards({ language }: KPICardsProps) {
  const labels = {
    es: {
      totalSalaries: "Total Salarios",
      totalEmployees: "Total Empleados",
      avgHours: "Promedio Horas",
      activePeriods: "Períodos Activos",
      compared: "vs mes anterior",
      increase: "aumento",
      decrease: "disminución",
      hours: "horas",
      active: "activos"
    },
    en: {
      totalSalaries: "Total Salaries",
      totalEmployees: "Total Employees", 
      avgHours: "Average Hours",
      activePeriods: "Active Periods",
      compared: "vs previous month",
      increase: "increase",
      decrease: "decrease",
      hours: "hours",
      active: "active"
    }
  };

  const t = labels[language];

  const kpis = [
    {
      title: t.totalSalaries,
      value: "₡2,450,000",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      title: t.totalEmployees,
      value: "45",
      change: "+3",
      trend: "up", 
      icon: Users,
      color: "text-blue-600",
      suffix: t.active
    },
    {
      title: t.avgHours,
      value: "168",
      change: "-2.1%",
      trend: "down",
      icon: Clock,
      color: "text-orange-600",
      suffix: t.hours
    },
    {
      title: t.activePeriods,
      value: "2",
      change: "0",
      trend: "neutral",
      icon: FileText,
      color: "text-purple-600",
      suffix: t.active
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.trend === "up";
        const isNegative = kpi.trend === "down";
        
        return (
          <Card key={index} className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">
                {kpi.value}
                {kpi.suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{kpi.suffix}</span>}
              </div>
              {kpi.change !== "0" && (
                <div className="flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : isNegative ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <Badge 
                    variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"}
                    className="text-xs px-1.5 py-0.5"
                  >
                    {kpi.change}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-1">
                    {t.compared}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}