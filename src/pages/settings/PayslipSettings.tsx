import { useState, useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Upload, FileText, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PayslipSettings {
  id?: string;
  company_id: string;
  // Branding
  show_company_logo: boolean;
  show_platform_branding: boolean;
  // Sections
  show_hours_section: boolean;
  show_earnings_section: boolean;
  show_deductions_section: boolean;
  show_accruals_section: boolean;
  show_usd_banner: boolean;
  // Fields
  show_hire_date: boolean;
  show_cost_center: boolean;
  show_overtime_hours: boolean;
  show_absence_days: boolean;
  show_vacation_days: boolean;
  show_bonuses: boolean;
  show_loans: boolean;
  show_aguinaldo_accrued: boolean;
  show_vacation_accrued: boolean;
  // Texts
  document_title: string;
  employee_label: string;
  net_pay_label: string;
  footer_text: string | null;
}

const defaultSettings: Omit<PayslipSettings, 'company_id'> = {
  show_company_logo: true,
  show_platform_branding: true,
  show_hours_section: true,
  show_earnings_section: true,
  show_deductions_section: true,
  show_accruals_section: true,
  show_usd_banner: true,
  show_hire_date: true,
  show_cost_center: true,
  show_overtime_hours: true,
  show_absence_days: true,
  show_vacation_days: true,
  show_bonuses: true,
  show_loans: true,
  show_aguinaldo_accrued: true,
  show_vacation_accrued: true,
  document_title: 'Comprobante de Pago',
  employee_label: 'Colaborador',
  net_pay_label: 'Total a Depositar',
  footer_text: null,
};

export function PayslipSettings() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<PayslipSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch existing settings
  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ["payslipSettings", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;

      const { data, error } = await (supabase as any)
        .from("payslip_settings")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .maybeSingle();

      if (error) throw error;
      return data as PayslipSettings | null;
    },
    enabled: !!selectedCompany?.id,
  });

  // Fetch company logo
  const { data: company } = useQuery({
    queryKey: ["companyLogo", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("logo_url, display_name")
        .eq("id", selectedCompany.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Initialize settings
  useEffect(() => {
    if (existingSettings) {
      setSettings(existingSettings);
    } else if (selectedCompany?.id) {
      setSettings({ ...defaultSettings, company_id: selectedCompany.id });
    }
  }, [existingSettings, selectedCompany?.id]);

  useEffect(() => {
    if (company?.logo_url) {
      setLogoPreview(company.logo_url);
    }
  }, [company?.logo_url]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PayslipSettings) => {
      if (!selectedCompany?.id) throw new Error("No company selected");

      if (data.id) {
        // Update existing
        const { error } = await (supabase as any)
          .from("payslip_settings")
          .update(data)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase as any)
          .from("payslip_settings")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslipSettings"] });
      toast({
        title: "Configuración guardada",
        description: "Los ajustes de colillas se han guardado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile || !selectedCompany?.id) return;

    setIsUploadingLogo(true);
    try {
      // Create a unique file name
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${selectedCompany.id}/logo.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, save as base64 URL (fallback)
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const { error: updateError } = await supabase
            .from("companies")
            .update({ logo_url: base64 })
            .eq("id", selectedCompany.id);

          if (updateError) throw updateError;
          
          setLogoPreview(base64);
          queryClient.invalidateQueries({ queryKey: ["companyLogo"] });
          toast({
            title: "Logo actualizado",
            description: "El logo de la empresa se ha guardado correctamente",
          });
        };
        reader.readAsDataURL(logoFile);
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(fileName);

        // Update company logo_url
        const { error: updateError } = await supabase
          .from("companies")
          .update({ logo_url: publicUrl })
          .eq("id", selectedCompany.id);

        if (updateError) throw updateError;

        setLogoPreview(publicUrl);
        queryClient.invalidateQueries({ queryKey: ["companyLogo"] });
        toast({
          title: "Logo actualizado",
          description: "El logo de la empresa se ha guardado correctamente",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const updateSetting = <K extends keyof PayslipSettings>(key: K, value: PayslipSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Seleccione una empresa</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración de Colillas</h1>
          <p className="text-muted-foreground">
            Personalice el contenido y diseño de los comprobantes de pago
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Cambios
        </Button>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">Logo y Marca</TabsTrigger>
          <TabsTrigger value="sections">Secciones</TabsTrigger>
          <TabsTrigger value="fields">Campos</TabsTrigger>
          <TabsTrigger value="texts">Textos</TabsTrigger>
        </TabsList>

        {/* BRANDING TAB */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Logo de la Empresa
              </CardTitle>
              <CardDescription>
                Suba el logo que aparecerá en las colillas de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="logo-upload">Seleccionar archivo</Label>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos: PNG, JPG, SVG. Tamaño máximo: 2MB
                    </p>
                  </div>
                  {logoFile && (
                    <Button
                      onClick={handleLogoUpload}
                      disabled={isUploadingLogo}
                      size="sm"
                      className="gap-2"
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Subir Logo
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar logo en colilla</Label>
                    <p className="text-sm text-muted-foreground">
                      El logo aparecerá en el encabezado del PDF
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_company_logo}
                    onCheckedChange={(v) => updateSetting('show_company_logo', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar marca "ACL Workforce HUB"</Label>
                    <p className="text-sm text-muted-foreground">
                      Incluir el nombre de la plataforma en el encabezado
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_platform_branding}
                    onCheckedChange={(v) => updateSetting('show_platform_branding', v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTIONS TAB */}
        <TabsContent value="sections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Secciones del Documento
              </CardTitle>
              <CardDescription>
                Elija qué secciones mostrar en la colilla
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'show_hours_section', label: 'Horas Trabajadas', desc: 'Muestra ordinarias, extra, vacaciones y ausencias' },
                { key: 'show_earnings_section', label: 'Ingresos', desc: 'Salario base, bonificaciones y horas extra' },
                { key: 'show_deductions_section', label: 'Deducciones', desc: 'CCSS, ISR, préstamos y otras deducciones' },
                { key: 'show_accruals_section', label: 'Provisiones', desc: 'Vacaciones y aguinaldo acumulado' },
                { key: 'show_usd_banner', label: 'Banner de Salario en USD', desc: 'Para empleados con salario dolarizado' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <Label>{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings[item.key as keyof PayslipSettings] as boolean}
                    onCheckedChange={(v) => updateSetting(item.key as keyof PayslipSettings, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FIELDS TAB */}
        <TabsContent value="fields" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Campos Visibles
              </CardTitle>
              <CardDescription>
                Seleccione qué campos individuales mostrar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'show_hire_date', label: 'Fecha de Ingreso' },
                  { key: 'show_cost_center', label: 'Centro de Costo' },
                  { key: 'show_overtime_hours', label: 'Horas Extra' },
                  { key: 'show_absence_days', label: 'Días de Ausencia' },
                  { key: 'show_vacation_days', label: 'Días de Vacaciones' },
                  { key: 'show_bonuses', label: 'Bonificaciones' },
                  { key: 'show_loans', label: 'Préstamos' },
                  { key: 'show_aguinaldo_accrued', label: 'Aguinaldo Acumulado' },
                  { key: 'show_vacation_accrued', label: 'Vacaciones Acumuladas' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                    <Label className="cursor-pointer">{item.label}</Label>
                    <Switch
                      checked={settings[item.key as keyof PayslipSettings] as boolean}
                      onCheckedChange={(v) => updateSetting(item.key as keyof PayslipSettings, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTS TAB */}
        <TabsContent value="texts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Textos Personalizados</CardTitle>
              <CardDescription>
                Modifique los textos que aparecen en la colilla
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="document_title">Título del Documento</Label>
                  <Input
                    id="document_title"
                    value={settings.document_title}
                    onChange={(e) => updateSetting('document_title', e.target.value)}
                    placeholder="Comprobante de Pago"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_label">Etiqueta de Empleado</Label>
                  <Input
                    id="employee_label"
                    value={settings.employee_label}
                    onChange={(e) => updateSetting('employee_label', e.target.value)}
                    placeholder="Colaborador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="net_pay_label">Etiqueta de Neto a Pagar</Label>
                  <Input
                    id="net_pay_label"
                    value={settings.net_pay_label}
                    onChange={(e) => updateSetting('net_pay_label', e.target.value)}
                    placeholder="Total a Depositar"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="footer_text">Texto de Pie de Página</Label>
                <Textarea
                  id="footer_text"
                  value={settings.footer_text || ''}
                  onChange={(e) => updateSetting('footer_text', e.target.value || null)}
                  placeholder="Texto opcional que aparecerá al final del documento..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Puede incluir información adicional o notas legales.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
