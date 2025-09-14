import { useState } from "react";
import { Building2, ChevronDown, Globe, Menu, Bell, User } from "lucide-react";
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

const companies = [
  { id: "coH", name: "Asociación Horizonte Positivo", cedula: "3-002-674691" },
  { id: "coT", name: "Alturas de Tenorio", cedula: "3-101-555555" },
];

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header = ({ onMenuToggle }: HeaderProps) => {
  const [selectedCompany, setSelectedCompany] = useState(companies[0]);
  const [language, setLanguage] = useState<"es" | "en">("es");

  const toggleLanguage = () => {
    setLanguage(prev => prev === "es" ? "en" : "es");
  };

  const labels = {
    es: {
      company: "Compañía",
      notifications: "Notificaciones",
      profile: "Perfil",
      settings: "Configuración",
      logout: "Cerrar Sesión",
      systemTitle: "Sistema de Planillas"
    },
    en: {
      company: "Company",
      notifications: "Notifications",
      profile: "Profile", 
      settings: "Settings",
      logout: "Sign Out",
      systemTitle: "Payroll System"
    }
  };

  const t = labels[language];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost" 
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-navy">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gradient">{t.systemTitle}</h1>
              <p className="text-xs text-muted-foreground">Multi-Compañía Costa Rica</p>
            </div>
          </div>
        </div>

        {/* Center - Company Switcher */}
        <div className="flex-1 max-w-md mx-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between bg-card hover:bg-accent/50 border-2 border-primary/20"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-medium truncate max-w-32 sm:max-w-48">
                      {selectedCompany.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedCompany.cedula}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-80">
              <DropdownMenuLabel>{t.company}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companies.map((company) => (
                <DropdownMenuItem 
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-8 w-8 rounded-lg gradient-navy flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{company.name}</div>
                      <div className="text-xs text-muted-foreground">{company.cedula}</div>
                    </div>
                    {selectedCompany.id === company.id && (
                      <Badge variant="secondary" className="text-xs">Activa</Badge>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{language.toUpperCase()}</span>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-destructive">
              3
            </Badge>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>ACL Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t.profile}</DropdownMenuItem>
              <DropdownMenuItem>{t.settings}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">{t.logout}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};