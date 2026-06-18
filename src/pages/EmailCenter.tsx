import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Mail,
  Send,
  Settings,
  History,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Users,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  language: 'es' | 'en';
  type: 'payslip' | 'notification' | 'reminder';
}

interface EmailLog {
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
  updated_at: string;
}

export function EmailCenter() {
  const { t, language } = useLanguage();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [activeTab, setActiveTab] = useState('send');
  const [sending, setSending] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");

  // Load email logs
  useEffect(() => {
    if (selectedCompany) {
      loadEmailLogs();
    }
  }, [selectedCompany]);

  const loadEmailLogs = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error: any) {
      console.error('Error loading email logs:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros de correos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCompany) {
      toast({
        title: "Error",
        description: "Seleccione una empresa primero",
        variant: "destructive",
      });
      return;
    }

    if (!recipients || !subject || !emailContent) {
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos antes de enviar",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const recipientList = recipients.split(',').map(r => r.trim()).filter(r => r);
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientList,
          subject,
          html: emailContent,
          companyId: selectedCompany.id,
          from: 'Sistema de Planillas <onboarding@resend.dev>',
        },
      });

      if (error) throw error;

      toast({
        title: "Correo enviado",
        description: `Se enviaron ${data.totalSent} correos correctamente`,
      });

      // Clear form
      setRecipients("");
      setSubject("");
      setEmailContent("");
      setSelectedTemplate("");

      // Reload logs
      loadEmailLogs();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudo enviar el correo",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (!selectedCompany) {
      toast({
        title: "Error",
        description: "Seleccione una empresa primero",
        variant: "destructive",
      });
      return;
    }

    if (!recipients || !subject || !emailContent) {
      toast({
        title: "Campos requeridos",
        description: "Complete todos los campos antes de enviar",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const recipientList = recipients.split(',').map(r => {
        const trimmed = r.trim();
        return { email: trimmed };
      }).filter(r => r.email);

      const { data, error } = await supabase.functions.invoke('send-bulk-emails', {
        body: {
          recipients: recipientList,
          subject,
          htmlTemplate: emailContent,
          companyId: selectedCompany.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Envío en proceso",
        description: `Se están procesando ${data.queued} correos`,
      });

      // Clear form
      setRecipients("");
      setSubject("");
      setEmailContent("");
      setSelectedTemplate("");

      // Reload logs after a delay
      setTimeout(() => loadEmailLogs(), 2000);
    } catch (error: any) {
      console.error('Error sending bulk emails:', error);
      toast({
        title: "Error al enviar",
        description: error.message || "No se pudieron enviar los correos",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Falló</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
      case 'queued':
      case 'sending':
        return <Badge variant="secondary">En Cola</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'queued':
      case 'sending':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const sentCount = emailLogs.filter(log => log.status === 'sent').length;
  const failedCount = emailLogs.filter(log => log.status === 'failed').length;
  const pendingCount = emailLogs.filter(log => log.status === 'pending' || log.status === 'queued' || log.status === 'sending').length;

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Seleccione una empresa para continuar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            Centro de Correos
          </h1>
          <p className="text-muted-foreground">
            Gestión de notificaciones y comunicaciones - {selectedCompany?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadEmailLogs}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Email Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Enviados</p>
                <p className="text-2xl font-bold text-green-600">{sentCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fallos</p>
                <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-teal">
                  {emailLogs.length > 0 ? Math.round((sentCount / emailLogs.length) * 100) : 0}%
                </p>
              </div>
              <Mail className="h-8 w-8 text-teal" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-navy">Gestión de Correos Electrónicos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="send">Enviar</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="config">Configuración</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipients">Destinatarios (separados por comas)</Label>
                  <Input
                    id="recipients"
                    placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingrese las direcciones de correo separadas por comas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input 
                    id="subject" 
                    placeholder="Asunto del correo"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje (HTML)</Label>
                  <Textarea
                    id="message"
                    placeholder="Escriba su mensaje aquí... (puede usar HTML)"
                    className="min-h-[200px] font-mono text-sm"
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Puede usar HTML para dar formato al correo
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleSendEmail}
                    disabled={sending || !recipients || !subject || !emailContent}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Correo
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleBulkSend}
                    disabled={sending || !recipients || !subject || !emailContent}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Envío Masivo
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay registros de correos enviados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Estado</TableHead>
                        <TableHead className="font-semibold">Destinatario</TableHead>
                        <TableHead className="font-semibold">Asunto</TableHead>
                        <TableHead className="font-semibold">Fecha</TableHead>
                        <TableHead className="font-semibold">Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailLogs.map(log => (
                        <TableRow key={log.id} className="hover:bg-muted/25">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              {getStatusBadge(log.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {log.recipient_name && (
                                <div className="font-medium">{log.recipient_name}</div>
                              )}
                              <div className="text-sm text-muted-foreground">{log.recipient_email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.sent_at ? formatDate(log.sent_at) : formatDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            {log.error_message && (
                              <span className="text-sm text-destructive">{log.error_message}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900">Configuración de Resend API</h4>
                      <p className="text-sm text-blue-800 mt-1">
                        Para enviar correos, necesita configurar la API key de Resend en los secretos del sistema.
                      </p>
                      <p className="text-sm text-blue-800 mt-2">
                        El secret debe llamarse: <code className="bg-blue-100 px-1 py-0.5 rounded">RESEND_API_KEY</code>
                      </p>
                      <p className="text-sm text-blue-800 mt-2">
                        Puede agregar el secret desde la configuración de Cloud en la interfaz de Lovable.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_email">Email remitente de la empresa</Label>
                  <Input
                    id="from_email"
                    placeholder="ACL Web Planillas <noreply@aclcostarica.com>"
                    value="ACL Web Planillas <noreply@aclcostarica.com>"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Email configurado para el envío de correos del dominio aclcostarica.com
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
