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
import { Download, Eye, Mail, FileText } from "lucide-react";

interface PayrollTableProps {
  language: "es" | "en";
}

// Get employee data based on selected company
const getEmployeeData = () => {
  const selectedCompany = localStorage.getItem('selectedCompany') || 'horizonte-positivo';
  
  if (selectedCompany === 'alturas-tenorio') {
    return [
      {
        cedula: "1-074-50630",
        nombre: "Andrés Hidalgo Vega",
        bruto: 3301433,
        cargas_sociales: 400000,
        retencion_salarial: 328059,
        neto: 2573374,
        aguinaldo: 275281,
        estado: "Aprobado"
      },
      {
        cedula: "3-456-789",
        nombre: "María González Rojas",
        bruto: 850000,
        cargas_sociales: 85000,
        retencion_salarial: 35000,
        neto: 730000,
        aguinaldo: 70833,
        estado: "Aprobado"
      },
      {
        cedula: "2-789-456",
        nombre: "Carlos Méndez Vega",
        bruto: 650000,
        cargas_sociales: 65000,
        retencion_salarial: 30000,
        neto: 555000,
        aguinaldo: 54167,
        estado: "En Revisión"
      }
    ];
  }
  
  // Default Horizonte Positivo data
  return [
    {
      cedula: "1-1354-0838",
      nombre: "Gabriel Cordero González",
      bruto: 2424480,
      cargas_sociales: 290000,
      retencion_salarial: 173388,
      neto: 1961092,
      aguinaldo: 202040,
      estado: "Aprobado"
    },
    {
      cedula: "1-1936-0602", 
      nombre: "Krissya Paulina Gutiérrez Solís",
      bruto: 606120,
      cargas_sociales: 45000,
      retencion_salarial: 19673,
      neto: 541447,
      aguinaldo: 50510,
      estado: "Aprobado"
    },
    {
      cedula: "1-1691-0435",
      nombre: "David Marín Mora", 
      bruto: 808160,
      cargas_sociales: 60000,
      retencion_salarial: 26231,
      neto: 721929,
      aguinaldo: 67347,
      estado: "En Revisión"
    },
    {
      cedula: "3-0470-0672",
      nombre: "Rebeca Gamboa Venegas",
      bruto: 631375,
      cargas_sociales: 48000,
      retencion_salarial: 19368,
      neto: 564007,
      aguinaldo: 52615,
      estado: "Aprobado"
    },
    {
      cedula: "3-0517-0207",
      nombre: "Jonathan Campos Carpio",
      bruto: 909180,
      cargas_sociales: 72000,
      retencion_salarial: 25010,
      neto: 812170,
      aguinaldo: 75765,
      estado: "Aprobado"
    }
  ];
};

export const PayrollTable = ({ language = "es" }: PayrollTableProps) => {
  const employeeData = getEmployeeData();

  const labels = {
    es: {
      title: "Detalle por Empleado - Setiembre 2025",
      employee: "Empleado",
      gross: "Bruto",
      socialCharges: "Cargas Sociales",
      salaryRetention: "Retención Salarial",
      net: "Neto",
      aguinaldo: "Aguinaldo (12 meses)",
      status: "Estado",
      actions: "Acciones",
      approved: "Aprobado",
      review: "En Revisión",
      viewPayslip: "Ver Colilla",
      sendEmail: "Enviar Email",
      sendToEmployee: "Enviar a Empleado",
      exportData: "Exportar"
    },
    en: {
      title: "Employee Detail - September 2025",
      employee: "Employee",
      gross: "Gross",
      socialCharges: "Social Charges",
      salaryRetention: "Salary Retention",
      net: "Net",
      aguinaldo: "Christmas Bonus (12 months)",
      status: "Status",
      actions: "Actions",
      approved: "Approved",
      review: "Under Review",
      viewPayslip: "View Payslip",
      sendEmail: "Send Email",
      sendToEmployee: "Send to Employee",
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

  const handleSendEmail = (employeeName: string) => {
    alert(`Funcionalidad de email requiere conexión a Supabase. Para enviar email a ${employeeName}, conecte su proyecto a Supabase.`);
  };

  const handleViewPayslip = (employeeName: string) => {
    alert(`Vista detallada de colilla para ${employeeName} - funcionalidad en desarrollo.`);
  };

  const handleExportData = () => {
    alert("Funcionalidad de exportación requiere conexión a Supabase para generar reportes completos.");
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{t.title}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportData}>
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
                <TableHead className="font-semibold text-right">{t.gross}</TableHead>
                <TableHead className="font-semibold text-right">{t.socialCharges}</TableHead>
                <TableHead className="font-semibold text-right">{t.salaryRetention}</TableHead>
                <TableHead className="font-semibold text-right">{t.net}</TableHead>
                <TableHead className="font-semibold text-right">{t.aguinaldo}</TableHead>
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
                  <TableCell className="text-right font-mono">
                    ₡{formatCurrency(employee.bruto)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    ₡{formatCurrency(employee.cargas_sociales)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    ₡{formatCurrency(employee.retencion_salarial)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-teal">
                    ₡{formatCurrency(employee.neto)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-green-600">
                    ₡{formatCurrency(employee.aguinaldo)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(employee.estado)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleViewPayslip(employee.nombre)}
                        title={t.viewPayslip}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleSendEmail(employee.nombre)}
                        title={t.sendEmail}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleSendEmail(employee.nombre)}
                        title={t.sendToEmployee}
                      >
                        <FileText className="h-4 w-4" />
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