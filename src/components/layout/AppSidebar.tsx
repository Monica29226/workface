import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Clock, 
  DollarSign, 
  Receipt, 
  Building2,
  Calculator,
  BarChart3,
  Mail,
  Settings,
  UserCheck,
  Plus,
  LogOut,
  Calendar,
  UserCircle,
  History,
  Palmtree,
  ClipboardList,
  FileCheck,
  Send
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import aclLogo from "@/assets/logotipo_acl.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { usePayrollWorkflowStatus } from "@/hooks/usePayrollWorkflowStatus";

// Roles that have HR/Admin access (can see full sidebar)
const HR_ROLES: AppRole[] = ['admin', 'company_manager', 'ACL_SuperAdmin', 'ACL_PayrollSpecialist', 'ACL_Auditor', 'Client_Admin', 'Client_HR', 'Client_Viewer'];

// Roles that are admin level (can manage users, create companies)
const ADMIN_ROLES: AppRole[] = ['admin', 'ACL_SuperAdmin'];

// Roles that can manage payroll and employees
const MANAGER_ROLES: AppRole[] = ['admin', 'company_manager', 'ACL_SuperAdmin', 'ACL_PayrollSpecialist', 'Client_Admin', 'Client_HR'];

// Roles that are read-only (can view but not edit)
const VIEWER_ROLES: AppRole[] = ['ACL_Auditor', 'Client_Viewer'];

interface NavigationItem {
  title: string;
  url: string;
  icon: any;
  group: string;
  isAction?: boolean;
  roles?: AppRole[];
  stepNumber?: number;
}

// Items for HR/Admin users - reorganized by workflow
const hrNavigationItems: NavigationItem[] = [
  // === PROCESO DE PLANILLA (Paso a paso) ===
  { 
    title: '1. Crear Lote', 
    url: '/payroll-process', 
    icon: ClipboardList,
    group: 'payroll_workflow',
    roles: MANAGER_ROLES,
    stepNumber: 1
  },
  { 
    title: '2. Pre-Nómina', 
    url: '/reports/pre-nomina', 
    icon: Calculator,
    group: 'payroll_workflow',
    roles: HR_ROLES,
    stepNumber: 2
  },
  { 
    title: '3. Pre-Colilla', 
    url: '/reports/pre-colilla', 
    icon: FileCheck,
    group: 'payroll_workflow',
    roles: HR_ROLES,
    stepNumber: 3
  },
  { 
    title: '4. Enviar Colillas', 
    url: '/payslips', 
    icon: Send,
    group: 'payroll_workflow',
    roles: HR_ROLES,
    stepNumber: 4
  },
  
  // === GESTIÓN (Management) ===
  { 
    title: 'nav.dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    group: 'management',
    roles: HR_ROLES
  },
  { 
    title: 'nav.employees', 
    url: '/employees', 
    icon: Users,
    group: 'management',
    roles: HR_ROLES
  },
  { 
    title: 'nav.projects', 
    url: '/projects', 
    icon: Clock,
    group: 'management',
    roles: HR_ROLES
  },
  
  // === REPORTES ===
  { 
    title: 'nav.historico', 
    url: '/historico', 
    icon: BarChart3,
    group: 'reports',
    roles: HR_ROLES
  },
  { 
    title: 'nav.contracts', 
    url: '/contracts', 
    icon: FileText,
    group: 'reports',
    roles: HR_ROLES
  },
  { 
    title: 'nav.cost_centers', 
    url: '/cost-centers', 
    icon: Building2,
    group: 'reports',
    roles: HR_ROLES
  },
  { 
    title: 'nav.vacation_report', 
    url: '/reports/vacations', 
    icon: Calendar,
    group: 'reports',
    roles: HR_ROLES
  },
  { 
    title: 'Aprobar Vacaciones', 
    url: '/vacation-approval', 
    icon: UserCheck,
    group: 'reports',
    roles: MANAGER_ROLES
  },
  { 
    title: 'nav.liquidations', 
    url: '/liquidations', 
    icon: DollarSign,
    group: 'reports',
    roles: HR_ROLES
  },
  
  // === COMUNICACIONES ===
  { 
    title: 'nav.email_center', 
    url: '/email-center', 
    icon: Mail,
    group: 'communications',
    roles: MANAGER_ROLES
  },
  { 
    title: 'Bitácora de Correos', 
    url: '/email-bitacora', 
    icon: History,
    group: 'communications',
    roles: MANAGER_ROLES
  },
  
  // === ADMINISTRACIÓN ===
  { 
    title: 'nav.users', 
    url: '/users', 
    icon: UserCheck,
    group: 'admin',
    roles: ADMIN_ROLES
  },
  { 
    title: 'nav.parameters', 
    url: '/settings/parameters', 
    icon: Settings,
    group: 'admin',
    roles: [...ADMIN_ROLES, 'Client_Admin']
  },
  { 
    title: 'Configurar Colillas', 
    url: '/settings/payslip', 
    icon: Receipt,
    group: 'admin',
    roles: [...ADMIN_ROLES, 'Client_Admin']
  },
  { 
    title: 'nav.create_company', 
    url: '/create-company', 
    icon: Plus,
    group: 'admin',
    roles: ADMIN_ROLES
  },
];

// Items for Employee Portal
const employeeNavigationItems: NavigationItem[] = [
  { 
    title: 'nav.my_salary_history', 
    url: '/employee-profile', 
    icon: History,
    group: 'employee',
    roles: ['employee']
  },
  { 
    title: 'nav.my_vacations', 
    url: '/employee-vacations', 
    icon: Palmtree,
    group: 'employee',
    roles: ['employee']
  },
];

const logoutItem: NavigationItem = { 
  title: 'Cerrar Sesión', 
  url: '/logout', 
  icon: LogOut,
  group: 'actions',
  isAction: true
};

const hrGroups = {
  payroll_workflow: 'Proceso de Planilla',
  management: 'Gestión',
  reports: 'Reportes',
  communications: 'Comunicaciones',
  admin: 'Administración',
  actions: 'Sesión'
};

const employeeGroups = {
  employee: 'Mi Portal',
  actions: 'Sesión'
};

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { role: actualRole, loading } = useUserRole();
  const { previewRole, isPreviewMode } = useRolePreview();
  const { data: workflowStatus } = usePayrollWorkflowStatus();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  // Use preview role if in preview mode, otherwise use actual role
  const role = isPreviewMode ? previewRole : actualRole;

  // Get badge count for each workflow step
  const getStepBadgeCount = (stepNumber?: number): number => {
    if (!workflowStatus || !stepNumber) return 0;
    
    switch (stepNumber) {
      case 1: // Crear Lote - show drafts that need calculation
        return workflowStatus.borrador;
      case 2: // Pre-Nómina - show calculated batches ready for review
        return workflowStatus.calculado;
      case 3: // Pre-Colilla - show approved batches ready for authorization
        return workflowStatus.aprobado;
      case 4: // Enviar Colillas - show authorized batches ready to send
        return workflowStatus.autorizado;
      default:
        return 0;
    }
  };

  // Get badge variant based on step
  const getStepBadgeVariant = (stepNumber?: number): "default" | "secondary" | "destructive" | "outline" => {
    if (!stepNumber) return "secondary";
    
    switch (stepNumber) {
      case 1: // Borrador - needs attention
        return "destructive";
      case 2: // Calculado - in progress
        return "default";
      case 3: // Aprobado - ready for next step
        return "secondary";
      case 4: // Autorizado - ready to send
        return "default";
      default:
        return "secondary";
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  // Determine which navigation items to show based on role (or preview role)
  const isEmployeeOnly = role === 'employee' || role === 'Employee_Portal';
  const hasHRAccess = role !== null && HR_ROLES.includes(role as AppRole);
  
  // While loading, show HR navigation by default for a better UX (will filter once role loads)
  const navigationItems = loading && !isPreviewMode
    ? [...hrNavigationItems, logoutItem] // Show full menu while loading
    : isEmployeeOnly 
      ? [...employeeNavigationItems, logoutItem]
      : hasHRAccess 
        ? [...hrNavigationItems.filter(item => !item.roles || item.roles.includes(role as AppRole)), logoutItem]
        : [...employeeNavigationItems, logoutItem]; // Fallback to employee view

  const groups = (loading && !isPreviewMode) ? hrGroups : (isEmployeeOnly || !hasHRAccess ? employeeGroups : hrGroups);

  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof navigationItems>);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar text-sidebar-foreground">
        {Object.entries(groupedItems).map(([groupKey, items]) => (
          <SidebarGroup key={groupKey}>
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold text-xs uppercase tracking-wider">
                {groups[groupKey as keyof typeof groups]}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.isAction ? (
                      <SidebarMenuButton
                        onClick={() => {
                          if (item.url === '/logout') {
                            handleLogout();
                          } else {
                            navigate(item.url);
                          }
                        }}
                        className="w-full cursor-pointer"
                        title={item.title === 'Cerrar Sesión' ? item.title : t(item.title)}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && (
                          <span className="truncate">{item.title === 'Cerrar Sesión' ? item.title : t(item.title)}</span>
                        )}
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          end 
                          className={getNavCls}
                          title={t(item.title)}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="truncate flex-1">{t(item.title)}</span>
                              {item.stepNumber && getStepBadgeCount(item.stepNumber) > 0 && (
                                <Badge 
                                  variant={getStepBadgeVariant(item.stepNumber)} 
                                  className="ml-auto h-5 min-w-5 px-1.5 text-xs font-medium"
                                >
                                  {getStepBadgeCount(item.stepNumber)}
                                </Badge>
                              )}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        
        {/* ACL Logo Branding Section */}
        <SidebarGroup className="mt-auto border-t">
          <div className="px-3 py-4">
            <div className="flex items-center gap-2">
              <img 
                src={aclLogo} 
                alt="ACL Workforce HUB" 
                className={collapsed ? "h-8 w-auto" : "h-10 w-auto"}
              />
              {!collapsed && (
                <div>
                  <h3 className="text-sm font-semibold text-sidebar-foreground">
                    ACL Workforce HUB
                  </h3>
                  <p className="text-xs text-sidebar-foreground/60">
                    {isEmployeeOnly ? 'Portal del Colaborador' : 'Gestión de Nómina CR'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
