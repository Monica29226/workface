import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { Toaster } from "@/components/ui/toaster";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full acl-shell">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 p-6">
            <Outlet />
          </main>
          <footer className="border-t bg-card/70">
            <div className="container flex flex-col gap-2 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-medium text-foreground">ACL</span> · Accounting Consulting Leaders
                <span className="mx-2">·</span>
                Plataforma de Planillas
              </div>
              <div className="flex flex-wrap gap-3">
                <span>aclcostarica.com</span>
                <span>3-102-867349</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
