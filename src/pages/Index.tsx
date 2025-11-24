import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Plus, 
  Users, 
  FileText, 
  Clock, 
  TrendingUp,
  Calendar,
  DollarSign,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { companies, selectedCompany, setSelectedCompany } = useCompany();
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);

  useEffect(() => {
    // If already has a selected company, redirect to dashboard
    if (selectedCompany) {
      navigate('/dashboard');
    }
  }, [selectedCompany, navigate]);

  const handleSelectCompany = (company: any) => {
    setSelectedCompany(company);
    navigate('/dashboard');
  };

  const handleAddCompany = () => {
    // TODO: Implement add company modal/page
    console.log("Add new company");
  };

  // Mock stats for display
  const stats = [
    { icon: Users, label: "Empleados Activos", value: "24", color: "text-blue-600" },
    { icon: FileText, label: "Planillas Pendientes", value: "2", color: "text-orange-600" },
    { icon: Clock, label: "Horas Registradas", value: "168", color: "text-green-600" },
    { icon: TrendingUp, label: "Proyectos Activos", value: "5", color: "text-purple-600" },
  ];

  const quickActions = [
    { icon: Calendar, label: "Procesar Planilla", description: "Iniciar nuevo proceso de nómina" },
    { icon: Users, label: "Gestionar Empleados", description: "Ver y administrar empleados" },
    { icon: FileText, label: "Ver Reportes", description: "Reportes y análisis financieros" },
    { icon: DollarSign, label: "Liquidaciones", description: "Calcular liquidaciones laborales" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-primary/5">
      <div className="flex h-screen">
        {/* Left Sidebar - Company List */}
        <div className="w-80 bg-card border-r border-border shadow-lg flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Mis Empresas</h2>
                <p className="text-sm text-muted-foreground">{companies.length} empresa{companies.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Button 
              onClick={handleAddCompany}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Empresa
            </Button>
          </div>

          {/* Company List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectCompany(company)}
                onMouseEnter={() => setHoveredCompany(company.id)}
                onMouseLeave={() => setHoveredCompany(null)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
                  "hover:shadow-lg hover:scale-[1.02]",
                  selectedCompany?.id === company.id
                    ? "bg-primary/10 border-primary shadow-md"
                    : "bg-card border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    selectedCompany?.id === company.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                      {selectedCompany?.id === company.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{company.juridical_id}</p>
                    {hoveredCompany === company.id && (
                      <div className="mt-2 flex items-center text-xs text-primary font-medium">
                        Seleccionar <ChevronRight className="h-3 w-3 ml-1" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl mx-auto">
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                Bienvenido a ACL Payroll CR
              </h1>
              <p className="text-lg text-muted-foreground">
                Selecciona una empresa de la lista para comenzar o crea una nueva
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                        <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      </div>
                      <div className={cn("p-3 rounded-xl bg-muted", stat.color)}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">Accesos Rápidos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quickActions.map((action, index) => (
                  <Card 
                    key={index} 
                    className="hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group border-2 hover:border-primary/50"
                  >
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <action.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg mb-1">{action.label}</CardTitle>
                          <CardDescription>{action.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {/* Info Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Sistema Multi-Empresa</h3>
                    <p className="text-muted-foreground mb-4">
                      Gestiona múltiples empresas desde una sola cuenta. Cada empresa tiene su propia configuración,
                      empleados, planillas y reportes. Cambia fácilmente entre empresas desde el panel lateral.
                    </p>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-foreground">Multi-moneda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-foreground">Cálculos MTSS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-foreground">Reportes automáticos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;