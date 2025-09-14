import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  Receipt,
  FileText
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatDate } from "@/lib/utils";
import { PayrollProcessTab } from "@/components/timesheets/PayrollProcessTab";
import { ProjectCalendarTab } from "@/components/timesheets/ProjectCalendarTab";

interface Timesheet {
  id: string;
  employeeName: string;
  date: string;
  activity: string;
  project?: string;
  costCenter: string;
  hours: number;
  description: string;
  isWeekend: boolean;
  isHoliday: boolean;
  approved: boolean;
}

export function Timesheets() {
  const { t } = useLanguage();
  const { selectedCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const getTimesheetsData = (): Timesheet[] => {
    if (selectedCompany?.id === '550e8400-e29b-41d4-a716-446655440001') {
      return [
        {
          id: '1',
          employeeName: 'Andrés Hidalgo Vega',
          date: '2025-09-06',
          activity: 'Supervisión General',
          costCenter: 'Administración',
          hours: 8,
          description: 'Supervisión de operaciones diarias',
          isWeekend: true,
          isHoliday: false,
          approved: true
        },
        {
          id: '2',
          employeeName: 'María González Rojas',
          date: '2025-09-07',
          activity: 'Operación de Campo',
          project: 'Proyecto Turístico',
          costCenter: 'Operaciones',
          hours: 8,
          description: 'Trabajo en campo turístico',
          isWeekend: true,
          isHoliday: false,
          approved: false
        }
      ];
    }

    return [
      {
        id: '1',
        employeeName: 'Gabriel Cordero González',
        date: '2025-09-01',
        activity: 'Administración',
        costCenter: 'Administración',
        hours: 4,
        description: 'Gestión administrativa general',
        isWeekend: false,
        isHoliday: false,
        approved: true
      },
      {
        id: '2',
        employeeName: 'Gabriel Cordero González',
        date: '2025-09-01',
        activity: 'Apoyo Programas',
        costCenter: 'Programas',
        hours: 4,
        description: 'Apoyo en programas sociales',
        isWeekend: false,
        isHoliday: false,
        approved: true
      },
      {
        id: '3',
        employeeName: 'Krissya Paulina Gutiérrez Solís',
        date: '2025-09-02',
        activity: 'Soporte Técnico',
        costCenter: 'Programas',
        hours: 8,
        description: 'Soporte técnico a beneficiarios',
        isWeekend: false,
        isHoliday: false,
        approved: false
      }
    ];
  };

  const timesheets = getTimesheetsData();
  
  const filteredTimesheets = timesheets.filter(timesheet =>
    `${timesheet.employeeName} ${timesheet.activity} ${timesheet.costCenter}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (timesheet: Timesheet) => {
    if (timesheet.isWeekend) {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Fin de Semana</Badge>;
    }
    if (timesheet.isHoliday) {
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Feriado</Badge>;
    }
    if (timesheet.hours > 8) {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Horas Extra</Badge>;
    }
    return <Badge variant="outline">Normal</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            {t('nav.timesheets')}
          </h1>
          <p className="text-muted-foreground">
            Gestión de planilla y proyectos para {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <Plus className="h-4 w-4" />
            Nuevo Registro
          </Button>
        </div>
      </div>

      <Tabs defaultValue="timesheets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timesheets" className="gap-2">
            <Clock className="h-4 w-4" />
            Registro de Horas
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Receipt className="h-4 w-4" />
            Proceso de Planilla
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendario de Proyectos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="mt-6">
          <TimesheetsContent 
            timesheets={timesheets}
            filteredTimesheets={filteredTimesheets}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="payroll" className="mt-6">
          <PayrollProcessTab />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <ProjectCalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TimesheetsContentProps {
  timesheets: Timesheet[];
  filteredTimesheets: Timesheet[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  getStatusBadge: (timesheet: Timesheet) => JSX.Element;
}

function TimesheetsContent({ timesheets, filteredTimesheets, searchTerm, setSearchTerm, getStatusBadge }: TimesheetsContentProps) {
  return (
    <div className="space-y-6">

      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empleado, actividad o centro de costo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Registro de Horas - Setiembre 2025</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Empleado</TableHead>
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold">Actividad/Proyecto</TableHead>
                  <TableHead className="font-semibold">Centro de Costo</TableHead>
                  <TableHead className="font-semibold text-right">Horas</TableHead>
                  <TableHead className="font-semibold">Descripción</TableHead>
                  <TableHead className="font-semibold text-center">Tipo</TableHead>
                  <TableHead className="font-semibold text-center">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimesheets.map((timesheet) => (
                  <TableRow key={timesheet.id} className="hover:bg-muted/25">
                    <TableCell className="font-medium">
                      {timesheet.employeeName}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatDate(timesheet.date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{timesheet.activity}</div>
                        {timesheet.project && (
                          <div className="text-sm text-muted-foreground">
                            {timesheet.project}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{timesheet.costCenter}</TableCell>
                    <TableCell className="text-right font-mono text-teal font-semibold">
                      {timesheet.hours}h
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {timesheet.description}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(timesheet)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={timesheet.approved ? 'default' : 'secondary'}
                        className={timesheet.approved ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'}
                      >
                        {timesheet.approved ? 'Aprobado' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          title="Editar registro"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!timesheet.approved && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            title="Aprobar horas"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Resumen de Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Horas Regulares</span>
                <span className="font-semibold text-teal">
                  {timesheets.filter(t => !t.isWeekend && !t.isHoliday && t.hours <= 8).reduce((acc, t) => acc + t.hours, 0)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Horas Fin de Semana</span>
                <span className="font-semibold text-blue-600">
                  {timesheets.filter(t => t.isWeekend).reduce((acc, t) => acc + t.hours, 0)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Horas Extra</span>
                <span className="font-semibold text-orange-600">
                  {timesheets.filter(t => t.hours > 8).reduce((acc, t) => acc + Math.max(0, t.hours - 8), 0)}h
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Validaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Registros Pendientes</span>
                <Badge variant="secondary">
                  {timesheets.filter(t => !t.approved).length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Exceso Semanal</span>
                <Badge variant="outline">
                  0 empleados
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Aprobado</span>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  {timesheets.filter(t => t.approved).length} registros
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}