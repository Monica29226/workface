import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface PayrollChartsProps {
  language: "es" | "en";
}

export function PayrollCharts({ language }: PayrollChartsProps) {
  const labels = {
    es: {
      monthlySalaries: "Salarios Mensuales (₡)",
      departmentDistribution: "Distribución por Departamento", 
      trends: "Tendencias de Planilla",
      month: "Mes",
      amount: "Monto",
      employees: "empleados"
    },
    en: {
      monthlySalaries: "Monthly Salaries (₡)",
      departmentDistribution: "Department Distribution",
      trends: "Payroll Trends", 
      month: "Month",
      amount: "Amount",
      employees: "employees"
    }
  };

  const t = labels[language];

  const monthlyData = [
    { month: "Ene", amount: 2100000 },
    { month: "Feb", amount: 2200000 },
    { month: "Mar", amount: 2150000 },
    { month: "Abr", amount: 2300000 },
    { month: "May", amount: 2250000 },
    { month: "Jun", amount: 2400000 },
    { month: "Jul", amount: 2350000 },
    { month: "Ago", amount: 2450000 },
    { month: "Sep", amount: 2500000 }
  ];

  const departmentData = [
    { name: "Administración", value: 850000, employees: 8, color: "hsl(var(--primary))" },
    { name: "Operaciones", value: 920000, employees: 12, color: "hsl(var(--accent))" },
    { name: "Servicios", value: 680000, employees: 15, color: "hsl(var(--secondary))" },
    { name: "Mantenimiento", value: 450000, employees: 10, color: "hsl(var(--muted-foreground))" }
  ];

  const trendData = [
    { month: "Jun", gross: 2400000, net: 1920000 },
    { month: "Jul", gross: 2350000, net: 1880000 },
    { month: "Ago", gross: 2450000, net: 1960000 },
    { month: "Sep", gross: 2500000, net: 2000000 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Monthly Salaries Bar Chart */}
      <Card className="lg:col-span-2 card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t.monthlySalaries}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `₡${(value / 1000000).toFixed(1)}M`}
              />
              <Bar 
                dataKey="amount" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department Distribution Pie Chart */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>{t.departmentDistribution}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {departmentData.map((dept, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: dept.color }}
                  />
                  <span>{dept.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {dept.employees} {t.employees}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trends Line Chart */}
      <Card className="lg:col-span-3 card-elevated">
        <CardHeader>
          <CardTitle>{t.trends}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `₡${(value / 1000000).toFixed(1)}M`}
              />
              <Line 
                type="monotone" 
                dataKey="gross" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))" }}
                name="Salario Bruto"
              />
              <Line 
                type="monotone" 
                dataKey="net" 
                stroke="hsl(var(--accent))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--accent))" }}
                name="Salario Neto"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}