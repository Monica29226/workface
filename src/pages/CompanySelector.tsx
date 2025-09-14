import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, ArrowRight } from "lucide-react";

const CompanySelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<"es" | "en">("es");
  const navigate = useNavigate();

  const companies = [
    {
      id: "horizonte-positivo",
      name: "Asociación Horizonte Positivo",
      cedula: "3-002-674691",
      address: "San José, Costa Rica",
      phone: "+506 2000-0000",
      email: "info@horizontepositivo.org",
      logo: "🌅",
      color: "from-primary to-accent",
      description: selectedLanguage === "es" ? "Organización sin fines de lucro" : "Non-profit organization"
    },
    {
      id: "alturas-tenorio",
      name: "Alturas de Tenorio S.A.",
      cedula: "3-101-372032", 
      address: "Bijagua de Upala, Costa Rica",
      phone: "+506 2100-0000",
      email: "info@alturasdetenorio.com",
      logo: "🏔️",
      color: "from-accent to-teal",
      description: selectedLanguage === "es" ? "Empresa turística y agrícola" : "Tourism and agricultural company"
    }
  ];

  const labels = {
    es: {
      title: "Sistema de Planillas Costa Rica",
      subtitle: "Seleccione su compañía para continuar",
      enter: "Ingresar",
      switchLang: "English"
    },
    en: {
      title: "Costa Rica Payroll System", 
      subtitle: "Select your company to continue",
      enter: "Enter",
      switchLang: "Español"
    }
  };

  const t = labels[selectedLanguage];

  const handleCompanySelect = (companyId: string) => {
    // Store selected company in localStorage
    localStorage.setItem('selectedCompany', companyId);
    localStorage.setItem('selectedLanguage', selectedLanguage);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-gradient">{t.title}</h1>
          </div>
          <p className="text-xl text-muted-foreground">{t.subtitle}</p>
          
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLanguage(selectedLanguage === "es" ? "en" : "es")}
            className="mt-4"
          >
            {t.switchLang}
          </Button>
        </div>

        {/* Company Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 hover:scale-105"
              onClick={() => handleCompanySelect(company.id)}
            >
              <CardHeader className="text-center pb-4">
                <div className={`inline-flex p-6 rounded-2xl bg-gradient-to-br ${company.color} text-white text-4xl mb-4 mx-auto`}>
                  {company.logo}
                </div>
                <CardTitle className="text-2xl mb-2">{company.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{company.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Cédula: {company.cedula}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{company.address}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{company.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{company.email}</span>
                  </div>
                </div>
                
                <Button className="w-full group-hover:bg-primary/90 transition-colors gap-2">
                  {t.enter}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>© 2025 Sistema de Planillas Costa Rica</p>
          <p className="mt-1">Cálculos basados en parámetros configurables - No sustituye asesoría legal</p>
        </div>
      </div>
    </div>
  );
};

export default CompanySelector;