import { useState, useEffect } from "react";
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
  User,
  FileText,
  Loader2,
  CalendarDays,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format, differenceInBusinessDays } from "date-fns";
import { es } from "date-fns/locale";

interface VacationRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  created_at: string;
  days_available: number;
}

export function VacationApproval() {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    if (selectedCompany?.id) {
      fetchRequests();
    }
  }, [selectedCompany?.id]);

  const fetchRequests = async () => {
    if (!selectedCompany?.id) return;

    setIsLoading(true);
    try {
      // Fetch pending vacation requests with employee info
      const { data, error } = await supabase
        .from("vacation_requests")
        .select(`
          *,
          employee:employees!inner(
            id,
            full_name,
            work_email,
            vac_balance_days
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const transformedRequests: VacationRequest[] = (data || []).map(req => ({
        id: req.id,
        employee_id: req.employee_id,
        employee_name: req.employee.full_name,
        employee_email: req.employee.work_email,
        start_date: req.start_date,
        end_date: req.end_date,
        days_requested: Number(req.days_requested),
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        days_available: Number(req.employee.vac_balance_days || 0),
      }));

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

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedRequest || !selectedCompany) return;

    // VALIDATION: Check vacation balance before approval
    if (action === 'approve' && selectedRequest.days_available < selectedRequest.days_requested) {
      toast({
        title: "Saldo insuficiente",
        description: `${selectedRequest.employee_name} tiene ${selectedRequest.days_available.toFixed(1)} días disponibles pero solicita ${selectedRequest.days_requested}. No se puede aprobar.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update the request status
      const { error: updateError } = await supabase
        .from("vacation_requests")
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          review_notes: reviewNotes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (updateError) throw updateError;

      // If approved, update the employee's vacation balance
      if (action === 'approve') {
        // Get current vacation record
        const { data: vacationData } = await supabase
          .from("employee_vacations")
          .select("*")
          .eq("employee_id", selectedRequest.employee_id)
          .eq("year", new Date().getFullYear())
          .maybeSingle();

        if (vacationData) {
          // Update days_taken in employee_vacations
          const newDaysTaken = Number(vacationData.days_taken) + selectedRequest.days_requested;
          const newDaysPending = Number(vacationData.days_accrued) - newDaysTaken;

          await supabase
            .from("employee_vacations")
            .update({
              days_taken: newDaysTaken,
              days_pending: newDaysPending,
            })
            .eq("id", vacationData.id);
        }

        // Also update vac_balance_days in employees table
        const newBalance = selectedRequest.days_available - selectedRequest.days_requested;
        await supabase
          .from("employees")
          .update({ vac_balance_days: Math.max(0, newBalance) })
          .eq("id", selectedRequest.employee_id);
      }

      // Send notification email to employee
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: [selectedRequest.employee_email],
            subject: action === 'approve'
              ? `✅ Vacaciones aprobadas — ${selectedRequest.days_requested} días`
              : `❌ Solicitud de vacaciones rechazada`,
            html: action === 'approve'
              ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                  <h2 style="color:#059669">Vacaciones Aprobadas</h2>
                  <p>Hola <strong>${selectedRequest.employee_name}</strong>,</p>
                  <p>Tu solicitud de <strong>${selectedRequest.days_requested} días</strong> de vacaciones ha sido aprobada.</p>
                  <table style="border-collapse:collapse;width:100%;margin:16px 0">
                    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Período</td>
                        <td style="padding:8px;border:1px solid #e5e7eb">${selectedRequest.start_date} al ${selectedRequest.end_date}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Días</td>
                        <td style="padding:8px;border:1px solid #e5e7eb">${selectedRequest.days_requested}</td></tr>
                    ${reviewNotes ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Notas</td>
                        <td style="padding:8px;border:1px solid #e5e7eb">${reviewNotes}</td></tr>` : ''}
                  </table>
                  <p style="color:#6b7280;font-size:12px">ACL Workforce HUB</p>
                </div>`
              : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                  <h2 style="color:#dc2626">Solicitud de Vacaciones Rechazada</h2>
                  <p>Hola <strong>${selectedRequest.employee_name}</strong>,</p>
                  <p>Tu solicitud de <strong>${selectedRequest.days_requested} días</strong> de vacaciones (${selectedRequest.start_date} al ${selectedRequest.end_date}) ha sido rechazada.</p>
                  ${reviewNotes ? `<p><strong>Motivo:</strong> ${reviewNotes}</p>` : ''}
                  <p>Por favor contacta a tu supervisor para más información.</p>
                  <p style="color:#6b7280;font-size:12px">ACL Workforce HUB</p>
                </div>`,
            companyId: selectedCompany.id,
          },
        });
      } catch (emailError) {
        console.error("Error sending vacation notification email:", emailError);
        // Don't block the approval flow if email fails
      }

      toast({
        title: action === 'approve' ? "Solicitud aprobada" : "Solicitud rechazada",
        description: action === 'approve' 
          ? `Se aprobaron ${selectedRequest.days_requested} días de vacaciones para ${selectedRequest.employee_name}`
          : `La solicitud de ${selectedRequest.employee_name} ha sido rechazada`,
      });

      setSelectedRequest(null);
      setReviewNotes("");
      setDialogAction(null);
      fetchRequests();
    } catch (error) {
      console.error("Error processing request:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openActionDialog = (request: VacationRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDialogAction(action);
    setReviewNotes("");
  };

  if (!selectedCompany) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Seleccione una empresa para ver las solicitudes de vacaciones
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Aprobación de Vacaciones
          </h1>
          <p className="text-muted-foreground">
            Gestione las solicitudes pendientes de vacaciones
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} pendiente{requests.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Días Solicitados</p>
                <p className="text-2xl font-bold">
                  {requests.reduce((sum, r) => sum + r.days_requested, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <User className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Colaboradores</p>
                <p className="text-2xl font-bold">
                  {new Set(requests.map(r => r.employee_id)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Solicitudes Pendientes</CardTitle>
          <CardDescription>
            Revise y apruebe o rechace las solicitudes de vacaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-4 text-emerald-500" />
              <p className="text-lg font-medium">¡Todo al día!</p>
              <p>No hay solicitudes pendientes de aprobación</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Fecha Solicitud</TableHead>
                  <TableHead>Período Vacaciones</TableHead>
                  <TableHead className="text-center">Días</TableHead>
                  <TableHead className="text-center">Disponibles</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.employee_name}</p>
                        <p className="text-sm text-muted-foreground">{request.employee_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(request.start_date), "dd/MM")} - {format(new Date(request.end_date), "dd/MM/yyyy")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-bold">
                        {request.days_requested}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={request.days_available >= request.days_requested ? "text-emerald-600" : "text-destructive"}>
                        {request.days_available.toFixed(1)}
                      </span>
                      {request.days_available < request.days_requested && (
                        <AlertTriangle className="h-4 w-4 text-destructive inline ml-1" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.reason || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openActionDialog(request, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => openActionDialog(request, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprobar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogAction !== null} onOpenChange={() => setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? '¿Aprobar solicitud?' : '¿Rechazar solicitud?'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  <strong>{selectedRequest.employee_name}</strong> solicita{' '}
                  <strong>{selectedRequest.days_requested} días</strong> de vacaciones
                  del {format(new Date(selectedRequest.start_date), "dd/MM/yyyy")} al{' '}
                  {format(new Date(selectedRequest.end_date), "dd/MM/yyyy")}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                placeholder={dialogAction === 'approve' 
                  ? "Ej: Aprobado. Favor coordinar entrega de pendientes."
                  : "Ej: No es posible aprobar en estas fechas por cierre de proyecto."
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
              variant={dialogAction === 'approve' ? 'default' : 'destructive'}
              onClick={() => dialogAction && handleAction(dialogAction)}
              disabled={isProcessing}
              className={dialogAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : dialogAction === 'approve' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {dialogAction === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VacationApproval;
