import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Employees } from "@/pages/Employees";
import { Contracts } from "@/pages/Contracts";
import { Timesheets } from "@/pages/Timesheets";
import { PayrollProcess } from "@/pages/PayrollProcess";
import { Payslips } from "@/pages/Payslips";
import { Liquidaciones } from "@/pages/Liquidaciones";
import { HorasProyecto } from "@/pages/HorasProyecto";
import { Historico } from "@/pages/settings/Historico";
import CompanySelector from "./pages/CompanySelector";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LanguageProvider>
          <CompanyProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/index" element={<Index />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/employees" element={<Employees />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/timesheets" element={<Timesheets />} />
                  <Route path="/payroll-process" element={<PayrollProcess />} />
                  <Route path="/payslips" element={<Payslips />} />
                  <Route path="/cost-centers" element={<div className="p-6 text-center text-muted-foreground">Centros de Costo - En desarrollo</div>} />
                  <Route path="/liquidaciones" element={<Liquidaciones />} />
                  <Route path="/horas-proyecto" element={<HorasProyecto />} />
                  <Route path="/liquidations" element={<Liquidaciones />} />
                  <Route path="/reports" element={<div className="p-6 text-center text-muted-foreground">Reportes - En desarrollo</div>} />
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/email-center" element={<div className="p-6 text-center text-muted-foreground">Centro de Correos - En desarrollo</div>} />
                  <Route path="/settings/parameters" element={<div className="p-6 text-center text-muted-foreground">Parámetros - En desarrollo</div>} />
                  <Route path="/settings/admin" element={<div className="p-6 text-center text-muted-foreground">Administración - En desarrollo</div>} />
                  <Route path="/company-selector" element={<CompanySelector />} />
                </Route>
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </BrowserRouter>
          </CompanyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
