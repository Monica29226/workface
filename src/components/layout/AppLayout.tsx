import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

export function AppLayout() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LanguageProvider>
        <CompanyProvider>
          <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background">
              <AppSidebar />
              <div className="flex-1 flex flex-col">
                <AppHeader />
                <main className="flex-1 p-6">
                  <Outlet />
                </main>
              </div>
            </div>
            <Toaster />
          </SidebarProvider>
        </CompanyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}