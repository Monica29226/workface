import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Eye, Mail } from "lucide-react";

interface PayrollTableProps {
  language: "es" | "en";
}

const employeeData = [
  {
    cedula: "1-1354-0838",
    nombre: "Gabriel Cordero González",
    centro_costo: "Administración",
    departamento: "Finanzas",
    bruto: 2424480,
    deducciones: 463388,
    neto: 1961092,
    horas: 184,
    horas_weekend: 16,
    estado: "Aprobado"
  },
  {
    cedula: "1-1936-0602", 
    nombre: "Krissya Paulina Gutiérrez Solís",
    centro_costo: "Programas",
    departamento: "Bliss",
    bruto: 606120,
    deducciones: 64673,
    neto: 541447,
    horas: 168,
    horas_weekend: 8,
    estado: "Aprobado"
  },
  {
    cedula: "1-1691-0435",
    nombre: "David Marín Mora", 
    centro_costo: "Programas",
    departamento: "Freedom Academy",
    bruto: 808160,
    deducciones: 86231,
    neto: 721929,
    horas: 176,
    horas_weekend: 0,
    estado: "En Revisión"
  },
  {
    cedula: "3-0470-0672",
    nombre: "Rebeca Gamboa Venegas",
    centro_costo: "Administración", 
    departamento: "Finanzas",
    bruto: 631375,
    deducciones: 67368,
    neto: 564007,
    horas: 168,
    horas_weekend: 8,
    estado: "Aprobado"
  },
  {
    cedula: "3-0517-0207",
    nombre: "Jonathan Campos Carpio",
    centro_costo: "Operaciones",
    departamento: "Campo", 
    bruto: 909180,
    deducciones: 97010,
    neto: 812170,
    horas: 184,
    horas_weekend: 24,
    estado: "Aprobado"
  }
];

export const PayrollTable = ({ language = "es" }: PayrollTableProps) => {
  const labels = {
    es: {
      title: "Detalle por Empleado - Setiembre 2025",
      employee: "Empleado",
      costCenter: "Centro de Costo",
      department: "Departamento", 
      gross: "Bruto",
      deductions: "Deducciones",
      net: "Neto",
      hours: "Horas",
      weekend: "F.Semana",
      status: "Estado",
      actions: "Acciones",
      approved: "Aprobado",
      review: "En Revisión",
      viewPayslip: "Ver Colilla",
      sendEmail: "Enviar Email",
      exportData: "Exportar"
    },
    en: {
      title: "Employee Detail - September 2025",
      employee: "Employee",
      costCenter: "Cost Center", 
      department: "Department",
      gross: "Gross",
      deductions: "Deductions",
      net: "Net",
      hours: "Hours",
      weekend: "Weekend",
      status: "Status",
      actions: "Actions",
      approved: "Approved",
      review: "Under Review",
      viewPayslip: "View Payslip",
      sendEmail: "Send Email", 
      exportData: "Export"
    }
  };

  const t = labels[language];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Aprobado":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{t.approved}</Badge>;
      case "En Revisión":
        return <Badge variant="secondary">{t.review}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{t.title}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {t.exportData}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">{t.employee}</TableHead>
                <TableHead className="font-semibold">{t.costCenter}</TableHead>
                <TableHead className="font-semibold">{t.department}</TableHead>
                <TableHead className="font-semibold text-right">{t.gross}</TableHead>
                <TableHead className="font-semibold text-right">{t.deductions}</TableHead>
                <TableHead className="font-semibold text-right">{t.net}</TableHead>
                <TableHead className="font-semibold text-center">{t.hours}</TableHead>
                <TableHead className="font-semibold text-center">{t.weekend}</TableHead>
                <TableHead className="font-semibold text-center">{t.status}</TableHead>
                <TableHead className="font-semibold text-center">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeData.map((employee, index) => (
                <TableRow key={index} className="hover:bg-muted/25">
                  <TableCell>
                    <div>
                      <div className="font-medium">{employee.nombre}</div>
                      <div className="text-sm text-muted-foreground">{employee.cedula}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {employee.centro_costo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{employee.departamento}</TableCell>
                  <TableCell className="text-right font-mono">
                    ₡{formatCurrency(employee.bruto)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    ₡{formatCurrency(employee.deducciones)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-teal">
                    ₡{formatCurrency(employee.neto)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono">
                      {employee.horas}h
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {employee.horas_weekend > 0 ? (
                      <Badge className="bg-teal/10 text-teal font-mono">
                        {employee.horas_weekend}h
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(employee.estado)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};