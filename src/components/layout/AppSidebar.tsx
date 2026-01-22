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
  Palmtree
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
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";

interface NavigationItem {
  title: string;
  url: string;
  icon: any;
  group: string;
  isAction?: boolean;
  roles?: ('admin' | 'company_manager' | 'employee')[];
}

// Items for HR/Admin users
const hrNavigationItems: NavigationItem[] = [
  { 
    title: 'nav.dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    group: 'main',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.payroll_process', 
    url: '/payroll-process', 
    icon: Calculator,
    group: 'main',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.employees', 
    url: '/employees', 
    icon: Users,
    group: 'main',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.projects', 
    url: '/projects', 
    icon: Clock,
    group: 'main',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.payslips', 
    url: '/payslips', 
    icon: Receipt,
    group: 'main',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.historico', 
    url: '/historico', 
    icon: BarChart3,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.contracts', 
    url: '/contracts', 
    icon: FileText,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.cost_centers', 
    url: '/cost-centers', 
    icon: Building2,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.vacation_report', 
    url: '/reports/vacations', 
    icon: Calendar,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'Desglose Planilla', 
    url: '/reports/payroll-breakdown', 
    icon: Receipt,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'Planilla Editable', 
    url: '/reports/editable-payroll', 
    icon: Calculator,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'Aprobar Vacaciones', 
    url: '/vacation-approval', 
    icon: UserCheck,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.liquidations', 
    url: '/liquidations', 
    icon: DollarSign,
    group: 'reports',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.email_center', 
    url: '/email-center', 
    icon: Mail,
    group: 'communications',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.users', 
    url: '/users', 
    icon: UserCheck,
    group: 'admin',
    roles: ['admin']
  },
  { 
    title: 'nav.parameters', 
    url: '/settings/parameters', 
    icon: Settings,
    group: 'admin',
    roles: ['admin', 'company_manager']
  },
  { 
    title: 'nav.create_company', 
    url: '/create-company', 
    icon: Plus,
    group: 'admin',
    roles: ['admin']
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
  main: 'ACL Workforce HUB',
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
  const { role, loading } = useUserRole();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  // Determine which navigation items to show based on role
  const isEmployeeOnly = role === 'employee';
  const navigationItems = isEmployeeOnly 
    ? [...employeeNavigationItems, logoutItem]
    : [...hrNavigationItems.filter(item => !item.roles || item.roles.includes(role || 'employee')), logoutItem];

  const groups = isEmployeeOnly ? employeeGroups : hrGroups;

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
                    <SidebarMenuButton asChild={!item.isAction}>
                      {item.isAction ? (
                        <button
                          onClick={() => {
                            if (item.url === '/logout') {
                              handleLogout();
                            } else {
                              navigate(item.url);
                            }
                          }}
                          className="w-full flex items-center gap-2 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground px-2 py-1.5 rounded-md transition-colors"
                          title={item.title === 'Cerrar Sesión' ? item.title : t(item.title)}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && (
                            <span className="truncate">{item.title === 'Cerrar Sesión' ? item.title : t(item.title)}</span>
                          )}
                        </button>
                      ) : (
                        <NavLink 
                          to={item.url} 
                          end 
                          className={getNavCls}
                          title={t(item.title)}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!collapsed && (
                            <span className="truncate">{t(item.title)}</span>
                          )}
                        </NavLink>
                      )}
                    </SidebarMenuButton>
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
