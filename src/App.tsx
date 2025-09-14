import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Employees } from "@/pages/Employees";
import { Contracts } from "@/pages/Contracts";
import { Timesheets } from "@/pages/Timesheets";
import { PayrollProcess } from "@/pages/PayrollProcess";
import { Payslips } from "@/pages/Payslips";
import CompanySelector from "./pages/CompanySelector";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Parameters } from "./pages/settings/Parameters";
import { Admin } from "./pages/settings/Admin";
import { Historico } from "./pages/settings/Historico";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CompanySelector />} />
          <Route path="/index" element={<Index />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/timesheets" element={<Timesheets />} />
            <Route path="/payroll-process" element={<PayrollProcess />} />
            <Route path="/payslips" element={<Payslips />} />
            <Route path="/cost-centers" element={<div className="p-6 text-center text-muted-foreground">Centros de Costo - En desarrollo</div>} />
            <Route path="/liquidations" element={<div className="p-6 text-center text-muted-foreground">Liquidaciones - En desarrollo</div>} />
            <Route path="/reports" element={<div className="p-6 text-center text-muted-foreground">Reportes - En desarrollo</div>} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/email-center" element={<div className="p-6 text-center text-muted-foreground">Centro de Correos - En desarrollo</div>} />
            <Route path="/settings/parameters" element={<Parameters />} />
            <Route path="/settings/admin" element={<Admin />} />
          </Route>
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
