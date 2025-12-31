import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Employees } from "@/pages/Employees";
import Projects from "@/pages/Projects";
import { Contracts } from "@/pages/Contracts";
import { Timesheets } from "@/pages/Timesheets";
import { PayrollProcess } from "@/pages/PayrollProcess";
import { Payslips } from "@/pages/Payslips";
import { Liquidations } from "@/pages/Liquidations";
import { HorasProyecto } from "@/pages/HorasProyecto";
import { Historico } from "@/pages/settings/Historico";
import { Parameters } from "@/pages/settings/Parameters";
import { CostCenters } from "@/pages/CostCenters";
import { VacationReport } from "@/pages/reports/VacationReport";
import { VacationApproval } from "@/pages/VacationApproval";
import { EmployeeProfile } from "@/pages/EmployeeProfile";
import { Users as UsersPage } from "@/pages/Users";
import { EmailCenter } from "@/pages/EmailCenter";
import CompanySelector from "./pages/CompanySelector";
import CreateCompany from "./pages/CreateCompany";
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
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/timesheets" element={<Timesheets />} />
                  <Route path="/payroll-process" element={<PayrollProcess />} />
                  <Route path="/payslips" element={<Payslips />} />
                  <Route path="/cost-centers" element={<CostCenters />} />
                  <Route path="/liquidaciones" element={<Liquidations />} />
                  <Route path="/horas-proyecto" element={<HorasProyecto />} />
                  <Route path="/liquidations" element={<Liquidations />} />
                  <Route path="/reports/vacations" element={<VacationReport />} />
                  <Route path="/vacation-approval" element={<VacationApproval />} />
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/employee-profile" element={<EmployeeProfile />} />
                  <Route path="/create-company" element={<CreateCompany />} />
                  <Route path="/email-center" element={<EmailCenter />} />
                  <Route path="/settings/parameters" element={<Parameters />} />
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
