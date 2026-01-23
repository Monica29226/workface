import { Eye, EyeOff, User, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

const ADMIN_ROLES: AppRole[] = ['admin', 'ACL_SuperAdmin'];

interface PreviewOption {
  role: AppRole;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const previewOptions: PreviewOption[] = [
  {
    role: 'Employee_Portal',
    label: 'Colaborador',
    description: 'Vista del portal de empleados',
    icon: <User className="h-4 w-4" />
  },
  {
    role: 'Client_HR',
    label: 'Recursos Humanos',
    description: 'Vista de usuario HR cliente',
    icon: <Users className="h-4 w-4" />
  },
  {
    role: 'Client_Admin',
    label: 'Administrador Cliente',
    description: 'Vista de admin de empresa',
    icon: <Shield className="h-4 w-4" />
  }
];

export function RolePreviewSwitcher() {
  const { role } = useUserRole();
  const { previewRole, setPreviewRole, isPreviewMode } = useRolePreview();

  // Only show for admin users
  if (!role || !ADMIN_ROLES.includes(role)) {
    return null;
  }

  const currentPreview = previewOptions.find(opt => opt.role === previewRole);

  return (
    <div className="flex items-center gap-2">
      {isPreviewMode && (
        <Badge 
          variant="outline" 
          className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700 animate-pulse"
        >
          <Eye className="h-3 w-3 mr-1" />
          Vista: {currentPreview?.label}
        </Badge>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={isPreviewMode ? "default" : "outline"} 
            size="sm" 
            className={isPreviewMode 
              ? "bg-amber-500 hover:bg-amber-600 text-white" 
              : ""
            }
          >
            <Eye className="h-4 w-4 mr-1" />
            Previsualizar Rol
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Previsualizar como...</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {previewOptions.map((option) => (
            <DropdownMenuItem
              key={option.role}
              onClick={() => setPreviewRole(option.role)}
              className={`flex items-start gap-3 py-3 cursor-pointer ${
                previewRole === option.role ? 'bg-accent' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {option.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          
          {isPreviewMode && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setPreviewRole(null)}
                className="flex items-center gap-2 text-destructive cursor-pointer"
              >
                <EyeOff className="h-4 w-4" />
                <span>Salir de vista previa</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
