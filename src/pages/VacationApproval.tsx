import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  CalendarDays,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

interface VacationRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  request_type?: string;
  is_half_day?: boolean;
  reason: string | null;
  status: string;
  approval_stage?: string;
  created_at: string;
  days_available: number;
  manager_name: string | null;
  manager_user_id: string | null;
  no_manager_assigned: boolean;
  manager_notes: string | null;
  hr_notes: string | null;
}

type ApprovalTab = "manager" | "hr" | "resolved";

const HR_ROLES = new Set([
  "admin",
  "company_manager",
  "ACL_SuperAdmin",
  "ACL_PayrollSpecialist",
  "Client_Admin",
  "Client_HR",
]);

export function VacationApproval() {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const { role, user } = useUserRole();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);
  const [activeTab, setActiveTab] = useState<ApprovalTab>("manager");

  const requestTypeLabels: Record<string, string> = {
    vacaciones: "Vacaciones",
    dia_libre: "Dia libre",
    medio_dia: "Medio dia",
    permiso_sin_goce: "Permiso sin goce",
  };

  const stageLabels: Record<string, string> = {
    pending_manager: "Pendiente jefe",
    pending_hr: "Pendiente RRHH",
    approved: "Aprobada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
  };

  const isHrActor = role ? HR_ROLES.has(role) : false;

  useEffect(() => {
    if (selectedCompany?.id && user) {
      void fetchRequests();
    }
  }, [selectedCompany?.id, user?.id, role]);

  const fetchRequests = async () => {
    if (!selectedCompany?.id || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select(`
          *,
          employee:employees!inner(
            id,
            full_name,
            work_email,
            vac_balance_days,
            manager_id,
            user_id
          )
        `)
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const managerIds = Array.from(
        new Set(
          (data || [])
            .map((req: any) => req.employee?.manager_id)
            .filter(Boolean)
        )
      );

      let managersById = new Map<string, { full_name: string; user_id: string | null }>();
      if (managerIds.length > 0) {
        const { data: managersData, error: managersError } = await supabase
          .from("employees")
          .select("id, full_name, user_id")
          .in("id", managerIds);

        if (managersError) throw managersError;

        managersById = new Map(
          (managersData || []).map((manager: any) => [
            manager.id,
            { full_name: manager.full_name, user_id: manager.user_id },
          ])
        );
      }

      const transformedRequests: VacationRequest[] = (data || []).map((req: any) => {
        const managerInfo = req.employee?.manager_id ? managersById.get(req.employee.manager_id) : null;
        return {
          id: req.id,
          employee_id: req.employee_id,
          employee_name: req.employee.full_name,
          employee_email: req.employee.work_email,
          start_date: req.start_date,
          end_date: req.end_date,
          days_requested: Number(req.days_requested),
          request_type: req.request_type || "vacaciones",
          is_half_day: req.is_half_day || false,
          reason: req.reason,
          status: req.status,
          approval_stage: req.approval_stage || (req.status === "pending" ? "pending_hr" : req.status),
          created_at: req.created_at,
          days_available: Number(req.employee.vac_balance_days || 0),
          manager_name: managerInfo?.full_name || null,
          manager_user_id: managerInfo?.user_id || null,
          no_manager_assigned: !managerInfo?.user_id,
          manager_notes: req.manager_notes || null,
          hr_notes: req.hr_notes || null,
        };
      });

      setRequests(transformedRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las solicitudes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const managerPendingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.approval_stage === "pending_manager" &&
          request.manager_user_id === user?.id
      ),
    [requests, user?.id]
  );

  const hrPendingRequests = useMemo(
    () =>
      isHrActor
        ? requests.filter((request) => request.approval_stage === "pending_hr")
        : [],
    [requests, isHrActor]
  );

  const resolvedRequests = useMemo(
    () =>
      requests.filter((request) => {
        const isResolved = ["approved", "rejected", "cancelled"].includes(request.approval_stage || "");
        if (!isResolved) return false;
        return isHrActor || request.manager_user_id === user?.id;
      }),
    [requests, isHrActor, user?.id]
  );

  useEffect(() => {
    if (managerPendingRequests.length > 0) {
      setActiveTab("manager");
    } else if (isHrActor) {
      setActiveTab("hr");
    } else {
      setActiveTab("resolved");
    }
  }, [managerPendingRequests.length, isHrActor]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const { data, error } = await (supabase.rpc as any)("process_vacation_request_approval", {
        p_request_id: selectedRequest.id,
        p_action: action,
        p_notes: reviewNotes || null,
      });

      if (error) throw error;

      const result = data as { approval_stage?: string; status?: string } | null;
      const finalStage = result?.approval_stage || selectedRequest.approval_stage;

      if (finalStage === "approved" || finalStage === "rejected") {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: [selectedRequest.employee_email],
              subject:
                finalStage === "approved"
                  ? `✅ ${requestTypeLabels[selectedRequest.request_type || "vacaciones"]} aprobado`
                  : `❌ Solicitud rechazada`,
              html:
                finalStage === "approved"
                  ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                      <h2 style="color:#059669">Solicitud Aprobada</h2>
                      <p>Hola <strong>${selectedRequest.employee_name}</strong>,</p>
                      <p>Tu solicitud de <strong>${requestTypeLabels[selectedRequest.request_type || "vacaciones"]}</strong> ha sido aprobada.</p>
                      <p>Notas: ${reviewNotes || "Sin observaciones"}</p>
                      <p style="color:#6b7280;font-size:12px">ACL Workforce HUB</p>
                    </div>`
                  : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                      <h2 style="color:#dc2626">Solicitud Rechazada</h2>
                      <p>Hola <strong>${selectedRequest.employee_name}</strong>,</p>
                      <p>Tu solicitud de <strong>${requestTypeLabels[selectedRequest.request_type || "vacaciones"]}</strong> ha sido rechazada.</p>
                      <p>Motivo: ${reviewNotes || "Sin observaciones"}</p>
                      <p style="color:#6b7280;font-size:12px">ACL Workforce HUB</p>
                    </div>`,
              companyId: selectedCompany?.id,
            },
          });
        } catch (emailError) {
          console.error("Error sending final decision email:", emailError);
        }
      }

      toast({
        title:
          finalStage === "pending_hr"
            ? "Solicitud enviada a RRHH"
            : action === "approve"
              ? "Solicitud aprobada"
              : "Solicitud rechazada",
        description:
          finalStage === "pending_hr"
            ? `${selectedRequest.employee_name} ya pasó la revisión del jefe inmediato.`
            : finalStage === "approved"
              ? `Se aprobó ${requestTypeLabels[selectedRequest.request_type || "vacaciones"].toLowerCase()} para ${selectedRequest.employee_name}`
              : `La solicitud de ${selectedRequest.employee_name} ha sido rechazada`,
      });

      setSelectedRequest(null);
      setReviewNotes("");
      setDialogAction(null);
      await fetchRequests();
    } catch (error: any) {
      console.error("Error processing request:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openActionDialog = (request: VacationRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setDialogAction(action);
    setReviewNotes("");
  };

  const getRequestTypeBadge = (type?: string) => (
    <Badge variant="outline">
      {requestTypeLabels[type || "vacaciones"] || "Vacaciones"}
    </Badge>
  );

  const getStageBadge = (stage?: string) => {
    const config: Record<string, string> = {
      pending_manager: "bg-yellow-100 text-yellow-800",
      pending_hr: "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-muted text-muted-foreground",
    };

    return (
      <Badge className={config[stage || "pending_hr"] || config.pending_hr}>
        {stageLabels[stage || "pending_hr"] || "Pendiente RRHH"}
      </Badge>
    );
  };

  const renderRequestsTable = (rows: VacationRequest[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Colaborador</TableHead>
          <TableHead>Jefe</TableHead>
          <TableHead>Etapa</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Período</TableHead>
          <TableHead className="text-center">Días</TableHead>
          <TableHead className="text-center">Disponibles</TableHead>
          <TableHead>Notas</TableHead>
          {showActions && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((request) => (
          <TableRow key={request.id} className="hover:bg-muted/30">
            <TableCell>
              <div>
                <p className="font-medium">{request.employee_name}</p>
                <p className="text-sm text-muted-foreground">{request.employee_email}</p>
              </div>
            </TableCell>
            <TableCell>
              {request.manager_name ? (
                <div>
                  <p className="font-medium">{request.manager_name}</p>
                  {request.no_manager_assigned && (
                    <p className="text-xs text-amber-600">Sin usuario de jefe</p>
                  )}
                </div>
              ) : (
                <span className="text-amber-600 text-sm">Sin jefe asignado</span>
              )}
            </TableCell>
            <TableCell>{getStageBadge(request.approval_stage)}</TableCell>
            <TableCell>{getRequestTypeBadge(request.request_type)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(new Date(request.start_date), "dd/MM")} - {format(new Date(request.end_date), "dd/MM/yyyy")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Solicitada el {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
              </p>
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="font-bold">
                {request.days_requested}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {request.request_type === "permiso_sin_goce" ? (
                <span className="text-muted-foreground">No aplica</span>
              ) : (
                <>
                  <span className={request.days_available >= request.days_requested ? "text-emerald-600" : "text-destructive"}>
                    {request.days_available.toFixed(1)}
                  </span>
                  {request.days_available < request.days_requested && (
                    <AlertTriangle className="h-4 w-4 text-destructive inline ml-1" />
                  )}
                </>
              )}
            </TableCell>
            <TableCell className="max-w-[260px]">
              <div className="space-y-1 text-sm">
                {request.reason && <p><span className="font-medium">Motivo:</span> {request.reason}</p>}
                {request.manager_notes && <p><span className="font-medium">Jefe:</span> {request.manager_notes}</p>}
                {request.hr_notes && <p><span className="font-medium">RRHH:</span> {request.hr_notes}</p>}
                {!request.reason && !request.manager_notes && !request.hr_notes && <span className="text-muted-foreground">—</span>}
              </div>
            </TableCell>
            {showActions && (
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => openActionDialog(request, "reject")}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => openActionDialog(request, "approve")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aprobar
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!selectedCompany) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Seleccione una empresa para ver las solicitudes de tiempo libre
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Aprobación de Tiempo Libre
          </h1>
          <p className="text-muted-foreground">
            Flujo por etapas entre jefe inmediato y RRHH para vacaciones, días libres y permisos
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm">
            {managerPendingRequests.length} pendiente(s) de jefe
          </Badge>
          <Badge variant="outline" className="text-sm">
            {hrPendingRequests.length} pendiente(s) de RRHH
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserCheck className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes jefe</p>
                <p className="text-2xl font-bold">{managerPendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes RRHH</p>
                <p className="text-2xl font-bold">{hrPendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Resueltas</p>
                <p className="text-2xl font-bold">{resolvedRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manager">Pendientes de jefe</TabsTrigger>
          <TabsTrigger value="hr" disabled={!isHrActor}>Pendientes RRHH</TabsTrigger>
          <TabsTrigger value="resolved">Resueltas</TabsTrigger>
        </TabsList>

        <TabsContent value="manager">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Solicitudes para jefe inmediato</CardTitle>
              <CardDescription>
                Revise únicamente las solicitudes de sus reportes directos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : managerPendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 text-emerald-500" />
                  <p className="text-lg font-medium">Sin pendientes de jefe</p>
                  <p>No hay solicitudes esperando revisión del jefe inmediato</p>
                </div>
              ) : (
                renderRequestsTable(managerPendingRequests, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hr">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Solicitudes pendientes de RRHH</CardTitle>
              <CardDescription>
                Solicitudes ya revisadas por el jefe o derivadas sin jefe asignado.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : hrPendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 text-emerald-500" />
                  <p className="text-lg font-medium">Sin pendientes de RRHH</p>
                  <p>No hay solicitudes listas para validación final</p>
                </div>
              ) : (
                renderRequestsTable(hrPendingRequests, true)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Solicitudes resueltas</CardTitle>
              <CardDescription>
                Historial reciente de aprobaciones, rechazos y cancelaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : resolvedRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-4 opacity-30" />
                  <p>No hay solicitudes resueltas todavía</p>
                </div>
              ) : (
                renderRequestsTable(resolvedRequests, false)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogAction !== null} onOpenChange={() => setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "¿Aprobar solicitud?" : "¿Rechazar solicitud?"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  <strong>{selectedRequest.employee_name}</strong> solicita{" "}
                  <strong>{requestTypeLabels[selectedRequest.request_type || "vacaciones"]}</strong>
                  {" "}por <strong>{selectedRequest.days_requested}</strong> del{" "}
                  {format(new Date(selectedRequest.start_date), "dd/MM/yyyy")} al{" "}
                  {format(new Date(selectedRequest.end_date), "dd/MM/yyyy")}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                {selectedRequest?.approval_stage === "pending_manager" ? "Comentario del jefe" : "Notas de RRHH"}
              </label>
              <Textarea
                placeholder={
                  dialogAction === "approve"
                    ? "Ej: Aprobado. Favor coordinar pendientes."
                    : "Ej: No es posible aprobar en estas fechas."
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              onClick={() => dialogAction && handleAction(dialogAction)}
              disabled={isProcessing}
              className={dialogAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : dialogAction === "approve" ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {dialogAction === "approve" ? "Confirmar Aprobación" : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VacationApproval;
