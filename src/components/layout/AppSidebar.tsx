import { useState } from "react";
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
  UserCheck
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

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

const navigationItems = [
  { 
    title: 'nav.dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    group: 'main'
  },
  { 
    title: 'nav.employees', 
    url: '/employees', 
    icon: Users,
    group: 'hr'
  },
  { 
    title: 'nav.contracts', 
    url: '/contracts', 
    icon: FileText,
    group: 'hr'
  },
  { 
    title: 'nav.timesheets', 
    url: '/timesheets', 
    icon: Clock,
    group: 'hr'
  },
  { 
    title: 'nav.payroll_process', 
    url: '/payroll-process', 
    icon: Calculator,
    group: 'payroll'
  },
  { 
    title: 'nav.payslips', 
    url: '/payslips', 
    icon: Receipt,
    group: 'payroll'
  },
  { 
    title: 'nav.cost_centers', 
    url: '/cost-centers', 
    icon: Building2,
    group: 'payroll'
  },
  { 
    title: 'nav.liquidations', 
    url: '/liquidations', 
    icon: DollarSign,
    group: 'payroll'
  },
  { 
    title: 'nav.historico', 
    url: '/historico', 
    icon: BarChart3,
    group: 'reports'
  },
  { 
    title: 'nav.email_center', 
    url: '/email-center', 
    icon: Mail,
    group: 'communications'
  },
  { 
    title: 'nav.parameters', 
    url: '/settings/parameters', 
    icon: Settings,
    group: 'config'
  },
  { 
    title: 'nav.admin', 
    url: '/settings/admin', 
    icon: UserCheck,
    group: 'config'
  }
];

const groups = {
  main: 'Principal',
  hr: 'Recursos Humanos',
  payroll: 'Planillas',
  reports: 'Reportes',
  communications: 'Comunicaciones',
  config: 'Configuración'
};

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useLanguage();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  const isActive = (path: string) => currentPath === path;

  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof navigationItems>);

  return (
    <Sidebar
      collapsible="icon"
    >
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
                    <SidebarMenuButton asChild>
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}