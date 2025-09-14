import { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatDate } from "@/lib/utils";

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
  recipient: string;
  recipientName: string;
  subject: string;
  template: string;
  status: 'sent' | 'failed' | 'pending' | 'queued';
  sentDate: string;
  errorMessage?: string;
  attachments?: string[];
}

export function EmailCenter() {
  const { t, language } = useLanguage();
  const { selectedCompany } = useCompany();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [activeTab, setActiveTab] = useState('send');

  const emailTemplates: EmailTemplate[] = [
    {
      id: '1',
      name: 'Colilla de Pago - Español',
      subject: 'Colilla de Pago - {{empresa}} - {{periodo}}',
      content: `Estimado/a {{empleado}},

Esperamos que se encuentre bien. Adjunto encontrará su colilla de pago correspondiente al período {{periodo}}.

**Resumen del pago:**
- Salario Neto: {{neto}}
- Período: {{periodo}}
- Fecha de pago: {{fecha_pago}}

Si tiene alguna consulta sobre su colilla de pago, no dude en contactarnos.

Atentamente,
Departamento de Recursos Humanos
{{empresa}}`,
      language: 'es',
      type: 'payslip'
    },
    {
      id: '2',
      name: 'Payslip - English',
      subject: 'Payslip - {{company}} - {{period}}',
      content: `Dear {{employee}},

Please find attached your payslip for the period {{period}}.

**Payment Summary:**
- Net Salary: {{net}}
- Period: {{period}}
- Payment Date: {{payment_date}}

If you have any questions regarding your payslip, please don't hesitate to contact us.

Best regards,
Human Resources Department
{{company}}`,
      language: 'en',
      type: 'payslip'
    }
  ];

  const emailLogs: EmailLog[] = [
    {
      id: '1',
      recipient: 'gabriel@horizontepositivo.org',
      recipientName: 'Gabriel Cordero González',
      subject: 'Colilla de Pago - Horizonte Positivo - Setiembre 2025',
      template: 'Colilla de Pago - Español',
      status: 'sent',
      sentDate: '2025-09-30T10:30:00',
      attachments: ['colilla_gabriel_202509.pdf']
    },
    {
      id: '2',
      recipient: 'krissya@horizontepositivo.org',
      recipientName: 'Krissya Paulina Gutiérrez Solís',
      subject: 'Colilla de Pago - Horizonte Positivo - Setiembre 2025',
      template: 'Colilla de Pago - Español',
      status: 'sent',
      sentDate: '2025-09-30T10:31:00',
      attachments: ['colilla_krissya_202509.pdf']
    },
    {
      id: '3',
      recipient: 'david@horizontepositivo.org',
      recipientName: 'David Marín Mora',
      subject: 'Colilla de Pago - Horizonte Positivo - Setiembre 2025',
      template: 'Colilla de Pago - Español',
      status: 'failed',
      sentDate: '2025-09-30T10:32:00',
      errorMessage: 'Email address not found',
      attachments: ['colilla_david_202509.pdf']
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Falló</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
      case 'queued':
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
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const sentCount = emailLogs.filter(log => log.status === 'sent').length;
  const failedCount = emailLogs.filter(log => log.status === 'failed').length;
  const pendingCount = emailLogs.filter(log => log.status === 'pending').length;

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
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuración SMTP
          </Button>
          <Button size="sm" className="gap-2 gradient-navy text-white">
            <Send className="h-4 w-4" />
            Envío Masivo
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="send">Enviar</TabsTrigger>
              <TabsTrigger value="templates">Plantillas</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
              <TabsTrigger value="config">Configuración</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailType">Tipo de Envío</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payslips">Colillas de Pago</SelectItem>
                        <SelectItem value="notifications">Notificaciones</SelectItem>
                        <SelectItem value="reminders">Recordatorios</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template">Plantilla</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar plantilla..." />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTemplates
                          .filter(template => template.language === language)
                          .map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipients">Destinatarios</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar destinatarios..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Empleados</SelectItem>
                        <SelectItem value="active">Solo Empleados Activos</SelectItem>
                        <SelectItem value="cost_center">Por Centro de Costo</SelectItem>
                        <SelectItem value="department">Por Departamento</SelectItem>
                        <SelectItem value="custom">Selección Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/25 rounded-lg">
                    <h4 className="font-semibold mb-2">Vista Previa de la Plantilla</h4>
                    {selectedTemplate ? (
                      <div className="text-sm space-y-2">
                        <div>
                          <strong>Asunto:</strong> {emailTemplates.find(t => t.id === selectedTemplate)?.subject}
                        </div>
                        <div>
                          <strong>Contenido:</strong>
                          <div className="mt-2 p-2 bg-background rounded text-xs max-h-32 overflow-y-auto">
                            {emailTemplates.find(t => t.id === selectedTemplate)?.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Selecciona una plantilla para ver la vista previa
                      </p>
                    )}
                  </div>

                  <Button className="w-full gradient-navy text-white">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Correos
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Plantillas de Email</h3>
                <Button size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Nueva Plantilla
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailTemplates.map(template => (
                  <Card key={template.id} className="card-elevated">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline">{template.language.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Asunto:</p>
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Vista Previa:</p>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {template.content.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          Probar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Historial de Envíos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                  <Button variant="outline" size="sm">
                    Reenviar Fallidos
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Estado</TableHead>
                      <TableHead className="font-semibold">Destinatario</TableHead>
                      <TableHead className="font-semibold">Asunto</TableHead>
                      <TableHead className="font-semibold">Plantilla</TableHead>
                      <TableHead className="font-semibold">Fecha</TableHead>
                      <TableHead className="font-semibold">Adjuntos</TableHead>
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
                            <div className="font-medium">{log.recipientName}</div>
                            <div className="text-sm text-muted-foreground">{log.recipient}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell>{log.template}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatDate(log.sentDate)}
                        </TableCell>
                        <TableCell>
                          {log.attachments && log.attachments.length > 0 ? (
                            <Badge variant="secondary">{log.attachments.length} archivo(s)</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configuración SMTP</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Servidor SMTP</Label>
                      <Input placeholder="smtp.gmail.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Puerto</Label>
                        <Input placeholder="587" />
                      </div>
                      <div className="space-y-2">
                        <Label>Seguridad</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="TLS" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tls">TLS</SelectItem>
                            <SelectItem value="ssl">SSL</SelectItem>
                            <SelectItem value="none">Ninguna</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email de Envío</Label>
                      <Input placeholder="rrhh@empresa.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraseña/Token</Label>
                      <Input type="password" placeholder="••••••••" />
                    </div>
                    <Button className="w-full">
                      Guardar Configuración
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Configuración Avanzada</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Límite de Envío por Hora</Label>
                      <Input placeholder="100" type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Reintentos en Caso de Fallo</Label>
                      <Input placeholder="3" type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tiempo Entre Reintentos (minutos)</Label>
                      <Input placeholder="30" type="number" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="enableTracking" className="rounded" />
                      <Label htmlFor="enableTracking">Habilitar seguimiento de lectura</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="enableQueue" className="rounded" />
                      <Label htmlFor="enableQueue">Usar cola de envío</Label>
                    </div>

                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-700">
                          <strong>Importante:</strong> Configure correctamente el SMTP antes de enviar correos masivos.
                          Recomendamos usar servicios como Gmail, Outlook o proveedores especializados.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}