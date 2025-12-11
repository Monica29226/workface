import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Calculator, Percent, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CompanyParameters {
  id?: string;
  company_id: string;
  // CCSS Patronal
  ccss_patronal_sem: number;
  ccss_patronal_ivm: number;
  ccss_patronal_total: number;
  // CCSS Obrero
  ccss_obrero_sem: number;
  ccss_obrero_ivm: number;
  ccss_obrero_total: number;
  // Other contributions
  ina_rate: number;
  imas_rate: number;
  fodesaf_rate: number;
  banco_popular_patronal: number;
  banco_popular_obrero: number;
  ins_riesgos_trabajo: number;
  // Prestaciones
  aguinaldo_rate: number;
  cesantia_rate: number;
  vacaciones_rate: number;
  // Income tax brackets
  renta_bracket_1_limit: number;
  renta_bracket_1_rate: number;
  renta_bracket_2_limit: number;
  renta_bracket_2_rate: number;
  renta_bracket_3_limit: number;
  renta_bracket_3_rate: number;
  renta_bracket_4_limit: number;
  renta_bracket_4_rate: number;
  renta_bracket_5_rate: number;
  // Minimum wage
  salario_minimo_referencia: number;
  // Vacation settings
  vacation_days_standard: number;
  vacation_days_domestic: number;
  vacation_weeks_required: number;
  vacation_monthly_accrual: number;
  vacation_domestic_monthly_accrual: number;
  vacation_expiry_months: number;
}

const defaultParameters: Omit<CompanyParameters, 'company_id'> = {
  ccss_patronal_sem: 9.25,
  ccss_patronal_ivm: 5.25,
  ccss_patronal_total: 14.50,
  ccss_obrero_sem: 5.50,
  ccss_obrero_ivm: 4.00,
  ccss_obrero_total: 9.50,
  ina_rate: 1.50,
  imas_rate: 0.50,
  fodesaf_rate: 5.00,
  banco_popular_patronal: 0.25,
  banco_popular_obrero: 1.00,
  ins_riesgos_trabajo: 1.50,
  aguinaldo_rate: 8.33,
  cesantia_rate: 8.33,
  vacaciones_rate: 4.17,
  renta_bracket_1_limit: 941000,
  renta_bracket_1_rate: 0,
  renta_bracket_2_limit: 1381000,
  renta_bracket_2_rate: 10,
  renta_bracket_3_limit: 2423000,
  renta_bracket_3_rate: 15,
  renta_bracket_4_limit: 4845000,
  renta_bracket_4_rate: 20,
  renta_bracket_5_rate: 25,
  salario_minimo_referencia: 12236.95,
  vacation_days_standard: 10,
  vacation_days_domestic: 15,
  vacation_weeks_required: 50,
  vacation_monthly_accrual: 1,
  vacation_domestic_monthly_accrual: 1.25,
  vacation_expiry_months: 12,
};

export function Parameters() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [parameters, setParameters] = useState<CompanyParameters | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedCompany?.id) {
      loadParameters();
    }
  }, [selectedCompany?.id]);

  const loadParameters = async () => {
    if (!selectedCompany?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_parameters')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setParameters(data as CompanyParameters);
      } else {
        // Create default parameters for this company
        setParameters({
          ...defaultParameters,
          company_id: selectedCompany.id,
        });
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los parámetros",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCompany?.id || !parameters) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('company_parameters')
        .upsert({
          ...parameters,
          company_id: selectedCompany.id,
        }, {
          onConflict: 'company_id',
        });

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Los parámetros se han guardado correctamente",
      });
      loadParameters();
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los parámetros",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedCompany?.id) {
      setParameters({
        ...defaultParameters,
        company_id: selectedCompany.id,
      });
    }
  };

  const updateParameter = (key: keyof CompanyParameters, value: number) => {
    if (!parameters) return;
    setParameters({ ...parameters, [key]: value });
  };

  if (!selectedCompany) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Seleccione una empresa para ver los parámetros
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parámetros de Planilla</h1>
          <p className="text-muted-foreground">
            Configuración de tasas, impuestos y vacaciones para {selectedCompany.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Restablecer
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cargas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cargas">
            <Percent className="h-4 w-4 mr-2" />
            Cargas Sociales
          </TabsTrigger>
          <TabsTrigger value="renta">
            <Calculator className="h-4 w-4 mr-2" />
            Impuesto Renta
          </TabsTrigger>
          <TabsTrigger value="prestaciones">
            <DollarSign className="h-4 w-4 mr-2" />
            Prestaciones
          </TabsTrigger>
          <TabsTrigger value="vacaciones">
            <Calendar className="h-4 w-4 mr-2" />
            Vacaciones
          </TabsTrigger>
        </TabsList>

        {/* Cargas Sociales Tab */}
        <TabsContent value="cargas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CCSS Patronal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CCSS Patronal</CardTitle>
                <CardDescription>Aportes del empleador a la CCSS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SEM (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ccss_patronal_sem || 0}
                      onChange={(e) => updateParameter('ccss_patronal_sem', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>IVM (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ccss_patronal_ivm || 0}
                      onChange={(e) => updateParameter('ccss_patronal_ivm', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Total Patronal (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parameters?.ccss_patronal_total || 0}
                    onChange={(e) => updateParameter('ccss_patronal_total', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* CCSS Obrero */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CCSS Obrero</CardTitle>
                <CardDescription>Deducciones del trabajador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SEM (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ccss_obrero_sem || 0}
                      onChange={(e) => updateParameter('ccss_obrero_sem', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>IVM (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ccss_obrero_ivm || 0}
                      onChange={(e) => updateParameter('ccss_obrero_ivm', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Total Obrero (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parameters?.ccss_obrero_total || 0}
                    onChange={(e) => updateParameter('ccss_obrero_total', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Otras Cargas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Otras Cargas Patronales</CardTitle>
                <CardDescription>INA, IMAS, FODESAF y otros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>INA (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ina_rate || 0}
                      onChange={(e) => updateParameter('ina_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>IMAS (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.imas_rate || 0}
                      onChange={(e) => updateParameter('imas_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>FODESAF (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.fodesaf_rate || 0}
                      onChange={(e) => updateParameter('fodesaf_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>INS Riesgos (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.ins_riesgos_trabajo || 0}
                      onChange={(e) => updateParameter('ins_riesgos_trabajo', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Banco Popular */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Banco Popular</CardTitle>
                <CardDescription>Aportes obrero y patronal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Patronal (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.banco_popular_patronal || 0}
                      onChange={(e) => updateParameter('banco_popular_patronal', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Obrero (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.banco_popular_obrero || 0}
                      onChange={(e) => updateParameter('banco_popular_obrero', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Resumen de Cargas Sociales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {((parameters?.ccss_patronal_total || 0) + (parameters?.ina_rate || 0) + (parameters?.imas_rate || 0) + (parameters?.fodesaf_rate || 0) + (parameters?.banco_popular_patronal || 0) + (parameters?.ins_riesgos_trabajo || 0)).toFixed(2)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Total Patronal</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {((parameters?.ccss_obrero_total || 0) + (parameters?.banco_popular_obrero || 0)).toFixed(2)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Total Obrero</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(parameters?.salario_minimo_referencia || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Salario Mínimo/día</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency((parameters?.salario_minimo_referencia || 0) * 30)}
                  </p>
                  <p className="text-sm text-muted-foreground">Salario Mínimo/mes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impuesto Renta Tab */}
        <TabsContent value="renta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tabla de Impuesto sobre la Renta 2025</CardTitle>
              <CardDescription>
                Tramos de renta según Ministerio de Hacienda de Costa Rica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Bracket 1 */}
                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Tramo 1 - Hasta</Label>
                    <Input
                      type="number"
                      value={parameters?.renta_bracket_1_limit || 0}
                      onChange={(e) => updateParameter('renta_bracket_1_limit', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Tasa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.renta_bracket_1_rate || 0}
                      onChange={(e) => updateParameter('renta_bracket_1_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Exento
                  </div>
                </div>

                {/* Bracket 2 */}
                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Tramo 2 - Hasta</Label>
                    <Input
                      type="number"
                      value={parameters?.renta_bracket_2_limit || 0}
                      onChange={(e) => updateParameter('renta_bracket_2_limit', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Tasa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.renta_bracket_2_rate || 0}
                      onChange={(e) => updateParameter('renta_bracket_2_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Sobre exceso de {formatCurrency(parameters?.renta_bracket_1_limit || 0)}
                  </div>
                </div>

                {/* Bracket 3 */}
                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Tramo 3 - Hasta</Label>
                    <Input
                      type="number"
                      value={parameters?.renta_bracket_3_limit || 0}
                      onChange={(e) => updateParameter('renta_bracket_3_limit', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Tasa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.renta_bracket_3_rate || 0}
                      onChange={(e) => updateParameter('renta_bracket_3_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Sobre exceso de {formatCurrency(parameters?.renta_bracket_2_limit || 0)}
                  </div>
                </div>

                {/* Bracket 4 */}
                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label>Tramo 4 - Hasta</Label>
                    <Input
                      type="number"
                      value={parameters?.renta_bracket_4_limit || 0}
                      onChange={(e) => updateParameter('renta_bracket_4_limit', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Tasa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.renta_bracket_4_rate || 0}
                      onChange={(e) => updateParameter('renta_bracket_4_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Sobre exceso de {formatCurrency(parameters?.renta_bracket_3_limit || 0)}
                  </div>
                </div>

                {/* Bracket 5 */}
                <div className="grid grid-cols-3 gap-4 items-end p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div>
                    <Label>Tramo 5 - Exceso</Label>
                    <p className="mt-2 text-sm">Mayor a {formatCurrency(parameters?.renta_bracket_4_limit || 0)}</p>
                  </div>
                  <div>
                    <Label>Tasa (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters?.renta_bracket_5_rate || 0}
                      onChange={(e) => updateParameter('renta_bracket_5_rate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Tasa máxima
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salario Mínimo */}
          <Card>
            <CardHeader>
              <CardTitle>Salario Mínimo de Referencia</CardTitle>
              <CardDescription>
                Salario mínimo diario según MTSS (trabajador no calificado)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Salario Mínimo Diario (₡)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parameters?.salario_minimo_referencia || 0}
                    onChange={(e) => updateParameter('salario_minimo_referencia', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-end">
                  <div className="p-3 bg-muted rounded-lg w-full text-center">
                    <p className="text-sm text-muted-foreground">Mensual (30 días)</p>
                    <p className="text-xl font-bold">{formatCurrency((parameters?.salario_minimo_referencia || 0) * 30)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prestaciones Tab */}
        <TabsContent value="prestaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provisiones de Prestaciones Laborales</CardTitle>
              <CardDescription>
                Porcentajes para cálculo de provisiones según Código de Trabajo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border rounded-lg">
                  <Label>Aguinaldo (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-2"
                    value={parameters?.aguinaldo_rate || 0}
                    onChange={(e) => updateParameter('aguinaldo_rate', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    1/12 del salario = 8.33%
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label>Cesantía (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-2"
                    value={parameters?.cesantia_rate || 0}
                    onChange={(e) => updateParameter('cesantia_rate', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Provisión mensual
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label>Vacaciones (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-2"
                    value={parameters?.vacaciones_rate || 0}
                    onChange={(e) => updateParameter('vacaciones_rate', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    10 días / 240 días = 4.17%
                  </p>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Total Provisión Mensual</h4>
                <p className="text-3xl font-bold text-primary">
                  {((parameters?.aguinaldo_rate || 0) + (parameters?.cesantia_rate || 0) + (parameters?.vacaciones_rate || 0)).toFixed(2)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Del salario bruto mensual
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vacaciones Tab */}
        <TabsContent value="vacaciones" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Vacaciones Ordinarias</CardTitle>
                <CardDescription>Según Artículo 153 del Código de Trabajo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Días de vacaciones anuales</Label>
                  <Input
                    type="number"
                    value={parameters?.vacation_days_standard || 0}
                    onChange={(e) => updateParameter('vacation_days_standard', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    2 semanas = 10 días hábiles
                  </p>
                </div>
                <div>
                  <Label>Semanas laboradas requeridas</Label>
                  <Input
                    type="number"
                    value={parameters?.vacation_weeks_required || 0}
                    onChange={(e) => updateParameter('vacation_weeks_required', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    50 semanas de trabajo continuo
                  </p>
                </div>
                <div>
                  <Label>Acumulación mensual (días)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parameters?.vacation_monthly_accrual || 0}
                    onChange={(e) => updateParameter('vacation_monthly_accrual', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Para cálculo proporcional
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Servicio Doméstico</CardTitle>
                <CardDescription>Régimen especial según ley</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Días de vacaciones anuales</Label>
                  <Input
                    type="number"
                    value={parameters?.vacation_days_domestic || 0}
                    onChange={(e) => updateParameter('vacation_days_domestic', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    15 días para servicio doméstico
                  </p>
                </div>
                <div>
                  <Label>Acumulación mensual (días)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={parameters?.vacation_domestic_monthly_accrual || 0}
                    onChange={(e) => updateParameter('vacation_domestic_monthly_accrual', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    1.25 días por mes trabajado
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Control de Vencimiento</CardTitle>
                <CardDescription>Período máximo para disfrutar vacaciones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Meses para vencimiento</Label>
                    <Input
                      type="number"
                      value={parameters?.vacation_expiry_months || 0}
                      onChange={(e) => updateParameter('vacation_expiry_months', parseInt(e.target.value) || 0)}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Después de cumplir el año laboral
                    </p>
                  </div>
                  <div className="flex items-center justify-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="text-center">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        ⚠️ Importante
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Las vacaciones no disfrutadas dentro del período pueden generar obligaciones adicionales
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
