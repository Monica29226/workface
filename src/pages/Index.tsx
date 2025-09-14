import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { KPICards } from "@/components/dashboard/KPICards";
import { PayrollCharts } from "@/components/dashboard/PayrollCharts";
import { PayrollTable } from "@/components/dashboard/PayrollTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Filter, 
  Calendar, 
  Building, 
  Activity, 
  Users, 
  Download,
  FileText,
  Send,
  AlertTriangle
} from "lucide-react";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<"es" | "en">("es");

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const labels = {
    es: {
      title: "Dashboard de Planillas - Setiembre 2025",
      subtitle: "Sistema Multi-Compañía Costa Rica",
      filters: "Filtros Activos",
      company: "Horizonte Positivo",
      period: "Sep 2025",
      costCenter: "Todos los CC",
      activity: "Todas",
      employee: "Todos",
      workday: "Laboral + F.Semana",
      actions: "Acciones Rápidas",
      exportSummary: "Exportar Resumen",
      bankFile: "Archivo Bancario",
      viewPayslips: "Ver Colillas PDF",
      legalNotice: "Aviso Legal",
      legalText: "Cálculos basados en parámetros configurables para Costa Rica. Este sistema no sustituye asesoría legal profesional.",
      currentPeriod: "Período Actual",
      status: "Estado: Borrador",
      editablePeriod: "Período editable hasta aprobación"
    },
    en: {
      title: "Payroll Dashboard - September 2025", 
      subtitle: "Multi-Company Costa Rica System",
      filters: "Active Filters",
      company: "Horizonte Positivo",
      period: "Sep 2025",
      costCenter: "All CCs",
      activity: "All",
      employee: "All", 
      workday: "Regular + Weekend",
      actions: "Quick Actions",
      exportSummary: "Export Summary",
      bankFile: "Bank File",
      viewPayslips: "View PDF Payslips",
      legalNotice: "Legal Notice",
      legalText: "Calculations based on configurable parameters for Costa Rica. This system does not substitute professional legal advice.",
      currentPeriod: "Current Period",
      status: "Status: Draft",
      editablePeriod: "Editable period until approval"
    }
  };

  const t = labels[language];

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={toggleSidebar} />
      
      <div className="flex">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={toggleSidebar}
          language={language}
        />
        
        <main className="flex-1 p-6 space-y-6">
          {/* Header Section */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gradient mb-2">
                  {t.title}
                </h1>
                <p className="text-muted-foreground">{t.subtitle}</p>
              </div>
              
              {/* Period Status */}
              <Card className="border-2 border-orange-200 bg-orange-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="font-semibold text-orange-800">{t.currentPeriod}</div>
                      <div className="text-sm text-orange-600">{t.status}</div>
                      <div className="text-xs text-orange-500">{t.editablePeriod}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Active Filters */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                {t.filters}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Building className="h-3 w-3" />
                  {t.company}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  {t.period}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Building className="h-3 w-3" />
                  {t.costCenter}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Activity className="h-3 w-3" />
                  {t.activity}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {t.employee}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  {t.workday}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <KPICards language={language} />

          {/* Quick Actions */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                {t.actions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button className="gap-2 gradient-navy">
                  <FileText className="h-4 w-4" />
                  {t.exportSummary}
                </Button>
                <Button variant="secondary" className="gap-2">
                  <Download className="h-4 w-4" />
                  {t.bankFile}
                </Button>
                <Button variant="outline" className="gap-2">
                  <Send className="h-4 w-4" />
                  {t.viewPayslips}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <PayrollCharts language={language} />

          {/* Employee Detail Table */}
          <PayrollTable language={language} />

          {/* Legal Notice */}
          <Card className="border-muted bg-muted/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium text-sm mb-1">{t.legalNotice}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.legalText}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Index;
