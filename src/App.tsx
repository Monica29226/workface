import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";

// Lazy load all pages for better initial bundle size
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Employees = lazy(() => import("@/pages/Employees").then(m => ({ default: m.Employees })));
const Projects = lazy(() => import("@/pages/Projects"));
const Contracts = lazy(() => import("@/pages/Contracts").then(m => ({ default: m.Contracts })));
const Timesheets = lazy(() => import("@/pages/Timesheets").then(m => ({ default: m.Timesheets })));
const PayrollProcess = lazy(() => import("@/pages/PayrollProcess").then(m => ({ default: m.PayrollProcess })));
const Payslips = lazy(() => import("@/pages/Payslips").then(m => ({ default: m.Payslips })));
const Liquidations = lazy(() => import("@/pages/Liquidations").then(m => ({ default: m.Liquidations })));
const HorasProyecto = lazy(() => import("@/pages/HorasProyecto").then(m => ({ default: m.HorasProyecto })));
const Historico = lazy(() => import("@/pages/settings/Historico").then(m => ({ default: m.Historico })));
const Parameters = lazy(() => import("@/pages/settings/Parameters").then(m => ({ default: m.Parameters })));
const CostCenters = lazy(() => import("@/pages/CostCenters").then(m => ({ default: m.CostCenters })));
const VacationReport = lazy(() => import("@/pages/reports/VacationReport").then(m => ({ default: m.VacationReport })));
const PreNomina = lazy(() => import("@/pages/reports/PreNomina").then(m => ({ default: m.PreNomina })));
const PreColilla = lazy(() => import("@/pages/reports/PreColilla").then(m => ({ default: m.PreColilla })));
const VacationApproval = lazy(() => import("@/pages/VacationApproval").then(m => ({ default: m.VacationApproval })));
const EmployeeProfile = lazy(() => import("@/pages/EmployeeProfile").then(m => ({ default: m.EmployeeProfile })));
const EmployeeVacations = lazy(() => import("@/pages/EmployeeVacations").then(m => ({ default: m.EmployeeVacations })));
const UsersPage = lazy(() => import("@/pages/Users").then(m => ({ default: m.Users })));
const EmailCenter = lazy(() => import("@/pages/EmailCenter").then(m => ({ default: m.EmailCenter })));
const CompanySelector = lazy(() => import("./pages/CompanySelector"));
const CreateCompany = lazy(() => import("./pages/CreateCompany"));
const Auth = lazy(() => import("./pages/Auth"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with caching and stale time
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1, // Only retry once on failure
      refetchOnMount: false, // Don't refetch if data is fresh
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LanguageProvider>
          <CompanyProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
                    <Route path="/reports/pre-nomina" element={<PreNomina />} />
                    <Route path="/reports/pre-colilla" element={<PreColilla />} />
                    <Route path="/vacation-approval" element={<VacationApproval />} />
                    <Route path="/historico" element={<Historico />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/employee-profile" element={<EmployeeProfile />} />
                    <Route path="/employee-vacations" element={<EmployeeVacations />} />
                    <Route path="/create-company" element={<CreateCompany />} />
                    <Route path="/email-center" element={<EmailCenter />} />
                    <Route path="/settings/parameters" element={<Parameters />} />
                    <Route path="/settings/admin" element={<div className="p-6 text-center text-muted-foreground">Administración - En desarrollo</div>} />
                    <Route path="/company-selector" element={<CompanySelector />} />
                  </Route>
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </CompanyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
