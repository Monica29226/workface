import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CalendarIcon, 
  Clock, 
  Palmtree, 
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  CalendarDays,
  History,
  Info,
  Ban
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWeekend, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EmployeeData {
  id: string;
  employee_id: string;
  full_name: string;
  hire_date: string | null;
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
  approval_stage?: string;
  request_type?: string;
  is_half_day?: boolean;
  manager_notes?: string | null;
  hr_notes?: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
}

type TimeOffRequestType = "vacaciones" | "dia_libre" | "medio_dia" | "permiso_sin_goce";

export function EmployeeVacations() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [vacations, setVacations] = useState<VacationData[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  
  // Vacation request form
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [requestType, setRequestType] = useState<TimeOffRequestType>("vacaciones");
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

      const { data: employeeData, error: empError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, hire_date, company_id")
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

    } catch (error) {
      console.error("Error fetching employee data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
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

  const totalAvailableDays = useMemo(() => 
    vacations.reduce((sum, v) => sum + (v.days_pending ?? (v.days_accrued - v.days_taken)), 0),
    [vacations]
  );

  const totalTakenDays = useMemo(() => 
    vacations.reduce((sum, v) => sum + v.days_taken, 0),
    [vacations]
  );

  const totalAccruedDays = useMemo(() => 
    vacations.reduce((sum, v) => sum + v.days_accrued, 0),
    [vacations]
  );

  const pendingRequests = useMemo(() => 
    vacationRequests.filter(r => r.status === 'pending' && ["pending_manager", "pending_hr"].includes(r.approval_stage || "pending_hr")),
    [vacationRequests]
  );

  const daysRequested = useMemo(() => {
    if (!selectedRange.from || !selectedRange.to) return 0;
    if (requestType === "medio_dia") return 0.5;
    return calculateBusinessDays(selectedRange.from, selectedRange.to);
  }, [selectedRange, requestType]);

  const requestTypeLabels: Record<TimeOffRequestType, string> = {
    vacaciones: "Vacaciones",
    dia_libre: "Dia libre",
    medio_dia: "Medio dia",
    permiso_sin_goce: "Permiso sin goce",
  };

  const handleVacationRequest = async () => {
    if (!selectedRange.from || !selectedRange.to || !employee) {
      toast({
        title: "Error",
        description: "Por favor seleccione las fechas de inicio y fin",
        variant: "destructive",
      });
      return;
    }

    if (selectedRange.to < selectedRange.from) {
      toast({
        title: "Error",
        description: "La fecha de fin debe ser posterior a la fecha de inicio",
        variant: "destructive",
      });
      return;
    }

    const consumesBalance = requestType !== "permiso_sin_goce";

    if (consumesBalance && daysRequested > totalAvailableDays) {
      toast({
        title: "Error",
        description: `Solo tiene ${totalAvailableDays} días disponibles. Solicitó ${daysRequested} días.`,
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
          start_date: format(selectedRange.from, "yyyy-MM-dd"),
          end_date: format(selectedRange.to, "yyyy-MM-dd"),
          days_requested: daysRequested,
          request_type: requestType,
          is_half_day: requestType === "medio_dia",
          reason: requestReason || null,
          status: "pending",
        } as any);

      if (error) throw error;

      toast({
        title: "Solicitud enviada",
        description: `Tu solicitud de ${requestTypeLabels[requestType].toLowerCase()} fue enviada para aprobacion.`,
      });

      setIsRequestDialogOpen(false);
      setSelectedRange({ from: undefined, to: undefined });
      setRequestType("vacaciones");
      setRequestReason("");
      fetchEmployeeData();
    } catch (error) {
      console.error("Error submitting vacation request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de tiempo libre",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, approvalStage?: string) => {
    const stage = approvalStage || (status === "pending" ? "pending_hr" : status);
    const config: Record<string, { color: string; icon: any; label: string }> = {
      pending_manager: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock, label: "Pendiente jefe" },
      pending_hr: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock, label: "Pendiente RRHH" },
      approved: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle, label: "Aprobada" },
      rejected: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle, label: "Rechazada" },
      cancelled: { color: "bg-muted text-muted-foreground", icon: XCircle, label: "Cancelada" },
    };
    const { color, icon: Icon, label } = config[stage] || config.pending_hr;
    return (
      <Badge className={cn("gap-1", color)}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getRequestTypeBadge = (type?: string) => {
    const label = requestTypeLabels[(type as TimeOffRequestType) || "vacaciones"] || "Vacaciones";
    return <Badge variant="outline">{label}</Badge>;
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const { error } = await (supabase.rpc as any)("cancel_vacation_request", {
        p_request_id: requestId,
      });

      if (error) throw error;

      toast({
        title: "Solicitud cancelada",
        description: "La solicitud pendiente fue cancelada correctamente.",
      });

      fetchEmployeeData();
    } catch (error) {
      console.error("Error cancelling vacation request:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la solicitud.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información de tiempo libre...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Palmtree className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mi Tiempo Libre</h1>
            <p className="text-muted-foreground">Solicita vacaciones, dias libres y consulta tu saldo disponible</p>
          </div>
        </div>
        <Button onClick={() => setIsRequestDialogOpen(true)} className="gap-2" size="lg">
          <Send className="h-4 w-4" />
          Solicitar Tiempo Libre
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Días Disponibles</p>
                <p className="text-4xl font-bold text-primary">{totalAvailableDays}</p>
              </div>
              <CalendarDays className="h-12 w-12 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Días Disfrutados</p>
                <p className="text-3xl font-bold">{totalTakenDays}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Acumulado</p>
                <p className="text-3xl font-bold">{totalAccruedDays}</p>
              </div>
              <History className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card className={pendingRequests.length > 0 ? "border-l-4 border-l-amber-500" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Solicitudes Pendientes</p>
                <p className="text-3xl font-bold">{pendingRequests.length}</p>
              </div>
              <Clock className="h-10 w-10 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vacation Balance by Year */}
      {vacations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Desglose por Año
            </CardTitle>
            <CardDescription>Detalle de días acumulados y utilizados por período</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead className="text-right">Acumulados</TableHead>
                  <TableHead className="text-right">Disfrutados</TableHead>
                  <TableHead className="text-right">Pendientes</TableHead>
                  <TableHead>Vencimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacations.map((vac) => {
                  const pending = vac.days_pending ?? (vac.days_accrued - vac.days_taken);
                  const isExpiringSoon = vac.expiry_date && 
                    differenceInDays(new Date(vac.expiry_date), new Date()) <= 60;
                  
                  return (
                    <TableRow key={vac.id}>
                      <TableCell className="font-medium">{vac.year}</TableCell>
                      <TableCell className="text-right">{vac.days_accrued}</TableCell>
                      <TableCell className="text-right">{vac.days_taken}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-semibold",
                          pending > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                          {pending}
                        </span>
                      </TableCell>
                      <TableCell>
                        {vac.expiry_date ? (
                          <div className="flex items-center gap-2">
                            <span className={isExpiringSoon ? "text-destructive font-medium" : ""}>
                              {format(new Date(vac.expiry_date), "dd MMM yyyy", { locale: es })}
                            </span>
                            {isExpiringSoon && (
                              <Badge variant="destructive" className="text-xs">
                                Próximo a vencer
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Solicitudes
          </CardTitle>
          <CardDescription>Todas tus solicitudes de vacaciones y tiempo libre</CardDescription>
        </CardHeader>
        <CardContent>
          {vacationRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Palmtree className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No tienes solicitudes de tiempo libre registradas</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsRequestDialogOpen(true)}
              >
                Crear primera solicitud
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Días</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Notas de Revisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacationRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(request.start_date), "dd MMM", { locale: es })} - {format(new Date(request.end_date), "dd MMM yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{request.days_requested}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.reason || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status, request.approval_stage)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="space-y-1 text-sm">
                        {request.manager_notes && (
                          <p><span className="font-medium">Jefe:</span> {request.manager_notes}</p>
                        )}
                        {request.hr_notes && (
                          <p><span className="font-medium">RRHH:</span> {request.hr_notes}</p>
                        )}
                        {!request.manager_notes && !request.hr_notes && !request.review_notes && (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {request.review_notes && !request.hr_notes && !request.manager_notes && (
                          <span>{request.review_notes}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && ["pending_manager", "pending_hr"].includes(request.approval_stage || "pending_hr") ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelRequest(request.id)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Time Off Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5" />
              Solicitar Tiempo Libre
            </DialogTitle>
            <DialogDescription>
              Selecciona el tipo de solicitud, el rango de fechas y un motivo opcional
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Available days info */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Info className="h-5 w-5 text-primary" />
              <span className="text-sm">
                Tienes <span className="font-bold text-primary">{totalAvailableDays} días</span> disponibles para solicitar. Las solicitudes pasan por jefe inmediato y luego por RRHH cuando corresponde.
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-type">Tipo de solicitud</Label>
              <Select
                value={requestType}
                onValueChange={(value) => setRequestType(value as TimeOffRequestType)}
              >
                <SelectTrigger id="request-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacaciones">Vacaciones</SelectItem>
                  <SelectItem value="dia_libre">Dia libre</SelectItem>
                  <SelectItem value="medio_dia">Medio dia</SelectItem>
                  <SelectItem value="permiso_sin_goce">Permiso sin goce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={selectedRange}
                onSelect={(range) =>
                  setSelectedRange({
                    from: range?.from,
                    to: requestType === "medio_dia" ? range?.from : range?.to,
                  })
                }
                numberOfMonths={2}
                locale={es}
                disabled={(date) => date < new Date() || isWeekend(date)}
                className="rounded-md border"
              />
            </div>

            {/* Selected range summary */}
            {selectedRange.from && selectedRange.to && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Período seleccionado:</span>
                  <span className="font-medium">
                    {format(selectedRange.from, "dd MMM", { locale: es })} - {format(selectedRange.to, "dd MMM yyyy", { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Unidad a solicitar:</span>
                  <Badge 
                    variant={requestType !== "permiso_sin_goce" && daysRequested > totalAvailableDays ? "destructive" : "default"}
                    className="text-lg px-3"
                  >
                    {daysRequested}
                  </Badge>
                </div>
                {requestType !== "permiso_sin_goce" && daysRequested > totalAvailableDays && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Excede los días disponibles
                  </p>
                )}
                {requestType === "permiso_sin_goce" && (
                  <p className="text-sm text-muted-foreground">
                    Este tipo de solicitud no descuenta saldo de vacaciones.
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ej: tramite personal, viaje, consulta medica, descanso..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleVacationRequest}
              disabled={!selectedRange.from || !selectedRange.to || (requestType !== "permiso_sin_goce" && daysRequested > totalAvailableDays) || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
