import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Save, Upload, TestTube, History, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, isCoT, formatCurrencyCostaRica } from "@/lib/utils";
import { useCoTAccess } from "@/hooks/useCoTAccess";

interface CompanyParameters {
  id?: string;
  company_id: string;
  anio: number;
  moneda_default: string;
  formato_decimal: number;
  tipo_cambio: Array<{periodo: string; tc: number}>;
  vacaciones: {dias_por_mes: number};
  aguinaldo: {desde: string; hasta: string};
  renta: {
    tramos: Array<{hasta?: number; sobre?: number; tasa: number}>;
    deducciones: {conyuge: number; hijo: number};
  };
  ccss: {empleado: number; patrono: number};
  recargos: {hora_extra: number; nocturnidad: number; feriado: number};
  weekend_rates: {saturday_mult: number; sunday_mult: number};
  workweek: string;
  feriados: Array<{fecha: string; nombre: string; doble: boolean}>;
  cesantia_matriz: Array<{
    anos_desde: number;
    anos_hasta: number;
    dias_preaviso: number;
    dias_cesantia: number;
    tope_cesantia?: number;
  }>;
  centros_costo: Array<{id: string; codigo: string; nombre: string; activo: boolean}>;
  proyectos: Array<{id: string; codigo: string; nombre: string; activo: boolean}>;
  email_config: {
    mode: string;
    from?: string;
    reply_to?: string;
    smtp?: {host: string; port: number; user: string; pass: string};
    api?: {key: string; provider: string};
    batch: {size: number; delay_ms: number};
  };
  pie_legal_pdf?: string;
  version: number;
  publicado: boolean;
  publicado_at?: string;
  publicado_por?: string;
  // New coT-specific fields
  ins_rt?: {
    rate: number;
    base_method: string;
  };
  cuentas_contables?: {
    sueldos: string;
    cargas_patronales: string;
    nomina_por_pagar: string;
    ccss_retenciones: string;
    ccss_patronal_por_pagar: string;
    ins_rt: string;
    puente?: string;
  };
}

export function Parameters() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { isCoTCompany, canEdit, shouldShowReadOnly } = useCoTAccess();
  const [parameters, setParameters] = useState<CompanyParameters | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Generate available years (current -2 to current +2)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({length: 5}, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (selectedCompany?.id) {
      loadParameters();
    }
  }, [selectedCompany?.id, selectedYear]);

  const loadParameters = async () => {
    if (!selectedCompany?.id) return;
    
    // Security guard: Only allow coT to load parameters for coT company
    if (!isCoT(selectedCompany)) {
      toast({
        title: "Acceso restringido",
        description: "Esta funcionalidad está disponible solo para Alturas de Tenorio",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_parameters')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('anio', selectedYear)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Parse JSONB fields
        const parsedData = {
          ...data,
          tipo_cambio: Array.isArray(data.tipo_cambio) ? data.tipo_cambio : JSON.parse(data.tipo_cambio as string || '[]'),
          vacaciones: typeof data.vacaciones === 'object' ? data.vacaciones : JSON.parse(data.vacaciones as string || '{"dias_por_mes": 1.25}'),
          aguinaldo: typeof data.aguinaldo === 'object' ? data.aguinaldo : JSON.parse(data.aguinaldo as string || '{"desde": "12-01", "hasta": "11-30"}'),
          renta: typeof data.renta === 'object' ? data.renta : JSON.parse(data.renta as string || '{"tramos": [], "deducciones": {"conyuge": 25000, "hijo": 25000}}'),
          ccss: typeof data.ccss === 'object' ? data.ccss : JSON.parse(data.ccss as string || '{"empleado": 0.10, "patrono": 0.26}'),
          recargos: typeof data.recargos === 'object' ? data.recargos : JSON.parse(data.recargos as string || '{"hora_extra": 1.50, "nocturnidad": 1.25, "feriado": 2.00}'),
          weekend_rates: typeof data.weekend_rates === 'object' ? data.weekend_rates : JSON.parse(data.weekend_rates as string || '{"saturday_mult": 1.00, "sunday_mult": 1.50}'),
          feriados: Array.isArray(data.feriados) ? data.feriados : JSON.parse(data.feriados as string || '[]'),
          cesantia_matriz: Array.isArray(data.cesantia_matriz) ? data.cesantia_matriz : JSON.parse(data.cesantia_matriz as string || '[]'),
          centros_costo: Array.isArray(data.centros_costo) ? data.centros_costo : JSON.parse(data.centros_costo as string || '[]'),
          proyectos: Array.isArray(data.proyectos) ? data.proyectos : JSON.parse(data.proyectos as string || '[]'),
          email_config: typeof data.email_config === 'object' ? data.email_config : JSON.parse(data.email_config as string || '{"mode": "smtp", "batch": {"size": 50, "delay_ms": 1000}}'),
          ins_rt: (data as any).ins_rt || { rate: 0.005, base_method: "devengado_proporcional" },
          cuentas_contables: (data as any).cuentas_contables || {
            sueldos: "511",
            cargas_patronales: "512",
            nomina_por_pagar: "212",
            ccss_retenciones: "214",
            ccss_patronal_por_pagar: "213",
            ins_rt: "516"
          }
        } as CompanyParameters;
        setParameters(parsedData);
      } else {
        // Create default parameters for the year
        const defaultParams: CompanyParameters = {
          company_id: selectedCompany.id,
          anio: selectedYear,
          moneda_default: 'CRC',
          formato_decimal: 2,
          tipo_cambio: generateDefaultExchangeRates(selectedYear),
          vacaciones: { dias_por_mes: 1.25 },
          aguinaldo: { desde: '12-01', hasta: '11-30' },
          renta: {
            tramos: [
              { hasta: 941000, tasa: 0 },
              { hasta: 1381000, tasa: 0.10 },
              { hasta: 2423000, tasa: 0.15 },
              { hasta: 4845000, tasa: 0.20 },
              { sobre: 4845000, tasa: 0.25 }
            ],
            deducciones: { conyuge: 25000, hijo: 25000 }
          },
          ccss: { empleado: 0.10, patrono: 0.26 },
          recargos: { hora_extra: 1.50, nocturnidad: 1.25, feriado: 2.00 },
          weekend_rates: { saturday_mult: 1.00, sunday_mult: 1.50 },
          workweek: 'Mon-Fri',
          feriados: [],
          cesantia_matriz: [
            { anos_desde: 0, anos_hasta: 3, dias_preaviso: 0, dias_cesantia: 0 },
            { anos_desde: 3, anos_hasta: 6, dias_preaviso: 7, dias_cesantia: 7 },
            { anos_desde: 6, anos_hasta: 12, dias_preaviso: 14, dias_cesantia: 14 },
            { anos_desde: 12, anos_hasta: 999, dias_preaviso: 30, dias_cesantia: 21.5, tope_cesantia: 8 }
          ],
          centros_costo: [],
          proyectos: [],
          email_config: {
            mode: 'smtp',
            batch: { size: 50, delay_ms: 1000 }
          },
          ins_rt: { rate: 0.005, base_method: "devengado_proporcional" },
          cuentas_contables: {
            sueldos: "511",
            cargas_patronales: "512", 
            nomina_por_pagar: "212",
            ccss_retenciones: "214",
            ccss_patronal_por_pagar: "213",
            ins_rt: "516"
          },
          version: 1,
          publicado: false
        };
        setParameters(defaultParams);
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los parámetros",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultExchangeRates = (year: number) => {
    return Array.from({length: 12}, (_, i) => ({
      periodo: `${year}-${String(i + 1).padStart(2, '0')}`,
      tc: 510.27
    }));
  };

  const handleSave = async () => {
    if (!parameters || !selectedCompany?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_parameters')
        .upsert(parameters, { onConflict: 'company_id,anio' });

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Parámetros guardados como borrador",
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los parámetros",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!parameters || !selectedCompany?.id) return;

    setLoading(true);
    try {
      const updatedParams = {
        ...parameters,
        publicado: true,
        publicado_at: new Date().toISOString(),
        version: parameters.version + 1
      };

      const { error } = await supabase
        .from('company_parameters')
        .upsert(updatedParams, { onConflict: 'company_id,anio' });

      if (error) throw error;

      setParameters(updatedParams);
      toast({
        title: "Publicado",
        description: "Los parámetros están ahora activos para cálculos",
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error publishing parameters:', error);
      toast({
        title: "Error",
        description: "No se pudieron publicar los parámetros",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!parameters?.email_config) return;

    // Here you would implement the actual email test
    toast({
      title: "Prueba de correo",
      description: "Funcionalidad de prueba de correo pendiente de implementación",
    });
  };

  const updateParameters = (path: string, value: any) => {
    if (!parameters) return;
    
    const keys = path.split('.');
    const updated = { ...parameters };
    let current: any = updated;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setParameters(updated);
    setHasChanges(true);
  };

  if (loading && !parameters) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Parámetros</h1>
            <p className="text-muted-foreground">Configuración de parámetros por compañía y año</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Cargando parámetros...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!parameters) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parámetros</h1>
          <p className="text-muted-foreground">Configuración de parámetros por compañía y año</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {parameters.publicado && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              Publicado v{parameters.version}
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="secondary">
              Cambios pendientes
            </Badge>
          )}
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Tienes cambios sin guardar. Guarda como borrador o publica para activar.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          Guardar
        </Button>
        <Button onClick={handlePublish} disabled={loading} variant="default">
          <Upload className="h-4 w-4 mr-2" />
          Publicar
        </Button>
        <Button variant="outline" disabled={loading}>
          <TestTube className="h-4 w-4 mr-2" />
          Probar Cálculo
        </Button>
        <Button variant="outline" disabled={loading}>
          <History className="h-4 w-4 mr-2" />
          Historial
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={["general", "nomina"]} className="space-y-4">
        <AccordionItem value="general">
          <AccordionTrigger className="text-lg font-semibold">A) Generales</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="moneda">Moneda por defecto</Label>
                    <Select value={parameters.moneda_default} onValueChange={(value) => updateParameters('moneda_default', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CRC">CRC - Colones</SelectItem>
                        <SelectItem value="USD">USD - Dólares</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="formato">Formato decimal</Label>
                    <Input 
                      id="formato"
                      type="number"
                      value={parameters.formato_decimal}
                      onChange={(e) => updateParameters('formato_decimal', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Tipo de cambio por período</Label>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead>Tipo de Cambio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parameters.tipo_cambio.map((tc, index) => (
                          <TableRow key={tc.periodo}>
                            <TableCell>{tc.periodo}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={tc.tc}
                                onChange={(e) => {
                                  const newRates = [...parameters.tipo_cambio];
                                  newRates[index] = { ...tc, tc: parseFloat(e.target.value) };
                                  updateParameters('tipo_cambio', newRates);
                                }}
                                className="w-32"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <Label htmlFor="pie-legal">Pie legal PDF</Label>
                  <Textarea
                    id="pie-legal"
                    value={parameters.pie_legal_pdf || ''}
                    onChange={(e) => updateParameters('pie_legal_pdf', e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="nomina">
          <AccordionTrigger className="text-lg font-semibold">B) Nómina Costa Rica</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vacaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="vacaciones-dias">Días por mes</Label>
                    <Input
                      id="vacaciones-dias"
                      type="number"
                      step="0.01"
                      value={parameters.vacaciones.dias_por_mes}
                      onChange={(e) => updateParameters('vacaciones.dias_por_mes', parseFloat(e.target.value))}
                      className="w-32"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Renta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tramos de renta anual</Label>
                    <Table className="mt-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hasta / Sobre</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Tasa (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parameters.renta.tramos.map((tramo, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {tramo.hasta ? 'Hasta' : 'Sobre'}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={tramo.hasta || tramo.sobre}
                                onChange={(e) => {
                                  const newTramos = [...parameters.renta.tramos];
                                  const value = parseFloat(e.target.value);
                                  if (tramo.hasta) {
                                    newTramos[index] = { ...tramo, hasta: value };
                                  } else {
                                    newTramos[index] = { ...tramo, sobre: value };
                                  }
                                  updateParameters('renta.tramos', newTramos);
                                }}
                                className="w-32"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={tramo.tasa * 100}
                                onChange={(e) => {
                                  const newTramos = [...parameters.renta.tramos];
                                  newTramos[index] = { ...tramo, tasa: parseFloat(e.target.value) / 100 };
                                  updateParameters('renta.tramos', newTramos);
                                }}
                                className="w-24"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Deducción cónyuge</Label>
                      <Input
                        type="number"
                        value={parameters.renta.deducciones.conyuge}
                        onChange={(e) => updateParameters('renta.deducciones.conyuge', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Deducción por hijo</Label>
                      <Input
                        type="number"
                        value={parameters.renta.deducciones.hijo}
                        onChange={(e) => updateParameters('renta.deducciones.hijo', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>CCSS</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tasa empleado (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={parameters.ccss.empleado * 100}
                        onChange={(e) => updateParameters('ccss.empleado', parseFloat(e.target.value) / 100)}
                      />
                    </div>
                    <div>
                      <Label>Tasa patrono (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={parameters.ccss.patrono * 100}
                        onChange={(e) => updateParameters('ccss.patrono', parseFloat(e.target.value) / 100)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="jornada">
          <AccordionTrigger className="text-lg font-semibold">C) Jornada y Recargos</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Semana laboral</Label>
                  <Select value={parameters.workweek} onValueChange={(value) => updateParameters('workweek', value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mon-Fri">Lunes - Viernes</SelectItem>
                      <SelectItem value="Mon-Sat">Lunes - Sábado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Hora extra</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters.recargos.hora_extra}
                      onChange={(e) => updateParameters('recargos.hora_extra', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Nocturnidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters.recargos.nocturnidad}
                      onChange={(e) => updateParameters('recargos.nocturnidad', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Feriado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters.recargos.feriado}
                      onChange={(e) => updateParameters('recargos.feriado', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Multiplicador sábado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters.weekend_rates.saturday_mult}
                      onChange={(e) => updateParameters('weekend_rates.saturday_mult', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Multiplicador domingo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={parameters.weekend_rates.sunday_mult}
                      onChange={(e) => updateParameters('weekend_rates.sunday_mult', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="correos">
          <AccordionTrigger className="text-lg font-semibold">E) Correos (SMTP/API)</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Modo de envío</Label>
                  <Select value={parameters.email_config.mode} onValueChange={(value) => updateParameters('email_config.mode', value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP</SelectItem>
                      <SelectItem value="api">API (SendGrid/Mailgun)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Remitente</Label>
                    <Input
                      value={parameters.email_config.from || ''}
                      onChange={(e) => updateParameters('email_config.from', e.target.value)}
                      placeholder="noreply@empresa.com"
                    />
                  </div>
                  <div>
                    <Label>Reply-to</Label>
                    <Input
                      value={parameters.email_config.reply_to || ''}
                      onChange={(e) => updateParameters('email_config.reply_to', e.target.value)}
                      placeholder="soporte@empresa.com"
                    />
                  </div>
                </div>

                {parameters.email_config.mode === 'smtp' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <Label>Host SMTP</Label>
                      <Input
                        value={parameters.email_config.smtp?.host || ''}
                        onChange={(e) => updateParameters('email_config.smtp.host', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Puerto</Label>
                      <Input
                        type="number"
                        value={parameters.email_config.smtp?.port || 587}
                        onChange={(e) => updateParameters('email_config.smtp.port', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Button onClick={handleTestEmail} className="mt-6">
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar Prueba
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tamaño de lote</Label>
                    <Input
                      type="number"
                      value={parameters.email_config.batch.size}
                      onChange={(e) => updateParameters('email_config.batch.size', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Delay entre lotes (ms)</Label>
                    <Input
                      type="number"
                      value={parameters.email_config.batch.delay_ms}
                      onChange={(e) => updateParameters('email_config.batch.delay_ms', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}