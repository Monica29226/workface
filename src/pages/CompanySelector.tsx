import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useLanguage } from "@/contexts/LanguageContext";

const CompanySelector = () => {
  const navigate = useNavigate();
  const { companies, setSelectedCompany } = useCompany();
  const { language, setLanguage, t } = useLanguage();

  const companyDisplayData = companies.map(company => ({
    ...company,
    logo: "🏢",
    color: "from-primary to-accent",
  }));


  const handleCompanySelect = (company: any) => {
    setSelectedCompany(company);
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
            <h1 className="text-4xl font-bold text-gradient">{t('companySelector.title')}</h1>
          </div>
          <p className="text-xl text-muted-foreground">{t('companySelector.subtitle')}</p>
          
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "es" ? "en" : "es")}
            className="mt-4"
          >
            {language === "es" ? "English" : "Español"}
          </Button>
        </div>

        {/* Company Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {companyDisplayData.map((company) => (
            <Card
              key={company.id}
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 hover:scale-105"
              onClick={() => handleCompanySelect(company)}
            >
              <CardHeader className="text-center pb-4">
                <div className={`inline-flex p-6 rounded-2xl bg-gradient-to-br ${company.color} text-white text-4xl mb-4 mx-auto`}>
                  {company.logo}
                </div>
                <CardTitle className="text-2xl mb-2">{company.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{company.juridical_id}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Cédula: {company.juridical_id}</span>
                  </div>
                </div>
                
                <Button className="w-full group-hover:bg-primary/90 transition-colors gap-2">
                  {t('companySelector.enter')}
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