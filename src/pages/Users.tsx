import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Trash2, Edit, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface User {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  companies: Array<{
    id: string;
    name: string;
    role: string;
    permissions?: CompanyPermission;
  }>;
}

interface CompanyPermission {
  permission_level: string;
  can_manage_employees: boolean;
  can_manage_projects: boolean;
  can_manage_payroll: boolean;
  can_view_reports: boolean;
  can_manage_parameters: boolean;
  project_scope: string;
  project_ids: string[];
}

interface UserFormData {
  email: string;
  full_name: string;
  user_type: 'internal' | 'external';
  global_role: string;
  companies: Array<{
    company_id: string;
    permission_level: string;
    can_manage_employees: boolean;
    can_manage_projects: boolean;
    can_manage_payroll: boolean;
    can_view_reports: boolean;
    can_manage_parameters: boolean;
    project_scope: string;
    project_ids: string[];
  }>;
}

const INTERNAL_ROLES = [
  { value: 'ACL_SuperAdmin', label: 'ACL Super Admin' },
  { value: 'ACL_PayrollSpecialist', label: 'ACL Especialista en Nómina' },
  { value: 'ACL_Auditor', label: 'ACL Auditor' },
];

const EXTERNAL_ROLES = [
  { value: 'Client_Admin', label: 'Admin Cliente' },
  { value: 'Client_HR', label: 'RRHH Cliente' },
  { value: 'Client_Viewer', label: 'Visor Cliente' },
  { value: 'Employee_Portal', label: 'Portal Empleado' },
];

const PERMISSION_LEVELS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Completo', label: 'Completo' },
  { value: 'Solo lectura', label: 'Solo lectura' },
];

export function Users() {
  const { toast } = useToast();
  const { companies } = useCompany();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    user_type: 'external',
    global_role: 'Client_Viewer',
    companies: [],
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: companyAccess, error: accessError } = await supabase
        .from('company_users')
        .select(`
          user_id,
          role,
          company:companies(id, display_name)
        `);

      if (accessError) throw accessError;

      const { data: permissions, error: permError } = await supabase
        .from('user_company_permissions')
        .select('*');

      if (permError) throw permError;

      const usersData: User[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const userCompanies = (companyAccess || [])
          .filter(ca => ca.user_id === profile.id)
          .map(ca => {
            const perm = permissions?.find(
              p => p.user_id === profile.id && p.company_id === (ca.company as any).id
            );
            return {
              id: (ca.company as any).id,
              name: (ca.company as any).display_name,
              role: ca.role,
              permissions: perm ? {
                permission_level: perm.permission_level,
                can_manage_employees: perm.can_manage_employees,
                can_manage_projects: perm.can_manage_projects,
                can_manage_payroll: perm.can_manage_payroll,
                can_view_reports: perm.can_view_reports,
                can_manage_parameters: perm.can_manage_parameters,
                project_scope: perm.project_scope,
                project_ids: perm.project_ids || [],
              } : undefined,
            };
          });

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || profile.email,
          role: userRole?.role,
          companies: userCompanies
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openNewUserDialog = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      full_name: '',
      user_type: 'external',
      global_role: 'Client_Viewer',
      companies: [],
    });
    setDialogStep(1);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    const userType = ['ACL_SuperAdmin', 'ACL_PayrollSpecialist', 'ACL_Auditor'].includes(user.role || '')
      ? 'internal'
      : 'external';
    
    setFormData({
      email: user.email,
      full_name: user.full_name,
      user_type: userType,
      global_role: user.role || 'Client_Viewer',
      companies: user.companies.map(c => ({
        company_id: c.id,
        permission_level: c.permissions?.permission_level || 'Solo lectura',
        can_manage_employees: c.permissions?.can_manage_employees || false,
        can_manage_projects: c.permissions?.can_manage_projects || false,
        can_manage_payroll: c.permissions?.can_manage_payroll || false,
        can_view_reports: c.permissions?.can_view_reports || true,
        can_manage_parameters: c.permissions?.can_manage_parameters || false,
        project_scope: c.permissions?.project_scope || 'all',
        project_ids: c.permissions?.project_ids || [],
      })),
    });
    setDialogStep(1);
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // Validation
      if (!formData.email) {
        toast({
          title: "Error",
          description: "El correo electrónico es requerido",
          variant: "destructive",
        });
        return;
      }

      if (formData.user_type === 'external' && formData.companies.length === 0) {
        toast({
          title: "Error",
          description: "Los usuarios externos deben tener al menos una empresa asignada",
          variant: "destructive",
        });
        return;
      }

      let userId = editingUser?.id;
      let temporaryPassword: string | null = null;

      // If new user, find or create profile
      if (!editingUser) {
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!existingProfile) {
          // Create new user via edge function
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            throw new Error('No hay una sesión activa');
          }
          
          console.log('Creating new user:', formData.email);
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                email: formData.email,
                full_name: formData.full_name || formData.email,
              }),
            }
          );

          const result = await response.json();
          
          console.log('Create user response:', result);
          
          if (!response.ok || result.error) {
            const errorMsg = result.error || 'No se pudo crear el usuario';
            console.error('Error creating user:', errorMsg);
            throw new Error(errorMsg);
          }

          if (!result.user?.id) {
            throw new Error('No se recibió el ID del usuario creado');
          }

          userId = result.user.id;
          temporaryPassword = result.temporary_password;
          
          console.log('User created successfully:', userId);
        } else {
          userId = existingProfile.id;
        }
      }

      // Update role
      await supabase
        .from('user_roles')
        .upsert({
          user_id: userId!,
          role: formData.global_role as any
        });

      // Remove old company access and permissions
      await supabase.from('company_users').delete().eq('user_id', userId);
      await supabase.from('user_company_permissions').delete().eq('user_id', userId);

      // Add new company access and permissions
      if (formData.companies.length > 0) {
        const companyAccess = formData.companies.map(c => ({
          user_id: userId!,
          company_id: c.company_id,
          role: (formData.global_role === 'ACL_SuperAdmin' ? 'admin' : 'company_manager') as any,
        }));

        await supabase.from('company_users').insert(companyAccess);

        const permissions = formData.companies.map(c => ({
          user_id: userId!,
          company_id: c.company_id,
          permission_level: c.permission_level,
          can_manage_employees: c.can_manage_employees,
          can_manage_projects: c.can_manage_projects,
          can_manage_payroll: c.can_manage_payroll,
          can_view_reports: c.can_view_reports,
          can_manage_parameters: c.can_manage_parameters,
          project_scope: c.project_scope,
          project_ids: c.project_ids,
        }));

        await supabase.from('user_company_permissions').insert(permissions);
      }

      const successMessage = temporaryPassword
        ? `Usuario creado exitosamente. Contraseña temporal: ${temporaryPassword}\n\nEnvíe esta contraseña al usuario para su primer acceso.`
        : editingUser 
          ? `Usuario ${formData.email} actualizado correctamente`
          : `Permisos asignados a ${formData.email}`;

      toast({
        title: editingUser ? "Usuario actualizado" : temporaryPassword ? "¡Usuario creado!" : "Permisos asignados",
        description: successMessage,
        duration: temporaryPassword ? 15000 : 3000,
      });

      setIsDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo guardar el usuario';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Eliminar todos los permisos de ${userEmail}?`)) return;

    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('company_users').delete().eq('user_id', userId);
      await supabase.from('user_company_permissions').delete().eq('user_id', userId);

      toast({
        title: "Permisos eliminados",
        description: `Permisos de ${userEmail} eliminados correctamente`,
      });

      fetchUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los permisos",
        variant: "destructive",
      });
    }
  };

  const addCompanyToForm = () => {
    if (!selectedCompanyId) return;
    
    if (formData.companies.find(c => c.company_id === selectedCompanyId)) {
      toast({
        title: "Empresa ya agregada",
        description: "Esta empresa ya está en la lista",
        variant: "destructive",
      });
      return;
    }

    setFormData({
      ...formData,
      companies: [
        ...formData.companies,
        {
          company_id: selectedCompanyId,
          permission_level: 'Solo lectura',
          can_manage_employees: false,
          can_manage_projects: false,
          can_manage_payroll: false,
          can_view_reports: true,
          can_manage_parameters: false,
          project_scope: 'all',
          project_ids: [],
        },
      ],
    });
    setSelectedCompanyId('');
  };

  const removeCompanyFromForm = (companyId: string) => {
    setFormData({
      ...formData,
      companies: formData.companies.filter(c => c.company_id !== companyId),
    });
  };

  const updateCompanyPermission = (companyId: string, updates: Partial<CompanyPermission>) => {
    setFormData({
      ...formData,
      companies: formData.companies.map(c =>
        c.company_id === companyId ? { ...c, ...updates } : c
      ),
    });
  };

  const getRoleBadge = (role?: string) => {
    const roleConfig: Record<string, { color: string; label: string }> = {
      ACL_SuperAdmin: { color: 'bg-red-100 text-red-800', label: 'Super Admin' },
      ACL_PayrollSpecialist: { color: 'bg-purple-100 text-purple-800', label: 'Especialista' },
      ACL_Auditor: { color: 'bg-orange-100 text-orange-800', label: 'Auditor' },
      Client_Admin: { color: 'bg-blue-100 text-blue-800', label: 'Admin' },
      Client_HR: { color: 'bg-cyan-100 text-cyan-800', label: 'RRHH' },
      Client_Viewer: { color: 'bg-green-100 text-green-800', label: 'Visor' },
      Employee_Portal: { color: 'bg-gray-100 text-gray-800', label: 'Empleado' },
    };

    const config = role ? roleConfig[role] : null;
    if (!config) return <Badge variant="outline">Sin rol</Badge>;

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleOptions = formData.user_type === 'internal' ? INTERNAL_ROLES : EXTERNAL_ROLES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra roles y acceso a empresas</p>
        </div>
        <Button onClick={openNewUserDialog} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Crear Nuevo Usuario
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Usuario</TableHead>
                  <TableHead className="font-semibold">Rol Global</TableHead>
                  <TableHead className="font-semibold">Empresas</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/25">
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.companies.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Sin acceso</span>
                          ) : (
                            user.companies.map(company => (
                              <Badge key={company.id} variant="outline" className="text-xs">
                                {company.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(user)}
                            title="Editar permisos"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveUser(user.id, user.email)}
                            title="Eliminar permisos"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Multi-step Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Editar Usuario - ${formData.email}` : 'Crear Nuevo Usuario'}
            </DialogTitle>
            {!editingUser && (
              <p className="text-sm text-muted-foreground mt-2">
                Complete los siguientes pasos para crear un nuevo usuario en el sistema
              </p>
            )}
          </DialogHeader>

          <Tabs value={`step-${dialogStep}`} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="step-1" onClick={() => setDialogStep(1)}>
                1. Datos Básicos
              </TabsTrigger>
              <TabsTrigger value="step-2" onClick={() => setDialogStep(2)} disabled={!formData.email}>
                2. Rol y Tipo
              </TabsTrigger>
              <TabsTrigger value="step-3" onClick={() => setDialogStep(3)} disabled={!formData.global_role}>
                3. Empresas y Permisos
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Basic Data */}
            <TabsContent value="step-1" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                />
                <p className="text-sm text-muted-foreground">
                  {editingUser 
                    ? "No se puede modificar el correo de un usuario existente"
                    : "Si el usuario no existe, se creará automáticamente con una contraseña temporal"
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre Completo</Label>
                <Input
                  id="full_name"
                  placeholder="Nombre completo del usuario"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setDialogStep(2)}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </TabsContent>

            {/* Step 2: Role and Type */}
            <TabsContent value="step-2" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Usuario *</Label>
                <Select
                  value={formData.user_type}
                  onValueChange={(value: 'internal' | 'external') => {
                    setFormData({
                      ...formData,
                      user_type: value,
                      global_role: value === 'internal' ? 'ACL_PayrollSpecialist' : 'Client_Viewer',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Interno ACL</SelectItem>
                    <SelectItem value="external">Cliente Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rol Global *</Label>
                <Select
                  value={formData.global_role}
                  onValueChange={(value) => setFormData({ ...formData, global_role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setDialogStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
                </Button>
                <Button onClick={() => setDialogStep(3)}>
                  Siguiente <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </TabsContent>

            {/* Step 3: Companies and Permissions */}
            <TabsContent value="step-3" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Asignar Empresas</Label>
                <div className="flex gap-2">
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies
                        .filter(c => !formData.companies.find(fc => fc.company_id === c.id))
                        .map(company => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addCompanyToForm} variant="outline">
                    Agregar
                  </Button>
                </div>
              </div>

              {formData.companies.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4">
                  {formData.companies.map(companyPerm => {
                    const company = companies.find(c => c.id === companyPerm.company_id);
                    return (
                      <Card key={companyPerm.company_id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{company?.name}</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCompanyFromForm(companyPerm.company_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-sm">Nivel de Permiso</Label>
                            <Select
                              value={companyPerm.permission_level}
                              onValueChange={(value) =>
                                updateCompanyPermission(companyPerm.company_id, { permission_level: value })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PERMISSION_LEVELS.map(level => (
                                  <SelectItem key={level.value} value={level.value}>
                                    {level.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm">Módulos Habilitados</Label>
                            <div className="space-y-2">
                              {[
                                { key: 'can_manage_employees', label: 'Gestionar Empleados' },
                                { key: 'can_manage_projects', label: 'Gestionar Proyectos' },
                                { key: 'can_manage_payroll', label: 'Gestionar Planillas' },
                                { key: 'can_view_reports', label: 'Ver Reportes' },
                                { key: 'can_manage_parameters', label: 'Gestionar Parámetros' },
                              ].map(module => (
                                <div key={module.key} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${companyPerm.company_id}-${module.key}`}
                                    checked={companyPerm[module.key as keyof typeof companyPerm] as boolean}
                                    onCheckedChange={(checked) =>
                                      updateCompanyPermission(companyPerm.company_id, {
                                        [module.key]: checked,
                                      } as any)
                                    }
                                  />
                                  <Label
                                    htmlFor={`${companyPerm.company_id}-${module.key}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {module.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm">Alcance de Proyectos</Label>
                            <Select
                              value={companyPerm.project_scope}
                              onValueChange={(value) =>
                                updateCompanyPermission(companyPerm.company_id, { project_scope: value })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos los proyectos</SelectItem>
                                <SelectItem value="specific">Proyectos específicos</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {formData.user_type === 'external' && formData.companies.length === 0 && (
                <p className="text-sm text-destructive">
                  * Los usuarios externos deben tener al menos una empresa asignada
                </p>
              )}

               <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setDialogStep(2)} disabled={isSaving}>
                  <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
                </Button>
                <Button onClick={handleSaveUser} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingUser ? 'Actualizando...' : 'Creando usuario...'}
                    </>
                  ) : (
                    editingUser ? 'Actualizar Usuario' : 'Crear Usuario'
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}