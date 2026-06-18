import { Globe, Languages, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanySwitcher } from "./CompanySwitcher";
import { UserMenu } from "./UserMenu";
import { RolePreviewSwitcher } from "./RolePreviewSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { ACLLogo } from "@/components/branding/ACLLogo";

export function AppHeader() {
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex min-h-[72px] items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="h-8 w-8" />
          <div className="hidden lg:flex items-center gap-4">
            <ACLLogo variant="row" size={38} />
            <div className="border-l border-border pl-4">
              <p className="acl-eyebrow">ACL Web</p>
              <p className="text-sm font-semibold text-foreground">Plataforma de Planillas</p>
              <p className="text-xs text-muted-foreground">Entorno institucional para planillas, RRHH y autoservicio</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <RolePreviewSwitcher />
          <CompanySwitcher />
          
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Languages className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">
                    {language}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setLanguage('es')}
                  className={language === 'es' ? 'bg-accent' : ''}
                >
                  Español
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLanguage('en')}
                  className={language === 'en' ? 'bg-accent' : ''}
                >
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex gap-2"
            >
              <a href="https://aclcostarica.com" target="_blank" rel="noreferrer">
                <Globe className="h-4 w-4" />
                ACL WEB
              </a>
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
