import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Loader2, Clock, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TimeEntryDialog } from "@/components/timesheets/TimeEntryDialog";

interface TimeEntry {
  id: string;
  time_entry_id: string;
  employee_id: string;
  project_id: string;
  entry_date: string;
  hours: number;
  notes: string | null;
  approved: boolean;
  employee?: {
    full_name: string;
    employee_id: string;
  };
  project?: {
    name: string;
    project_id: string;
  };
}

export function Timesheets() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const { selectedCompany } = useCompany();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>();

  useEffect(() => {
    if (selectedCompany?.id) {
      fetchTimeEntries();
      fetchCurrentEmployee();
    }
  }, [selectedCompany?.id]);

  const fetchCurrentEmployee = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) setCurrentEmployeeId(data.id);
    } catch (error: any) {
      console.error('Error fetching employee:', error);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          employee:employees(full_name, employee_id),
          project:projects(name, project_id)
        `)
        .order('entry_date', { ascending: false });

      // Filter by selected company
      if (selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      // If employee, only show their entries
      if (role === 'employee' && currentEmployeeId) {
        query = query.eq('employee_id', currentEmployeeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTimeEntries(data || []);
    } catch (error: any) {
      console.error('Error fetching time entries:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros de horas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ approved })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: `Registro ${approved ? 'aprobado' : 'rechazado'} correctamente`,
      });

      fetchTimeEntries();
    } catch (error: any) {
      console.error('Error updating approval:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el registro",
        variant: "destructive",
      });
    }
  };

  const filteredEntries = timeEntries.filter(entry =>
    `${entry.employee?.full_name} ${entry.project?.name} ${entry.notes || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const approvedHours = filteredEntries.filter(e => e.approved).reduce((sum, entry) => sum + entry.hours, 0);
  const pendingEntries = filteredEntries.filter(e => !e.approved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Registro de Horas</h1>
          <p className="text-muted-foreground">Gestión de horas trabajadas por proyecto</p>
        </div>

        <Button 
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Registro
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalHours.toFixed(2)}h</div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Horas Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{approvedHours.toFixed(2)}h</div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{pendingEntries}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por empleado, proyecto o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-primary">Registros de Horas</CardTitle>
          <CardDescription>
            {filteredEntries.length} registro{filteredEntries.length !== 1 ? 's' : ''} encontrado{filteredEntries.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {(role === 'admin' || role === 'company_manager') && (
                    <TableHead className="text-center">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      No hay registros de horas. Agregue el primer registro usando el botón "Nuevo Registro".
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.employee?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{entry.employee?.employee_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.project?.name}</div>
                          <div className="text-xs text-muted-foreground">{entry.project?.project_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(entry.entry_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {entry.hours}h
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm">{entry.notes || '-'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={entry.approved ? 'default' : 'secondary'}>
                          {entry.approved ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      {(role === 'admin' || role === 'company_manager') && (
                        <TableCell className="text-center">
                          {!entry.approved && (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-600"
                                onClick={() => handleApprove(entry.id, true)}
                                title="Aprobar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-600"
                                onClick={() => handleApprove(entry.id, false)}
                                title="Rechazar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Time Entry Dialog */}
      {selectedCompany?.id && (
        <TimeEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={fetchTimeEntries}
          employeeId={role === 'employee' ? currentEmployeeId : undefined}
          companyId={selectedCompany.id}
        />
      )}
    </div>
  );
}
