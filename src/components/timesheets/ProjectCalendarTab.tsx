import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { 
  Plus,
  Calendar as CalendarIcon,
  FolderOpen,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProjectActivity {
  id: string;
  date: string;
  project: string;
  activity: string;
  description: string;
  responsible: string;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
}

export function ProjectCalendarTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activities, setActivities] = useState<ProjectActivity[]>([
    {
      id: '1',
      date: '2025-09-14',
      project: 'Proyecto Turístico',
      activity: 'Supervisión de Campo',
      description: 'Inspección de instalaciones turísticas',
      responsible: 'María González',
      status: 'in-progress',
      priority: 'high'
    },
    {
      id: '2',
      date: '2025-09-15',
      project: 'Programa Social',
      activity: 'Capacitación',
      description: 'Capacitación a beneficiarios del programa',
      responsible: 'Gabriel Cordero',
      status: 'planned',
      priority: 'medium'
    },
    {
      id: '3',
      date: '2025-09-14',
      project: 'Administración',
      activity: 'Reunión Gerencial',
      description: 'Revisión de indicadores mensuales',
      responsible: 'Andrés Hidalgo',
      status: 'completed',
      priority: 'high'
    }
  ]);

  const [newActivity, setNewActivity] = useState<Partial<ProjectActivity>>({
    date: format(selectedDate, 'yyyy-MM-dd'),
    project: '',
    activity: '',
    description: '',
    responsible: '',
    status: 'planned',
    priority: 'medium'
  });

  const projects = [
    'Proyecto Turístico',
    'Programa Social', 
    'Administración',
    'Operaciones',
    'Desarrollo'
  ];

  const employees = [
    'María González Rojas',
    'Gabriel Cordero González',
    'Andrés Hidalgo Vega',
    'Krissya Paulina Gutiérrez Solís'
  ];

  const handleSaveActivity = () => {
    if (newActivity.project && newActivity.activity && newActivity.responsible) {
      const activity: ProjectActivity = {
        id: Date.now().toString(),
        date: newActivity.date || format(selectedDate, 'yyyy-MM-dd'),
        project: newActivity.project,
        activity: newActivity.activity,
        description: newActivity.description || '',
        responsible: newActivity.responsible,
        status: newActivity.status as ProjectActivity['status'] || 'planned',
        priority: newActivity.priority as ProjectActivity['priority'] || 'medium'
      };
      setActivities([...activities, activity]);
      setNewActivity({
        date: format(selectedDate, 'yyyy-MM-dd'),
        project: '',
        activity: '',
        description: '',
        responsible: '',
        status: 'planned',
        priority: 'medium'
      });
      setIsDialogOpen(false);
    }
  };

  const getActivitiesForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return activities.filter(activity => activity.date === dateString);
  };

  const getSelectedDateActivities = () => {
    return getActivitiesForDate(selectedDate);
  };

  const getStatusBadge = (status: ProjectActivity['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completado</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">En Progreso</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">Planificado</Badge>;
    }
  };

  const getPriorityBadge = (priority: ProjectActivity['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Media</Badge>;
      default:
        return <Badge variant="outline">Baja</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gradient">Calendario de Proyectos</h2>
          <p className="text-muted-foreground">Gestión diaria de actividades por proyecto</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-navy text-white">
              <Plus className="h-4 w-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Agregar Actividad de Proyecto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="project">Proyecto</Label>
                <Select
                  value={newActivity.project}
                  onValueChange={(value) => setNewActivity({...newActivity, project: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project} value={project}>
                        {project}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="activity">Actividad</Label>
                <Input
                  id="activity"
                  placeholder="Nombre de la actividad"
                  value={newActivity.activity}
                  onChange={(e) => setNewActivity({...newActivity, activity: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="responsible">Responsable</Label>
                <Select
                  value={newActivity.responsible}
                  onValueChange={(value) => setNewActivity({...newActivity, responsible: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee} value={employee}>
                        {employee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={newActivity.status}
                    onValueChange={(value) => setNewActivity({...newActivity, status: value as ProjectActivity['status']})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planificado</SelectItem>
                      <SelectItem value="in-progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select
                    value={newActivity.priority}
                    onValueChange={(value) => setNewActivity({...newActivity, priority: value as ProjectActivity['priority']})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción detallada de la actividad"
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveActivity} className="gradient-navy text-white">
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={es}
              className="rounded-md border"
              components={{
                DayContent: ({ date }) => {
                  const dayActivities = getActivitiesForDate(date);
                  return (
                    <div className="relative w-full h-full">
                      <span>{date.getDate()}</span>
                      {dayActivities.length > 0 && (
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-teal rounded-full"></div>
                      )}
                    </div>
                  );
                }
              }}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actividades del Día
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getSelectedDateActivities().length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay actividades programadas</p>
              ) : (
                getSelectedDateActivities().map((activity) => (
                  <div key={activity.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <h4 className="font-medium text-sm">{activity.activity}</h4>
                        <p className="text-xs text-muted-foreground">{activity.project}</p>
                        <p className="text-xs">{activity.responsible}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(activity.status)}
                        {getPriorityBadge(activity.priority)}
                      </div>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Proyectos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {new Set(activities.map(a => a.project)).size}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal">
              {activities.length}
            </div>
            <p className="text-sm text-muted-foreground">Total programadas</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Users className="h-5 w-5" />
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activities.filter(a => a.status === 'completed').length}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              En Progreso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activities.filter(a => a.status === 'in-progress').length}
            </div>
            <p className="text-sm text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}