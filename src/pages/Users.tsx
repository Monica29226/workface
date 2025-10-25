import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Shield, Building2, Trash2, Edit } from "lucide-react";
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
  }>;
}

export function Users() {
  const { toast } = useToast();
  const { companies } = useCompany();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "company_manager" | "employee">("employee");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch company access
      const { data: companyAccess, error: accessError } = await supabase
        .from('company_users')
        .select(`
          user_id,
          role,
          company:companies(id, display_name)
        `);

      if (accessError) throw accessError;

      // Combine data
      const usersData: User[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const userCompanies = (companyAccess || [])
          .filter(ca => ca.user_id === profile.id)
          .map(ca => ({
            id: (ca.company as any).id,
            name: (ca.company as any).display_name,
            role: ca.role
          }));

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

  const handleAddUser = async () => {
    if (!newUserEmail) {
      toast({
        title: "Error",
        description: "Ingresa un correo electrónico",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find user by email - search in profiles instead
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', newUserEmail)
        .single();

      if (profileError || !profiles) {
        toast({
          title: "Error",
          description: "Usuario no encontrado. El usuario debe estar registrado primero.",
          variant: "destructive",
        });
        return;
      }

      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: profiles.id,
          role: newUserRole
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Assign company access
      if (selectedCompanies.length > 0) {
        const companyRole = newUserRole === 'admin' ? 'admin' : 'company_manager';
        const companyAccess = selectedCompanies.map(companyId => ({
          user_id: profiles.id,
          company_id: companyId,
          role: companyRole as "admin" | "company_manager" | "employee"
        }));

        const { error: accessError } = await supabase
          .from('company_users')
          .insert(companyAccess);

        if (accessError && !accessError.message.includes('duplicate')) {
          throw accessError;
        }
      }

      toast({
        title: "Usuario configurado",
        description: `Permisos asignados a ${newUserEmail}`,
      });

      setIsAddDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("employee");
      setSelectedCompanies([]);
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: "No se pudo configurar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedCompanies(user.companies.map(c => c.id));
    setNewUserRole((user.role as any) || "employee");
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      // Update role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: editingUser.id,
          role: newUserRole
        });

      if (roleError) throw roleError;

      // Remove old company access
      await supabase
        .from('company_users')
        .delete()
        .eq('user_id', editingUser.id);

      // Add new company access
      if (selectedCompanies.length > 0) {
        const companyRole = newUserRole === 'admin' ? 'admin' : 'company_manager';
        const companyAccess = selectedCompanies.map(companyId => ({
          user_id: editingUser.id,
          company_id: companyId,
          role: companyRole as "admin" | "company_manager" | "employee"
        }));

        await supabase
          .from('company_users')
          .insert(companyAccess);
      }

      toast({
        title: "Usuario actualizado",
        description: `Permisos de ${editingUser.email} actualizados`,
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      setSelectedCompanies([]);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Eliminar todos los permisos de ${userEmail}?`)) return;

    try {
      // Remove role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Remove company access
      await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId);

      toast({
        title: "Permisos eliminados",
        description: `Permisos de ${userEmail} eliminados`,
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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-800">Admin</Badge>;
      case 'company_manager':
        return <Badge className="bg-blue-100 text-blue-800">Manager</Badge>;
      case 'employee':
        return <Badge className="bg-green-100 text-green-800">Empleado</Badge>;
      default:
        return <Badge variant="outline">Sin rol</Badge>;
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gradient">
            Gestión de Usuarios
          </h1>
          <p className="text-muted-foreground">
            Administra roles y acceso a empresas
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-navy hover:bg-navy/90 text-white">
              <UserPlus className="h-4 w-4" />
              Asignar Permisos
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Permisos a Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  El usuario debe estar registrado en el sistema
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="company_manager">Manager de Empresa</SelectItem>
                    <SelectItem value="employee">Empleado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresas con Acceso</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {companies.map(company => (
                    <label key={company.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCompanies.includes(company.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCompanies([...selectedCompanies, company.id]);
                          } else {
                            setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{company.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddUser}>
                Asignar Permisos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
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
                            onClick={() => handleEditUser(user)}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permisos de {editingUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="company_manager">Manager de Empresa</SelectItem>
                  <SelectItem value="employee">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresas con Acceso</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {companies.map(company => (
                  <label key={company.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(company.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCompanies([...selectedCompanies, company.id]);
                        } else {
                          setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{company.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}