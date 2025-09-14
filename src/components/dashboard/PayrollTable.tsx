import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Edit, Download } from "lucide-react";

interface PayrollTableProps {
  language: "es" | "en";
}

export function PayrollTable({ language }: PayrollTableProps) {
  const labels = {
    es: {
      employeeDetails: "Detalle de Empleados - Período Actual",
      employee: "Empleado",
      department: "Departamento", 
      baseSalary: "Salario Base",
      grossSalary: "Salario Bruto",
      deductions: "Deducciones",
      netSalary: "Salario Neto",
      status: "Estado",
      actions: "Acciones",
      view: "Ver",
      edit: "Editar",
      download: "Descargar",
      draft: "Borrador",
      approved: "Aprobado",
      processed: "Procesado"
    },
    en: {
      employeeDetails: "Employee Details - Current Period",
      employee: "Employee",
      department: "Department",
      baseSalary: "Base Salary", 
      grossSalary: "Gross Salary",
      deductions: "Deductions",
      netSalary: "Net Salary",
      status: "Status",
      actions: "Actions",
      view: "View",
      edit: "Edit", 
      download: "Download",
      draft: "Draft",
      approved: "Approved",
      processed: "Processed"
    }
  };

  const t = labels[language];

  const employees = [
    {
      id: 1,
      name: "Ana Rodríguez González",
      department: "Administración",
      baseSalary: 450000,
      grossSalary: 485000,
      deductions: 97000,
      netSalary: 388000,
      status: "draft"
    },
    {
      id: 2,
      name: "Carlos Méndez Jiménez", 
      department: "Operaciones",
      baseSalary: 380000,
      grossSalary: 420000,
      deductions: 84000,
      netSalary: 336000,
      status: "approved"
    },
    {
      id: 3,
      name: "María José Herrera",
      department: "Servicios", 
      baseSalary: 325000,
      grossSalary: 348000,
      deductions: 69600,
      netSalary: 278400,
      status: "processed"
    },
    {
      id: 4,
      name: "José Luis Vargas",
      department: "Mantenimiento",
      baseSalary: 290000,
      grossSalary: 315000,
      deductions: 63000, 
      netSalary: 252000,
      status: "draft"
    },
    {
      id: 5,
      name: "Sofia Chen Wong",
      department: "Administración",
      baseSalary: 520000,
      grossSalary: 575000,
      deductions: 115000,
      netSalary: 460000,
      status: "approved"
    }
  ];

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString('es-CR')}`;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "draft": return "secondary";
      case "approved": return "default";
      case "processed": return "outline";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return t.draft;
      case "approved": return t.approved;
      case "processed": return t.processed;
      default: return status;
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle>{t.employeeDetails}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.employee}</TableHead>
                <TableHead>{t.department}</TableHead>
                <TableHead className="text-right">{t.baseSalary}</TableHead>
                <TableHead className="text-right">{t.grossSalary}</TableHead>
                <TableHead className="text-right">{t.deductions}</TableHead>
                <TableHead className="text-right">{t.netSalary}</TableHead>
                <TableHead className="text-center">{t.status}</TableHead>
                <TableHead className="text-center">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {employee.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {employee.department}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(employee.baseSalary)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(employee.grossSalary)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    -{formatCurrency(employee.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(employee.netSalary)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getStatusVariant(employee.status)}>
                      {getStatusLabel(employee.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
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
}