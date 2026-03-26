import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Mail,
  Search,
  AlertTriangle,
  Send,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmailLogEntry {
  id: string;
  company_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  attachment_url: string | null;
  template_id: string | null;
  created_at: string;
}

interface EmailLogPanelProps {
  companyId: string;
  companyName?: string;
}

type EmailType = 'all' | 'colilla' | 'invitacion' | 'credenciales' | 'otro';

function classifyEmailType(subject: string): EmailType {
  const s = subject.toLowerCase();
  if (s.includes('colilla') || s.includes('comprobante') || s.includes('payslip') || s.includes('pago'))
    return 'colilla';
  if (s.includes('invitación') || s.includes('invitacion') || s.includes('invitation') || s.includes('bienvenido'))
    return 'invitacion';
  if (s.includes('credencial') || s.includes('contraseña') || s.includes('acceso') || s.includes('password'))
    return 'credenciales';
  return 'otro';
}

const typeLabels: Record<EmailType, string> = {
  all: 'Todos',
  colilla: 'Colillas',
  invitacion: 'Invitaciones',
  credenciales: 'Credenciales',
  otro: 'Otros',
};

const typeBadgeColors: Record<EmailType, string> = {
  all: '',
  colilla: 'bg-blue-100 text-blue-800',
  invitacion: 'bg-purple-100 text-purple-800',
  credenciales: 'bg-amber-100 text-amber-800',
  otro: 'bg-muted text-muted-foreground',
};

export function EmailLogPanel({ companyId, companyName }: EmailLogPanelProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<EmailType>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLogEntry | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [companyId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros de correos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (log: EmailLogEntry) => {
    setIsResending(true);
    try {
      // For payslip emails, use the specialized function
      const emailType = classifyEmailType(log.subject);
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: [log.recipient_email],
          subject: `[Reenvío] ${log.subject}`,
          html: `<p>Este es un reenvío del correo original enviado el ${log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : 'fecha desconocida'}.</p><p>Por favor contacte a su administrador si tiene dudas.</p>`,
          companyId: companyId,
        },
      });

      if (error) throw error;

      toast({
        title: "Correo reenviado",
        description: `Se reenvió a ${log.recipient_email}`,
      });

      fetchLogs();
    } catch (error: any) {
      toast({
        title: "Error al reenviar",
        description: error.message || "No se pudo reenviar el correo",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
      setSelectedLog(null);
    }
  };

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    const type = classifyEmailType(log.subject);
    if (filterType !== 'all' && type !== filterType) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !log.recipient_email.toLowerCase().includes(q) &&
        !(log.recipient_name || '').toLowerCase().includes(q) &&
        !log.subject.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Stats
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const pendingCount = logs.filter(l => ['pending', 'queued', 'sending'].includes(l.status)).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Falló</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
      case 'resent':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Reenviado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="text-lg font-bold text-emerald-600">{sentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Fallidos</p>
                <p className="text-lg font-bold text-destructive">{failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por correo, nombre o asunto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as EmailType)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="failed">Falló</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-50" />
              <p>No se encontraron registros</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => {
                  const emailType = classifyEmailType(log.subject);
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <Badge className={typeBadgeColors[emailType]} variant="secondary">
                          {typeLabels[emailType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          {log.recipient_name && (
                            <p className="font-medium text-sm">{log.recipient_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{log.recipient_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">
                        {log.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedLog(log)}
                            title="Ver detalle"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {log.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => setSelectedLog(log)}
                              title="Reenviar"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail / Resend Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del Correo</DialogTitle>
            <DialogDescription>
              Información completa del envío
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Destinatario</p>
                  <p className="font-medium">{selectedLog.recipient_name || '—'}</p>
                  <p>{selectedLog.recipient_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Asunto</p>
                <p className="font-medium">{selectedLog.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Creado</p>
                  <p>{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Enviado</p>
                  <p>{selectedLog.sent_at ? format(new Date(selectedLog.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: es }) : '—'}</p>
                </div>
              </div>
              {selectedLog.error_message && (
                <div className="p-3 bg-destructive/10 rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="font-medium text-destructive">Error</p>
                  </div>
                  <p className="text-xs">{selectedLog.error_message}</p>
                </div>
              )}
              {selectedLog.attachment_url && (
                <div>
                  <p className="text-muted-foreground">Adjunto</p>
                  <p className="text-xs break-all">{selectedLog.attachment_url}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Cerrar
            </Button>
            {selectedLog?.status === 'failed' && (
              <Button
                onClick={() => selectedLog && handleResend(selectedLog)}
                disabled={isResending}
              >
                {isResending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Reenviar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
