import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users
} from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { useCompany } from "@/contexts/CompanyContext";

interface EmployeeTimesheet {
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

export function ProjectCalendarTab() {
  const { selectedCompany } = useCompany();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const getTimesheetsData = (): EmployeeTimesheet[] => {
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
        },
        {
          id: '3',
          employeeName: 'Andrés Hidalgo Vega',
          date: '2025-09-08',
          activity: 'Reuniones',
          costCenter: 'Administración',
          hours: 4,
          description: 'Reuniones gerenciales',
          isWeekend: false,
          isHoliday: false,
          approved: true
        },
        {
          id: '4',
          employeeName: 'María González Rojas',
          date: '2025-09-08',
          activity: 'Capacitación',
          project: 'Programa Social',
          costCenter: 'Programas',
          hours: 6,
          description: 'Capacitación a beneficiarios',
          isWeekend: false,
          isHoliday: false,
          approved: true
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
      },
      {
        id: '4',
        employeeName: 'Gabriel Cordero González',
        date: '2025-09-03',
        activity: 'Capacitación',
        project: 'Programa Educativo',
        costCenter: 'Programas',
        hours: 6,
        description: 'Capacitación en nuevas metodologías',
        isWeekend: false,
        isHoliday: false,
        approved: true
      },
      {
        id: '5',
        employeeName: 'Krissya Paulina Gutiérrez Solís',
        date: '2025-09-03',
        activity: 'Desarrollo',
        costCenter: 'Tecnología',
        hours: 8,
        description: 'Desarrollo de herramientas digitales',
        isWeekend: false,
        isHoliday: false,
        approved: true
      }
    ];
  };

  const timesheets = getTimesheetsData();
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const employees = Array.from(new Set(timesheets.map(t => t.employeeName)));

  const getHoursForEmployeeAndDate = (employee: string, date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timesheets
      .filter(t => t.employeeName === employee && t.date === dateString)
      .reduce((total, t) => total + t.hours, 0);
  };

  const getActivitiesForEmployeeAndDate = (employee: string, date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timesheets.filter(t => t.employeeName === employee && t.date === dateString);
  };

  const getTotalHoursForEmployee = (employee: string) => {
    return timesheets
      .filter(t => t.employeeName === employee)
      .reduce((total, t) => total + t.hours, 0);
  };

  const getTotalHoursForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timesheets
      .filter(t => t.date === dateString)
      .reduce((total, t) => total + t.hours, 0);
  };

  const getStatusBadge = (timesheet: EmployeeTimesheet) => {
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gradient">Calendario de Colaboradores</h2>
          <p className="text-muted-foreground">Vista semanal de horas por colaborador para {selectedCompany?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Semana Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="gap-2"
          >
            Semana Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Semana del {format(weekStart, 'dd MMM', { locale: es })} al {format(weekEnd, 'dd MMM yyyy', { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold sticky left-0 bg-background">Colaborador</TableHead>
                  {weekDays.map((day) => (
                    <TableHead key={day.toString()} className="text-center font-semibold min-w-[120px]">
                      <div className="space-y-1">
                        <div>{format(day, 'EEE', { locale: es })}</div>
                        <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold">Total Semana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee} className="hover:bg-muted/25">
                    <TableCell className="font-medium sticky left-0 bg-background border-r">
                      {employee}
                    </TableCell>
                    {weekDays.map((day) => {
                      const hours = getHoursForEmployeeAndDate(employee, day);
                      const activities = getActivitiesForEmployeeAndDate(employee, day);
                      return (
                        <TableCell key={day.toString()} className="text-center p-2">
                          {hours > 0 ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-teal text-lg">{hours}h</div>
                              <div className="space-y-1">
                                {activities.map((activity, idx) => (
                                  <div key={idx} className="text-xs">
                                    <div className="font-medium">{activity.activity}</div>
                                    {activity.project && (
                                      <div className="text-muted-foreground">{activity.project}</div>
                                    )}
                                    <div className="flex justify-center mt-1">
                                      {getStatusBadge(activity)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-sm">-</div>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold text-teal">
                      {getTotalHoursForEmployee(employee)}h
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/25 font-semibold">
                  <TableCell className="sticky left-0 bg-muted/25 border-r">Total por Día</TableCell>
                  {weekDays.map((day) => (
                    <TableCell key={day.toString()} className="text-center font-bold text-navy">
                      {getTotalHoursForDate(day)}h
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-navy">
                    {timesheets.reduce((total, t) => total + t.hours, 0)}h
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Users className="h-5 w-5" />
              Colaboradores Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {employees.length}
            </div>
            <p className="text-sm text-muted-foreground">Esta semana</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horas Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {timesheets.reduce((total, t) => total + t.hours, 0)}h
            </div>
            <p className="text-sm text-muted-foreground">Esta semana</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horas Aprobadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {timesheets.filter(t => t.approved).reduce((total, t) => total + t.hours, 0)}h
            </div>
            <p className="text-sm text-muted-foreground">Esta semana</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {timesheets.filter(t => !t.approved).reduce((total, t) => total + t.hours, 0)}h
            </div>
            <p className="text-sm text-muted-foreground">Esta semana</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}