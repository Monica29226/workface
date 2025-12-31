import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  User, 
  Calendar as CalendarIcon, 
  Mail, 
  Briefcase, 
  Clock, 
  DollarSign, 
  FileText, 
  Download,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInBusinessDays, addDays, isWeekend } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EmployeeData {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  hire_date: string | null;
  contract_type: string;
  currency: string;
  status: string;
  base_salary: number | null;
  vac_balance_days: number | null;
  company_id: string;
}

interface VacationData {
  id: string;
  year: number;
  days_accrued: number;
  days_taken: number;
  days_pending: number | null;
  expiry_date: string | null;
}

interface VacationRequest {
  id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
}

interface Payslip {
  id: string;
  period_label: string;
  created_at: string;
  pdf_file_path: string | null;
}

export function EmployeeProfile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [vacations, setVacations] = useState<VacationData[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  
  // Vacation request form
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Get employee record for current user
      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empError) throw empError;
      
      if (!employeeData) {
        setIsLoading(false);
        return;
      }

      setEmployee(employeeData);

      // Fetch vacation balances
      const { data: vacData } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("year", { ascending: false });

      if (vacData) setVacations(vacData);

      // Fetch vacation requests
      const { data: requestsData } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false });

      if (requestsData) setVacationRequests(requestsData);

      // Fetch payslips
      const { data: payslipsData } = await supabase
        .from("payslips")
        .select("*")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false });

      if (payslipsData) setPayslips(payslipsData);

    } catch (error) {
      console.error("Error fetching employee data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del empleado",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBusinessDays = (start: Date, end: Date): number => {
    let count = 0;
    let current = new Date(start);
    while (current <= end) {
      if (!isWeekend(current)) {
        count++;
      }
      current = addDays(current, 1);
    }
    return count;
  };

  const handleVacationRequest = async () => {
    if (!startDate || !endDate || !employee) {
      toast({
        title: "Error",
        description: "Por favor seleccione las fechas de inicio y fin",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Error",
        description: "La fecha de fin debe ser posterior a la fecha de inicio",
        variant: "destructive",
      });
      return;
    }

    const daysRequested = calculateBusinessDays(startDate, endDate);
    const availableDays = vacations.reduce((sum, v) => sum + (v.days_pending || (v.days_accrued - v.days_taken)), 0);

    if (daysRequested > availableDays) {
      toast({
        title: "Error",
        description: `Solo tiene ${availableDays} días disponibles. Solicitó ${daysRequested} días.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("vacation_requests")
        .insert({
          employee_id: employee.id,
          company_id: employee.company_id,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          days_requested: daysRequested,
          reason: requestReason || null,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Solicitud enviada",
        description: "Su solicitud de vacaciones ha sido enviada para aprobación",
      });

      setIsRequestDialogOpen(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setRequestReason("");
      fetchEmployeeData();
    } catch (error) {
      console.error("Error submitting vacation request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de vacaciones",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pendiente" },
      approved: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Aprobada" },
      rejected: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Rechazada" },
      cancelled: { color: "bg-gray-100 text-gray-800", icon: XCircle, label: "Cancelada" },
    };
    const { color, icon: Icon, label } = config[status] || config.pending;
    return (
      <Badge className={cn("gap-1", color)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sin perfil de empleado</h2>
            <p className="text-muted-foreground">
              Tu cuenta no está asociada a un registro de empleado. Contacta a tu administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAvailableDays = vacations.reduce((sum, v) => sum + (v.days_pending || (v.days_accrued - v.days_taken)), 0);
  const totalTakenDays = vacations.reduce((sum, v) => sum + v.days_taken, 0);
  const totalAccruedDays = vacations.reduce((sum, v) => sum + v.days_accrued, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mi Perfil</h1>
          <p className="text-muted-foreground">Consulta tu información y gestiona tus solicitudes</p>
        </div>
        <Button onClick={() => setIsRequestDialogOpen(true)} className="gap-2">
          <Send className="h-4 w-4" />
          Solicitar Vacaciones
        </Button>
      </div>

      {/* Employee Info Card */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-muted-foreground text-sm">Nombre Completo</Label>
              <p className="font-medium mt-1">{employee.full_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Correo</Label>
              <p className="font-medium mt-1 flex items-center gap-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {employee.work_email}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">ID Empleado</Label>
              <p className="font-medium mt-1">{employee.employee_id}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Fecha de Ingreso</Label>
              <p className="font-medium mt-1 flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {employee.hire_date ? format(new Date(employee.hire_date), "dd MMM yyyy", { locale: es }) : "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Tipo de Contrato</Label>
              <p className="font-medium mt-1 flex items-center gap-1">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {employee.contract_type === "mensual" ? "Mensual" : "Por Horas"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Estado</Label>
              <Badge variant={employee.status === "activo" ? "default" : "secondary"} className="mt-1">
                {employee.status === "activo" ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vacation Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Días Disponibles</p>
                <p className="text-3xl font-bold text-primary">{totalAvailableDays}</p>
              </div>
              <CalendarIcon className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Días Disfrutados</p>
                <p className="text-3xl font-bold text-green-600">{totalTakenDays}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Acumulado</p>
                <p className="text-3xl font-bold text-blue-600">{totalAccruedDays}</p>
              </div>
              <Clock className="h-10 w-10 text-blue-600/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for History and Payslips */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Solicitudes de Vacaciones</TabsTrigger>
          <TabsTrigger value="payslips">Colillas de Pago</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Solicitudes</CardTitle>
              <CardDescription>Tus solicitudes de vacaciones y su estado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fecha Solicitud</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead className="text-center">Días</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacationRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay solicitudes de vacaciones
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacationRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {format(new Date(request.created_at), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.start_date), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.end_date), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {request.days_requested}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.review_notes || request.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card>
            <CardHeader>
              <CardTitle>Colillas de Pago</CardTitle>
              <CardDescription>Historial de tus comprobantes de pago</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Período</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay colillas de pago disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    payslips.map((payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell className="font-medium">{payslip.period_label}</TableCell>
                        <TableCell>
                          {format(new Date(payslip.created_at), "dd/MM/yyyy", { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!payslip.pdf_file_path}
                            className="gap-1"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vacation Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Vacaciones</DialogTitle>
            <DialogDescription>
              Selecciona las fechas y envía tu solicitud para aprobación
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Días disponibles</p>
              <p className="text-2xl font-bold text-primary">{totalAvailableDays} días</p>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < (startDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {startDate && endDate && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Días hábiles solicitados:</strong> {calculateBusinessDays(startDate, endDate)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Ej: Vacaciones familiares, viaje, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleVacationRequest} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
