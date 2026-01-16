import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Building2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

const steps = [
  { id: 1, title: "Información Básica" },
  { id: 2, title: "IDs Legales y Nómina" },
  { id: 3, title: "Configuración de Moneda" },
  { id: 4, title: "Bancos y Contabilidad" },
  { id: 5, title: "Centros de Costo" },
  { id: 6, title: "Plantillas de Email" },
  { id: 7, title: "Resumen y Confirmación" },
];

const step1Schema = z.object({
  display_name: z.string().min(1, "El nombre es requerido"),
  tax_id: z.string().min(1, "La cédula jurídica es requerida"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

const step2Schema = z.object({
  ccss_number: z.string().optional(),
  ins_policy: z.string().optional(),
  payroll_frequency: z.enum(["semanal", "quincenal", "mensual"]),
  work_hours_type: z.string().optional(),
  vacation_days_per_year: z.string().optional(),
});

const step3Schema = z.object({
  base_currency: z.enum(["CRC", "USD", "EUR", "GBP"]),
  enable_usd: z.boolean().default(false),
  exchange_rate: z.string().optional(),
});

const step4Schema = z.object({
  iban: z.string().optional(),
  bank_name: z.string().optional(),
  account_holder: z.string().optional(),
});

const step5Schema = z.object({
  cost_center_name: z.string().optional(),
  initial_project: z.string().optional(),
});

const step6Schema = z.object({
  payroll_email_from: z.string().email("Email inválido").optional().or(z.literal("")),
  email_template: z.string().optional(),
});

export default function CreateCompany() {
  const navigate = useNavigate();
  const { refreshCompanies, setSelectedCompany } = useCompany();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const form1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      display_name: "",
      tax_id: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  const form2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      ccss_number: "",
      ins_policy: "",
      payroll_frequency: "mensual" as const,
      work_hours_type: "",
      vacation_days_per_year: "14",
    },
  });

  const form3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      base_currency: "CRC" as const,
      enable_usd: false,
      exchange_rate: "500",
    },
  });

  const form4 = useForm({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      iban: "",
      bank_name: "",
      account_holder: "",
    },
  });

  const form5 = useForm({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      cost_center_name: "",
      initial_project: "",
    },
  });

  const form6 = useForm({
    resolver: zodResolver(step6Schema),
    defaultValues: {
      payroll_email_from: "",
      email_template: "",
    },
  });

  const getCurrentForm = () => {
    switch (currentStep) {
      case 1: return form1;
      case 2: return form2;
      case 3: return form3;
      case 4: return form4;
      case 5: return form5;
      case 6: return form6;
      default: return form1;
    }
  };

  const handleNext = async () => {
    const form = getCurrentForm();
    const isValid = await form.trigger();
    
    if (isValid) {
      setFormData({ ...formData, ...form.getValues() });
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const finalData = { ...formData, ...form6.getValues() };
      
      // Generar un company_id único
      const companyId = `COMP-${Date.now()}`;

      // Crear la empresa
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          company_id: companyId,
          display_name: finalData.display_name,
          tax_id: finalData.tax_id,
          base_currency: finalData.base_currency,
          iban: finalData.iban || null,
          payroll_email_from: finalData.payroll_email_from || null,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Asignar al usuario como admin de la empresa
      const { error: userError } = await supabase
        .from("company_users")
        .insert({
          company_id: company.id,
          user_id: user.id,
          role: "Client_Admin",
        });

      if (userError) throw userError;

      // Refresh companies list and select the new company
      await refreshCompanies();
      
      // Set the new company as selected
      setSelectedCompany({
        id: company.id,
        name: company.display_name,
        legal_name: company.display_name,
        juridical_id: company.tax_id || '',
        logo_url: company.logo_url || undefined,
        primary_color: '#0B2B4C',
        accent_color: '#2A9D8F',
        light_color: '#F5EFE6'
      });

      toast.success("Empresa creada exitosamente");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error(error.message || "Error al crear la empresa");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Crear Nueva Empresa</CardTitle>
              <CardDescription>
                Paso {currentStep} de {steps.length}: {steps[currentStep - 1].title}
              </CardDescription>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Información Básica */}
          {currentStep === 1 && (
            <Form {...form1}>
              <div className="space-y-4">
                <FormField
                  control={form1.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón Social *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de la empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form1.control}
                  name="tax_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédula Jurídica *</FormLabel>
                      <FormControl>
                        <Input placeholder="3-101-123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form1.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Dirección completa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form1.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="+506 2000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form1.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="info@empresa.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Form>
          )}

          {/* Step 2: IDs Legales */}
          {currentStep === 2 && (
            <Form {...form2}>
              <div className="space-y-4">
                <FormField
                  control={form2.control}
                  name="ccss_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número CCSS</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de patrono CCSS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form2.control}
                  name="ins_policy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Póliza INS</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de póliza INS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form2.control}
                  name="payroll_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de Pago *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="quincenal">Quincenal</SelectItem>
                          <SelectItem value="mensual">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form2.control}
                  name="work_hours_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Jornada</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Jornada completa, Media jornada" {...field} />
                      </FormControl>
                      <FormDescription>
                        Configuración predeterminada para nuevos empleados
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form2.control}
                  name="vacation_days_per_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días de Vacaciones por Año</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="14" {...field} />
                      </FormControl>
                      <FormDescription>
                        Según legislación costarricense (mínimo 14 días)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 3: Configuración de Moneda */}
          {currentStep === 3 && (
            <Form {...form3}>
              <div className="space-y-4">
                <FormField
                  control={form3.control}
                  name="base_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda Base *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CRC">Colones (CRC)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                          <SelectItem value="EUR">Euros (EUR)</SelectItem>
                          <SelectItem value="GBP">Libras (GBP)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Moneda principal para reportes y cálculos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form3.control}
                  name="exchange_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cambio USD a CRC</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="500.00" {...field} />
                      </FormControl>
                      <FormDescription>
                        Tipo de cambio inicial para conversiones
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 4: Bancos */}
          {currentStep === 4 && (
            <Form {...form4}>
              <div className="space-y-4">
                <FormField
                  control={form4.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="Banco Nacional de Costa Rica" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form4.control}
                  name="iban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IBAN</FormLabel>
                      <FormControl>
                        <Input placeholder="CR00000000000000000000" {...field} />
                      </FormControl>
                      <FormDescription>
                        Cuenta bancaria para pagos de nómina
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form4.control}
                  name="account_holder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titular de la Cuenta</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del titular" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 5: Centros de Costo */}
          {currentStep === 5 && (
            <Form {...form5}>
              <div className="space-y-4">
                <FormField
                  control={form5.control}
                  name="cost_center_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Centro de Costo Inicial</FormLabel>
                      <FormControl>
                        <Input placeholder="Administración" {...field} />
                      </FormControl>
                      <FormDescription>
                        Puedes agregar más centros de costo después
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form5.control}
                  name="initial_project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Proyecto Inicial</FormLabel>
                      <FormControl>
                        <Input placeholder="Proyecto General" {...field} />
                      </FormControl>
                      <FormDescription>
                        Puedes agregar más proyectos después
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 6: Plantillas de Email */}
          {currentStep === 6 && (
            <Form {...form6}>
              <div className="space-y-4">
                <FormField
                  control={form6.control}
                  name="payroll_email_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Remitente para Nóminas</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="nomina@empresa.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Email que aparecerá como remitente en colillas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form6.control}
                  name="email_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plantilla de Email</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Estimado/a {empleado},&#10;&#10;Adjunto encontrará su colilla de pago correspondiente al período {periodo}.&#10;&#10;Saludos cordiales,&#10;{empresa}"
                          rows={6}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Variables disponibles: {`{empleado}, {periodo}, {empresa}`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {/* Step 7: Resumen */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold text-lg">Resumen de la Empresa</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Razón Social</p>
                    <p className="font-medium">{formData.display_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cédula Jurídica</p>
                    <p className="font-medium">{formData.tax_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Moneda Base</p>
                    <p className="font-medium">{formData.base_currency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frecuencia de Pago</p>
                    <p className="font-medium">{formData.payroll_frequency}</p>
                  </div>
                  {formData.iban && (
                    <div>
                      <p className="text-muted-foreground">IBAN</p>
                      <p className="font-medium">{formData.iban}</p>
                    </div>
                  )}
                  {formData.payroll_email_from && (
                    <div>
                      <p className="text-muted-foreground">Email Nóminas</p>
                      <p className="font-medium">{formData.payroll_email_from}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Al crear la empresa, serás asignado automáticamente como administrador y podrás acceder a todos los módulos del sistema.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {currentStep < steps.length ? (
              <Button onClick={handleNext} disabled={isSubmitting}>
                Siguiente
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  "Creando..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Crear Empresa
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
