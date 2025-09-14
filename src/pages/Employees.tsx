import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Edit, 
  Trash2,
  Calculator
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency, formatDate, calculateVacationDays, calculateAguinaldo } from "@/lib/utils";

interface Employee {
  id: string;
  cedula: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  costCenter: string;
  hireDate: string;
  monthlySalary: number;
  currency: string;
  status: 'active' | 'inactive';
}

export function Employees() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  // Demo employees data
  const getEmployeesData = (): Employee[] => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      return [
        {
          id: '1',
          cedula: '1-074-50630',
          firstName: 'Andrés',
          lastName: 'Hidalgo Vega',
          email: 'andres@alturasdetenorio.com',
          phone: '8888-8888',
          position: 'Gerente General',
          department: 'Administración',
          costCenter: 'Administración',
          hireDate: '2024-01-15',
          monthlySalary: 3301433,
          currency: 'CRC',
          status: 'active'
        },
        {
          id: '2',
          cedula: '3-456-789',
          firstName: 'María',
          lastName: 'González Rojas',
          email: 'maria@alturasdetenorio.com',
          phone: '7777-7777',
          position: 'Operaria de Campo',
          department: 'Campo',
          costCenter: 'Operaciones',
          hireDate: '2024-02-01',
          monthlySalary: 850000,
          currency: 'CRC',
          status: 'active'
        },
        {
          id: '3',
          cedula: '2-789-456',
          firstName: 'Carlos',
          lastName: 'Méndez Vega',
          email: 'carlos@alturasdetenorio.com',
          phone: '6666-6666',
          position: 'Supervisor de Campo',
          department: 'Campo',
          costCenter: 'Operaciones',
          hireDate: '2024-01-20',
          monthlySalary: 650000,
          currency: 'CRC',
          status: 'active'
        }
      ];
    }

    // Default Horizonte Positivo employees
    return [
      {
        id: '1',
        cedula: '1-1354-0838',
        firstName: 'Gabriel',
        lastName: 'Cordero González',
        email: 'gabriel@horizontepositivo.org',
        phone: '8888-1234',
        position: 'Director Ejecutivo',
        department: 'Administración',
        costCenter: 'Administración',
        hireDate: '2020-03-01',
        monthlySalary: 2424480,
        currency: 'CRC',
        status: 'active'
      },
      {
        id: '2',
        cedula: '1-1936-0602',
        firstName: 'Krissya Paulina',
        lastName: 'Gutiérrez Solís',
        email: 'krissya@horizontepositivo.org',
        phone: '7777-5678',
        position: 'Soporte Interno',
        department: 'Programas Sociales',
        costCenter: 'Programas',
        hireDate: '2021-06-15',
        monthlySalary: 606120,
        currency: 'CRC',
        status: 'active'
      },
      {
        id: '3',
        cedula: '1-1691-0435',
        firstName: 'David',
        lastName: 'Marín Mora',
        email: 'david@horizontepositivo.org',
        phone: '6666-9876',
        position: 'Coordinador de Programas',
        department: 'Programas Sociales',
        costCenter: 'Programas',
        hireDate: '2021-01-10',
        monthlySalary: 808160,
        currency: 'CRC',
        status: 'active'
      },
      {
        id: '4',
        cedula: '3-0470-0672',
        firstName: 'Rebeca',
        lastName: 'Gamboa Venegas',
        email: 'rebeca@horizontepositivo.org',
        phone: '8888-4321',
        position: 'Contadora',
        department: 'Finanzas',
        costCenter: 'Administración',
        hireDate: '2022-04-01',
        monthlySalary: 631375,
        currency: 'CRC',
        status: 'active'
      },
      {
        id: '5',
        cedula: '3-0517-0207',
        firstName: 'Jonathan',
        lastName: 'Campos Carpio',
        email: 'jonathan@horizontepositivo.org',
        phone: '7777-8765',
        position: 'Asistente Contable',
        department: 'Finanzas',
        costCenter: 'Administración',
        hireDate: '2023-01-15',
        monthlySalary: 909180,
        currency: 'CRC',
        status: 'active'
      }
    ];
  };

  const employees = getEmployeesData();
  
  const filteredEmployees = employees.filter(employee =>
    `${employee.firstName} ${employee.lastName} ${employee.cedula} ${employee.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const calculateEmployeeMetrics = (employee: Employee) => {
    const monthsWorked = Math.floor((new Date().getTime() - new Date(employee.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
    const vacationDays = calculateVacationDays(monthsWorked);
    const vacationAmount = (employee.monthlySalary / 30) * vacationDays;
    const aguinaldo = calculateAguinaldo(employee.monthlySalary * 12, 12);
    
    return {
      monthsWorked,
      vacationDays: Math.round(vacationDays * 100) / 100,
      vacationAmount,
      aguinaldo
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            {t('nav.employees')}
          </h1>
          <p className="text-muted-foreground">
            Gestión de empleados para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            {t('common.import')} CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {t('common.export')} CSV
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <Plus className="h-4 w-4" />
            {t('common.add')} Empleado
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cédula o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              {t('common.filter')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Lista de Empleados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">{t('employee.cedula')}</TableHead>
                  <TableHead className="font-semibold">{t('employee.name')}</TableHead>
                  <TableHead className="font-semibold">{t('employee.position')}</TableHead>
                  <TableHead className="font-semibold">{t('employee.department')}</TableHead>
                  <TableHead className="font-semibold">{t('employee.hire_date')}</TableHead>
                  <TableHead className="font-semibold text-right">{t('employee.salary')}</TableHead>
                  <TableHead className="font-semibold text-center">{t('common.status')}</TableHead>
                  <TableHead className="font-semibold text-center">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const metrics = calculateEmployeeMetrics(employee);
                  return (
                    <TableRow key={employee.id} className="hover:bg-muted/25">
                      <TableCell className="font-mono">
                        {employee.cedula}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {employee.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{employee.department}</div>
                          <div className="text-sm text-muted-foreground">
                            {employee.costCenter}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(employee.hireDate)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(employee.monthlySalary, employee.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={employee.status === 'active' ? 'default' : 'secondary'}
                          className={employee.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                        >
                          {employee.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            title="Editar empleado"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            title="Cálculos actuales"
                          >
                            <Calculator className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Eliminar empleado"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Live Calculation Panel */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Panel de Cálculo en Vivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">VACACIONES ACUMULADAS</h3>
              <div className="text-2xl font-bold text-teal">
                {employees.reduce((acc, emp) => acc + calculateEmployeeMetrics(emp).vacationDays, 0).toFixed(1)} días
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(employees.reduce((acc, emp) => acc + calculateEmployeeMetrics(emp).vacationAmount, 0), 'CRC')}
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">AGUINALDO PROPORCIONAL</h3>
              <div className="text-2xl font-bold text-teal">
                {formatCurrency(employees.reduce((acc, emp) => acc + calculateEmployeeMetrics(emp).aguinaldo, 0), 'CRC')}
              </div>
              <div className="text-sm text-muted-foreground">
                Período completo 2025
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">NÓMINA MENSUAL</h3>
              <div className="text-2xl font-bold text-teal">
                {formatCurrency(employees.reduce((acc, emp) => acc + emp.monthlySalary, 0), 'CRC')}
              </div>
              <div className="text-sm text-muted-foreground">
                Total bruto empleados
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">EMPLEADOS ACTIVOS</h3>
              <div className="text-2xl font-bold text-teal">
                {employees.filter(emp => emp.status === 'active').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Total en planilla
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}