import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Users, Calendar, FileText, Plus, Edit, Trash2, Mail, Copy, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  legal_name: string;
  juridical_id: string;
  logo_url?: string;
  primary_color: string;
  accent_color: string;
  light_color: string;
  active: boolean;
  created_at: string;
}

interface CompanyUser {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface PayrollPeriod {
  id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  exchange_rate: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  company_id: string;
  user_id?: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  antes?: any;
  despues?: any;
  motivo?: string;
  created_at: string;
}

export function Admin() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("companies");

  // Dialog states
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("Viewer");

  const roles = ["Owner", "Admin", "Payroll", "Manager", "Viewer", "Employee"];
  const periodStatuses = ["Draft", "In Review", "Approved", "Closed"];

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (selectedTab) {
        case "companies":
          await loadCompanies();
          break;
        case "users":
          await loadUsers();
          break;
        case "periods":
          await loadPeriods();
          break;
        case "audit":
          await loadAuditLogs();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCompanies(data || []);
  };

  const loadUsers = async () => {
    if (!selectedCompany?.id) return;

    const { data, error } = await supabase
      .from('company_users')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setUsers(data || []);
  };

  const loadPeriods = async () => {
    if (!selectedCompany?.id) return;

    const { data, error } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('start_date', { ascending: false });

    if (error) throw error;
    setPeriods(data || []);
  };

  const loadAuditLogs = async () => {
    if (!selectedCompany?.id) return;

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    setAuditLogs(data || []);
  };

  const handleSaveCompany = async (companyData: Partial<Company>) => {
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', editingCompany.id);
        
        if (error) throw error;
        
        toast({
          title: "Actualizado",
          description: "Compañía actualizada exitosamente",
        });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert(companyData as any);
        
        if (error) throw error;
        
        toast({
          title: "Creado",
          description: "Compañía creada exitosamente",
        });
      }
      
      setShowCompanyDialog(false);
      setEditingCompany(null);
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la compañía",
        variant: "destructive"
      });
    }
  };

  const handleInviteUser = async () => {
    if (!selectedCompany?.id || !inviteEmail) return;

    try {
      // Here you would implement the actual user invitation logic
      // For now, we'll simulate adding a user directly
      toast({
        title: "Invitación enviada",
        description: `Invitación enviada a ${inviteEmail}`,
      });
      
      setShowUserDialog(false);
      setInviteEmail("");
      setSelectedRole("Viewer");
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar la invitación",
        variant: "destructive"
      });
    }
  };

  const handleCreatePeriod = async (periodData: Partial<PayrollPeriod>) => {
    if (!selectedCompany?.id) return;

    try {
      const { error } = await supabase
        .from('payroll_periods')
        .insert({
          ...periodData,
          company_id: selectedCompany.id
        } as any);

      if (error) throw error;

      toast({
        title: "Creado",
        description: "Período creado exitosamente",
      });

      setShowPeriodDialog(false);
      loadPeriods();
    } catch (error) {
      console.error('Error creating period:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el período",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePeriodStatus = async (periodId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('payroll_periods')
        .update({ status: newStatus })
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: "Actualizado",
        description: "Estado del período actualizado",
      });

      loadPeriods();
    } catch (error) {
      console.error('Error updating period status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Draft': return 'secondary';
      case 'In Review': return 'default';
      case 'Approved': return 'default';
      case 'Closed': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administrador</h1>
          <p className="text-muted-foreground">Gestión multi-compañía y accesos</p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="companies">Compañías</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="periods">Períodos</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Gestión de Compañías</h2>
            <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingCompany(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Compañía
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingCompany ? 'Editar Compañía' : 'Nueva Compañía'}
                  </DialogTitle>
                </DialogHeader>
                <CompanyForm
                  company={editingCompany}
                  onSave={handleSaveCompany}
                  onCancel={() => {
                    setShowCompanyDialog(false);
                    setEditingCompany(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Cédula Jurídica</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.legal_name}</TableCell>
                      <TableCell>{company.juridical_id}</TableCell>
                      <TableCell>
                        <Badge variant={company.active ? "default" : "secondary"}>
                          {company.active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(company.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCompany(company);
                              setShowCompanyDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Usuarios y Accesos</h2>
            <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Invitar Usuario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar Usuario</DialogTitle>
                  <DialogDescription>
                    Envía una invitación por correo para unirse a la compañía
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Rol</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInviteUser}>
                    Enviar Invitación
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario ID</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.user_id}</TableCell>
                      <TableCell>
                        <Badge>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "default" : "secondary"}>
                          {user.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periods" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Gestión de Períodos</h2>
            <Dialog open={showPeriodDialog} onOpenChange={setShowPeriodDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Período
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Período</DialogTitle>
                </DialogHeader>
                <PeriodForm onSave={handleCreatePeriod} onCancel={() => setShowPeriodDialog(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tipo de Cambio</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell>{formatDate(period.start_date)}</TableCell>
                      <TableCell>{formatDate(period.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(period.status)}>
                          {period.status}
                        </Badge>
                      </TableCell>
                      <TableCell>₡{period.exchange_rate}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Select
                            value={period.status}
                            onValueChange={(value) => handleUpdatePeriodStatus(period.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {periodStatuses.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h2 className="text-xl font-semibold">Registro de Auditoría</h2>
          
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                      <TableCell className="font-mono text-sm">{log.user_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.accion}</Badge>
                      </TableCell>
                      <TableCell>{log.entidad}</TableCell>
                      <TableCell>{log.motivo || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Company Form Component
function CompanyForm({ 
  company, 
  onSave, 
  onCancel 
}: { 
  company: Company | null; 
  onSave: (data: Partial<Company>) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: company?.name || '',
    legal_name: company?.legal_name || '',
    juridical_id: company?.juridical_id || '',
    primary_color: company?.primary_color || '#0B2B4C',
    accent_color: company?.accent_color || '#2A9D8F',
    light_color: company?.light_color || '#F5EFE6',
    active: company?.active ?? true
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="legal_name">Razón Social</Label>
          <Input
            id="legal_name"
            value={formData.legal_name}
            onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="juridical_id">Cédula Jurídica</Label>
        <Input
          id="juridical_id"
          value={formData.juridical_id}
          onChange={(e) => setFormData({ ...formData, juridical_id: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="primary_color">Color Primario</Label>
          <Input
            id="primary_color"
            type="color"
            value={formData.primary_color}
            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="accent_color">Color Acento</Label>
          <Input
            id="accent_color"
            type="color"
            value={formData.accent_color}
            onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="light_color">Color Claro</Label>
          <Input
            id="light_color"
            type="color"
            value={formData.light_color}
            onChange={(e) => setFormData({ ...formData, light_color: e.target.value })}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(formData)}>
          {company ? 'Actualizar' : 'Crear'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Period Form Component
function PeriodForm({ 
  onSave, 
  onCancel 
}: { 
  onSave: (data: Partial<PayrollPeriod>) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    exchange_rate: 510.27,
    status: 'Draft'
  });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre del Período</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enero 2025"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Fecha de Inicio</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="end_date">Fecha de Fin</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="exchange_rate">Tipo de Cambio</Label>
        <Input
          id="exchange_rate"
          type="number"
          step="0.01"
          value={formData.exchange_rate}
          onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) })}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(formData)}>
          Crear Período
        </Button>
      </DialogFooter>
    </div>
  );
}