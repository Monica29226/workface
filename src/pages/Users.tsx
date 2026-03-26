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
import { Search, UserPlus, Trash2, Edit, ChevronRight, ChevronLeft, Loader2, Mail, RefreshCw, X, Send, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { EmailPreviewDialog } from "@/components/users/EmailPreviewDialog";

interface User {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  last_sign_in_at?: string;
  companies: Array<{
    id: string;
    name: string;
    role: string;
    permissions?: CompanyPermission;
  }>;
  // Access status fields
  accessStatus: 'active' | 'never_logged_in' | 'pending_invitation' | 'expired_invitation' | 'no_invitation';
  lastEmailSent?: string;
  lastEmailStatus?: string;
  invitationStatus?: string;
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
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Invitation states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Client_Viewer");
  const [inviteCompanyId, setInviteCompanyId] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  
  // Email preview states
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewType, setEmailPreviewType] = useState<'invitation' | 'credentials'>('invitation');
  const [emailPreviewData, setEmailPreviewData] = useState<{
    email: string;
    name?: string;
    role?: string;
    companyName?: string;
  }>({ email: '' });
  
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
    fetchPendingInvitations();
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

      // Fetch all invitations to determine status
      const { data: allInvitations } = await supabase
        .from('user_invitations')
        .select('email, status, created_at, expires_at')
        .order('created_at', { ascending: false });

      // Fetch recent email logs for credential/invitation emails
      const { data: recentEmailLogs } = await supabase
        .from('email_logs')
        .select('recipient_email, status, sent_at, error_message, subject')
        .order('created_at', { ascending: false })
        .limit(500);

      // Fetch auth info (last_sign_in) from edge function
      let authInfoMap: Record<string, { last_sign_in_at: string | null }> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users-auth-info`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );
          if (response.ok) {
            const { users: authUsers } = await response.json();
            authUsers?.forEach((u: any) => {
              authInfoMap[u.id] = { last_sign_in_at: u.last_sign_in_at };
            });
          }
        }
      } catch (e) {
        console.log('Could not fetch auth info:', e);
      }

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

        // Determine access status
        const lastSignIn = authInfoMap[profile.id]?.last_sign_in_at;
        const userInvitations = allInvitations?.filter(i => i.email === profile.email) || [];
        const latestInvite = userInvitations[0];
        
        // Find last email sent to this user
        const userEmails = recentEmailLogs?.filter(e => e.recipient_email === profile.email) || [];
        const lastEmail = userEmails[0];

        let accessStatus: User['accessStatus'] = 'no_invitation';
        let invitationStatus: string | undefined;

        if (lastSignIn) {
          accessStatus = 'active';
        } else if (latestInvite) {
          if (latestInvite.status === 'accepted') {
            accessStatus = 'never_logged_in';
            invitationStatus = 'Aceptada';
          } else if (latestInvite.status === 'pending') {
            if (new Date(latestInvite.expires_at) < new Date()) {
              accessStatus = 'expired_invitation';
              invitationStatus = 'Expirada';
            } else {
              accessStatus = 'pending_invitation';
              invitationStatus = 'Pendiente';
            }
          } else if (latestInvite.status === 'cancelled') {
            accessStatus = 'no_invitation';
            invitationStatus = 'Cancelada';
          }
        } else {
          accessStatus = 'never_logged_in';
        }

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || profile.email,
          role: userRole?.role,
          last_sign_in_at: lastSignIn || undefined,
          companies: userCompanies,
          accessStatus,
          invitationStatus,
          lastEmailSent: lastEmail?.sent_at || undefined,
          lastEmailStatus: lastEmail?.status || undefined,
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

  const fetchPendingInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          *,
          company:companies(display_name),
          inviter:profiles!user_invitations_invited_by_fkey(full_name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const handleShowInvitationPreview = () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "El correo electrónico es requerido",
        variant: "destructive",
      });
      return;
    }

    const companyName = inviteCompanyId 
      ? companies.find(c => c.id === inviteCompanyId)?.name 
      : undefined;

    setEmailPreviewType('invitation');
    setEmailPreviewData({
      email: inviteEmail,
      role: inviteRole,
      companyName,
    });
    setShowEmailPreview(true);
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "El correo electrónico es requerido",
        variant: "destructive",
      });
      return;
    }

    setIsSendingInvite(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay una sesión activa");

      const companyName = inviteCompanyId 
        ? companies.find(c => c.id === inviteCompanyId)?.name 
        : undefined;

      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "send-invitation",
        {
          body: {
            email: inviteEmail,
            role: inviteRole,
            company_id: inviteCompanyId || null,
            company_name: companyName,
          },
        }
      );

      // Handle edge function errors (status 4xx/5xx)
      if (invokeError) {
        // Try to extract error message from the response body
        const errorBody = (result as any)?.error || invokeError.message;
        throw new Error(errorBody);
      }

      if ((result as any)?.error) {
        throw new Error((result as any).error);
      }

      toast({
        title: "Invitación enviada",
        description: `Se envió una invitación a ${inviteEmail}`,
      });

      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("Client_Viewer");
      setInviteCompanyId("");
      fetchPendingInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error al enviar invitación",
        description: error?.message || 'No se pudo enviar la invitación',
        variant: "destructive",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Invitación cancelada",
        description: "La invitación ha sido cancelada",
      });
      fetchPendingInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la invitación",
        variant: "destructive",
      });
    }
  };

  const handleResendInvitation = async (invitation: any) => {
    setInviteEmail(invitation.email);
    setInviteRole(invitation.role);
    setInviteCompanyId(invitation.company_id || "");
    
    // Cancel old one first
    await handleCancelInvitation(invitation.id);
    
    // Send new one
    handleSendInvitation();
  };

  const handleResendCredentials = async (user: User) => {
    setResendingUserId(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay una sesión activa");

      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "resend-credentials",
        {
          body: {
            user_id: user.id,
            email: user.email,
            full_name: user.full_name,
          },
        }
      );

      if (invokeError) {
        throw invokeError;
      }

      if ((result as any)?.error) {
        throw new Error((result as any).error || "Error al reenviar credenciales");
      }

      toast({
        title: "Credenciales enviadas",
        description: `Se han enviado las credenciales a ${user.email}`,
      });
    } catch (error: any) {
      console.error('Error resending credentials:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron reenviar las credenciales",
        variant: "destructive",
      });
    } finally {
      setResendingUserId(null);
    }
  };

  const formatLastAccess = (dateString?: string) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
    
    return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
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
      let wasUserCreated = false;

      // If new user, find or create profile
      if (!editingUser) {
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!existingProfile) {
          // Create new user via backend function (also sends the credentials email)
          const { data: result, error: invokeError } = await supabase.functions.invoke(
            "create-user",
            {
              body: {
                email: formData.email,
                full_name: formData.full_name || formData.email,
              },
            }
          );

          if (invokeError) {
            throw invokeError;
          }

          if ((result as any)?.error) {
            throw new Error((result as any).error || 'No se pudo crear el usuario');
          }

          if (!(result as any)?.user?.id) {
            throw new Error('No se recibió el ID del usuario creado');
          }

          userId = (result as any).user.id;
          wasUserCreated = true;
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

      const successMessage = wasUserCreated
        ? "Usuario creado exitosamente. Se envió un correo con las credenciales de acceso"
        : editingUser
          ? `Usuario ${formData.email} actualizado correctamente`
          : `Permisos asignados a ${formData.email}`;

      toast({
        title: editingUser
          ? "Usuario actualizado"
          : wasUserCreated
            ? "¡Usuario creado!"
            : "Permisos asignados",
        description: successMessage,
        duration: 3000,
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
    if (!confirm(`¿Eliminar completamente al usuario ${userEmail}? Esta acción no se puede deshacer.`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Usuario eliminado",
        description: `${userEmail} ha sido eliminado completamente del sistema`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsInviteDialogOpen(true)} className="gap-2">
            <Mail className="h-4 w-4" />
            Invitar Usuario
          </Button>
          <Button onClick={openNewUserDialog} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Crear Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-yellow-600" />
              Invitaciones Pendientes ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Rol: {inv.role} {inv.company?.display_name && `• ${inv.company.display_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleResendInvitation(inv)}
                      title="Reenviar invitación"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleCancelInvitation(inv.id)}
                      title="Cancelar invitación"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead className="font-semibold">Último Acceso</TableHead>
                  <TableHead className="font-semibold text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                      <TableCell>
                        <span className={`text-sm ${!user.last_sign_in_at ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          {formatLastAccess(user.last_sign_in_at)}
                        </span>
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
                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                            onClick={() => handleResendCredentials(user)}
                            disabled={resendingUserId === user.id}
                            title="Reenviar credenciales"
                          >
                            {resendingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
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
                <div className="flex gap-2">
                  {!editingUser && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEmailPreviewType('credentials');
                        setEmailPreviewData({
                          email: formData.email,
                          name: formData.full_name,
                        });
                        setShowEmailPreview(true);
                      }}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Vista Previa Correo
                    </Button>
                  )}
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
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Invitation Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Correo Electrónico *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...INTERNAL_ROLES, ...EXTERNAL_ROLES].map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa (opcional)</Label>
              <Select 
                value={inviteCompanyId || "none"} 
                onValueChange={(value) => setInviteCompanyId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin empresa específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin empresa específica</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={handleShowInvitationPreview} className="gap-2">
              <Eye className="h-4 w-4" />
              Vista Previa
            </Button>
            <Button onClick={handleSendInvitation} disabled={isSendingInvite}>
              {isSendingInvite ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <>
                <Mail className="h-4 w-4 mr-2" />Enviar Invitación
              </>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        isOpen={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        onConfirmSend={() => {
          setShowEmailPreview(false);
          if (emailPreviewType === 'invitation') {
            handleSendInvitation();
          }
        }}
        isSending={isSendingInvite}
        emailType={emailPreviewType}
        recipientEmail={emailPreviewData.email}
        recipientName={emailPreviewData.name}
        role={emailPreviewData.role}
        companyName={emailPreviewData.companyName}
      />
    </div>
  );
}