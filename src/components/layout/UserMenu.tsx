import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface UserInfo {
  email: string;
  fullName: string;
}

const roleLabels: Record<AppRole, { es: string; en: string }> = {
  admin: { es: "Administrador", en: "Admin" },
  company_manager: { es: "Gerente", en: "Manager" },
  employee: { es: "Colaborador", en: "Employee" },
  ACL_SuperAdmin: { es: "Super Admin ACL", en: "ACL Super Admin" },
  ACL_PayrollSpecialist: { es: "Especialista Nómina", en: "Payroll Specialist" },
  ACL_Auditor: { es: "Auditor ACL", en: "ACL Auditor" },
  Client_Admin: { es: "Admin Cliente", en: "Client Admin" },
  Client_HR: { es: "Recursos Humanos", en: "Human Resources" },
  Client_Viewer: { es: "Visor", en: "Viewer" },
  Employee_Portal: { es: "Portal Empleado", en: "Employee Portal" },
};

export function UserMenu() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, role } = useUserRole();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (user) {
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
      setUserInfo({
        email: user.email || '',
        fullName: fullName,
      });
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = () => {
    if (!role) return '';
    const labels = roleLabels[role];
    return labels ? labels[language] : role;
  };

  const t = {
    es: {
      profile: "Mi Perfil",
      settings: "Configuración",
      logout: "Cerrar Sesión",
      loading: "Cargando...",
    },
    en: {
      profile: "My Profile",
      settings: "Settings",
      logout: "Sign Out",
      loading: "Loading...",
    },
  };

  const labels = t[language];

  if (!userInfo) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4 mr-2" />
        {labels.loading}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-auto py-1.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(userInfo.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start text-left">
            <span className="text-sm font-medium leading-tight">
              {userInfo.fullName}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {getRoleLabel()}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userInfo.fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userInfo.email}
            </p>
            {role && (
              <p className="text-xs leading-none text-primary font-medium mt-1">
                {getRoleLabel()}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/employee-profile")} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          {labels.profile}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings/parameters")} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          {labels.settings}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {labels.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
