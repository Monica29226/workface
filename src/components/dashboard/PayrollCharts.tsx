import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface PayrollChartsProps {
  language: "es" | "en";
}

const costCenterData = [
  { name: "Administración", bruto: 1425000, deducciones: 185250, neto: 1239750 },
  { name: "Programas", bruto: 2450000, deducciones: 318500, neto: 2131500 },
  { name: "Freedom Academy", bruto: 1250000, deducciones: 162500, neto: 1087500 },
  { name: "Operaciones", bruto: 1300000, deducciones: 169000, neto: 1131000 },
  { name: "Mantenimiento", bruto: 469615, deducciones: 104101, neto: 365514 }
];

const trendData = [
  { periodo: "May", nomina: 5800000 },
  { periodo: "Jun", nomina: 6100000 },
  { periodo: "Jul", nomina: 6350000 },
  { periodo: "Ago", nomina: 6200000 },
  { periodo: "Sep", nomina: 6894615 },
  { periodo: "Oct", nomina: 7100000 }
];

const hoursData = [
  { actividad: "Administración", laboral: 168, sabado: 16, domingo: 8, feriado: 0 },
  { actividad: "Operación Campo", laboral: 152, sabado: 32, domingo: 16, feriado: 8 },
  { actividad: "Programas", laboral: 184, sabado: 24, domingo: 8, feriado: 0 },
  { actividad: "Mantenimiento", laboral: 96, sabado: 16, domingo: 8, feriado: 0 }
];

const departmentData = [
  { name: "Finanzas", value: 2, color: "#0B2B4C" },
  { name: "Bliss", value: 1, color: "#2A9D8F" },
  { name: "Freedom Academy", value: 1, color: "#E9EDF1" },
  { name: "Campo", value: 2, color: "#F5EFE6" },
  { name: "Taller", value: 1, color: "#0B2B4C" }
];

export const PayrollCharts = ({ language = "es" }: PayrollChartsProps) => {
  const labels = {
    es: {
      costCenter: "Bruto / Deducciones / Neto por Centro de Costo",
      trend: "Tendencia de Nómina (Últimos 6 Períodos)",
      hours: "Horas por Actividad (Laboral vs Fin de Semana)",
      departments: "Empleados por Departamento",
      gross: "Bruto",
      deductions: "Deducciones", 
      net: "Neto",
      regular: "Laboral",
      saturday: "Sábado",
      sunday: "Domingo",
      holiday: "Feriado"
    },
    en: {
      costCenter: "Gross / Deductions / Net by Cost Center",
      trend: "Payroll Trend (Last 6 Periods)",
      hours: "Hours by Activity (Regular vs Weekend)",
      departments: "Employees by Department",
      gross: "Gross",
      deductions: "Deductions",
      net: "Net", 
      regular: "Regular",
      saturday: "Saturday",
      sunday: "Sunday",
      holiday: "Holiday"
    }
  };

  const t = labels[language];

  const formatCurrency = (value: number) => {
    return `₡${new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0 }).format(value)}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Cost Center Chart */}
      <Card className="card-elevated col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t.costCenter}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costCenterData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `₡${(value/1000000).toFixed(1)}M`} />
              <Bar dataKey="bruto" stackId="a" fill="hsl(var(--navy))" name={t.gross} />
              <Bar dataKey="deducciones" stackId="a" fill="hsl(var(--destructive))" name={t.deductions} />
              <Bar dataKey="neto" stackId="b" fill="hsl(var(--teal))" name={t.net} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">{t.trend}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(value) => `₡${(value/1000000).toFixed(1)}M`} />
              <Line 
                type="monotone" 
                dataKey="nomina" 
                stroke="hsl(var(--teal))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--teal))", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department Pie Chart */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">{t.departments}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {departmentData.map((dept, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: dept.color }}
                />
                <span className="text-xs">{dept.name} ({dept.value})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hours Chart */}
      <Card className="card-elevated col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t.hours}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hoursData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="actividad" tick={{ fontSize: 12 }} />
              <YAxis />
              <Bar dataKey="laboral" fill="hsl(var(--primary))" name={t.regular} />
              <Bar dataKey="sabado" fill="hsl(var(--teal))" name={t.saturday} />
              <Bar dataKey="domingo" fill="hsl(var(--teal-light))" name={t.sunday} />
              <Bar dataKey="feriado" fill="hsl(var(--destructive))" name={t.holiday} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};