import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  employeeId?: string;
  companyId: string;
}

interface Project {
  id: string;
  project_id: string;
  name: string;
  status: string;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

export function TimeEntryDialog({ open, onOpenChange, onSuccess, employeeId, companyId }: TimeEntryDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date>();

  const [formData, setFormData] = useState({
    employee_id: employeeId || '',
    project_id: '',
    hours: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch active projects for the company
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, project_id, name, status')
        .eq('company_id', companyId)
        .eq('status', 'activo')
        .order('name');

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch active employees for the company (if admin/manager)
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name')
        .eq('company_id', companyId)
        .eq('status', 'activo')
        .order('full_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({
        title: "Error",
        description: "Seleccione una fecha",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const timeEntryId = `TE-${Date.now()}`;
      
      const { error } = await supabase.from('time_entries').insert([{
        time_entry_id: timeEntryId,
        employee_id: formData.employee_id,
        company_id: companyId,
        project_id: formData.project_id,
        entry_date: format(date, 'yyyy-MM-dd'),
        hours: parseFloat(formData.hours),
        notes: formData.notes || null,
        approved: false,
      }]);

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "Registro de horas creado correctamente",
      });

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating time entry:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el registro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: employeeId || '',
      project_id: '',
      hours: '',
      notes: '',
    });
    setDate(undefined);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar Horas de Trabajo</DialogTitle>
          <DialogDescription>
            Complete la información del registro de horas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!employeeId && (
            <div className="space-y-2">
              <Label htmlFor="employee_id">Empleado *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="project_id">Proyecto *</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} ({project.project_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Seleccione fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Horas *</Label>
            <Input
              id="hours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              placeholder="8.0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / Descripción</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Descripción del trabajo realizado..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Registro'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
