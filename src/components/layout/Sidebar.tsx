import { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Clock, 
  DollarSign, 
  Receipt, 
  UserX, 
  Mail, 
  Settings, 
  Building,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const menuItems = [
  { 
    title: { es: "Dashboard", en: "Dashboard" }, 
    icon: LayoutDashboard, 
    path: "/", 
    description: { es: "Resumen interactivo", en: "Interactive overview" } 
  },
  { 
    title: { es: "Empleados", en: "Employees" }, 
    icon: Users, 
    path: "/employees", 
    description: { es: "Gestión de personal", en: "Staff management" } 
  },
  { 
    title: { es: "Contratos", en: "Contracts" }, 
    icon: FileText, 
    path: "/contracts", 
    description: { es: "Contratos laborales", en: "Labor contracts" } 
  },
  { 
    title: { es: "Distribución", en: "Timesheet" }, 
    icon: Clock, 
    path: "/timesheet", 
    description: { es: "8 horas diarias", en: "8 daily hours" } 
  },
  { 
    title: { es: "Planillas CC", en: "Payroll CC" }, 
    icon: DollarSign, 
    path: "/payroll-cc", 
    description: { es: "Por centro de costo", en: "By cost center" } 
  },
  { 
    title: { es: "Proceso", en: "Process" }, 
    icon: Receipt, 
    path: "/payroll-process", 
    description: { es: "Ciclo mensual", en: "Monthly cycle" } 
  },
  { 
    title: { es: "Colillas", en: "Payslips" }, 
    icon: Receipt, 
    path: "/payslips", 
    description: { es: "Recibos de pago", en: "Pay receipts" } 
  },
  { 
    title: { es: "Liquidaciones", en: "Terminations" }, 
    icon: UserX, 
    path: "/liquidaciones", 
    description: { es: "Liquidaciones", en: "Settlements" } 
  },
  { 
    title: { es: "Correos", en: "Email Center" }, 
    icon: Mail, 
    path: "/email-center", 
    description: { es: "Centro de correos", en: "Email center" } 
  },
  { 
    title: { es: "Configuración", en: "Settings" }, 
    icon: Settings, 
    path: "/settings", 
    description: { es: "Parámetros empresa", en: "Company params" } 
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  language: "es" | "en";
}

export const Sidebar = ({ isOpen, onToggle, language = "es" }: SidebarProps) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] bg-card border-r transition-all duration-300 ease-in-out md:sticky md:top-16",
          isOpen ? "w-72" : "w-16",
          "md:block",
          !isOpen && "translate-x-0"
        )}
      >
        {/* Toggle Button */}
        <div className="flex h-12 items-center justify-end px-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="hidden md:flex"
          >
            {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    !isOpen && "justify-center"
                  )
                }
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.title[language]}</div>
                    <div className="text-xs opacity-70 truncate">
                      {item.description[language]}
                    </div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Company Info at Bottom */}
        {isOpen && (
          <div className="absolute bottom-4 left-2 right-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <div className="text-xs">
                <div className="font-medium">Horizonte Positivo</div>
                <div className="text-muted-foreground">3-002-674691</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};