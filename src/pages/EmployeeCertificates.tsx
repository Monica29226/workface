import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Download, FileBadge, FileText, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface EmployeeCertificateData {
  id: string;
  employee_id: string;
  full_name: string;
  work_email: string;
  hire_date: string | null;
  contract_type: string;
  currency: string;
  company_id: string;
  base_salary: number;
  job_title: string | null;
}

interface CompanyCertificateData {
  id: string;
  display_name: string;
  tax_id: string | null;
  logo_url: string | null;
}

interface LatestPayrollLine {
  net_pay: number;
  gross_salary: number;
  total_to_pay: number;
  currency: string;
}

type CertificateKind = "laboral" | "salarial";

export function EmployeeCertificates() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<CertificateKind | null>(null);
  const [employee, setEmployee] = useState<EmployeeCertificateData | null>(null);
  const [company, setCompany] = useState<CompanyCertificateData | null>(null);
  const [latestPayrollLine, setLatestPayrollLine] = useState<LatestPayrollLine | null>(null);

  useEffect(() => {
    void fetchCertificateData();
  }, []);

  const fetchCertificateData = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, work_email, hire_date, contract_type, currency, company_id, base_salary, job_title")
        .eq("user_id", user.id)
        .maybeSingle();

      if (employeeError) throw employeeError;
      if (!employeeData) {
        setEmployee(null);
        return;
      }

      setEmployee(employeeData);

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, display_name, tax_id, logo_url")
        .eq("id", employeeData.company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      const { data: payslipData } = await supabase
        .from("payslips")
        .select("batch_id")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payslipData?.batch_id) {
        const { data: payrollLine } = await supabase
          .from("payroll_lines")
          .select("net_pay, gross_salary, total_to_pay, currency")
          .eq("employee_id", employeeData.id)
          .eq("batch_id", payslipData.batch_id)
          .maybeSingle();

        if (payrollLine) {
          setLatestPayrollLine(payrollLine);
        }
      }
    } catch (error) {
      console.error("Error fetching certificate data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información para generar constancias.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (!employee) return null;

    return {
      salary: latestPayrollLine?.gross_salary || employee.base_salary || 0,
      payable: latestPayrollLine?.total_to_pay || latestPayrollLine?.net_pay || 0,
      issueDate: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
      hireDate: employee.hire_date ? format(new Date(employee.hire_date), "dd 'de' MMMM 'de' yyyy", { locale: es }) : "No registrada",
    };
  }, [employee, latestPayrollLine]);

  const buildCertificateHtml = (kind: CertificateKind) => {
    if (!employee || !company || !summary) return "";

    const certificateTitle = kind === "laboral" ? "Constancia Laboral" : "Constancia Salarial";
    const leadParagraph =
      kind === "laboral"
        ? `Por este medio se hace constar que <strong>${employee.full_name}</strong>, identificacion interna <strong>${employee.employee_id}</strong>, labora para <strong>${company.display_name}</strong>.`
        : `Por este medio se hace constar que <strong>${employee.full_name}</strong> mantiene una relacion laboral activa con <strong>${company.display_name}</strong> y percibe la remuneracion indicada en este documento.`;

    const middleParagraph =
      kind === "laboral"
        ? `La persona colaboradora se encuentra vinculada a la empresa desde el <strong>${summary.hireDate}</strong>${employee.job_title ? ` en el puesto de <strong>${employee.job_title}</strong>` : ""}.`
        : `El salario bruto de referencia es <strong>${formatCurrency(summary.salary, employee.currency)}</strong>${summary.payable > 0 ? ` y el ultimo monto neto calculado disponible es <strong>${formatCurrency(summary.payable, latestPayrollLine?.currency || employee.currency)}</strong>` : ""}.`;

    const details = kind === "laboral"
      ? [
          ["Empresa", company.display_name],
          ["Cedula juridica", company.tax_id || "No registrada"],
          ["Colaborador", employee.full_name],
          ["Puesto", employee.job_title || "No registrado"],
          ["Fecha de ingreso", summary.hireDate],
          ["Tipo de contrato", employee.contract_type],
        ]
      : [
          ["Empresa", company.display_name],
          ["Cedula juridica", company.tax_id || "No registrada"],
          ["Colaborador", employee.full_name],
          ["Moneda", employee.currency],
          ["Salario base", formatCurrency(employee.base_salary, employee.currency)],
          ["Ultimo neto disponible", summary.payable > 0 ? formatCurrency(summary.payable, latestPayrollLine?.currency || employee.currency) : "No disponible"],
        ];

    const detailRows = details
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:10px 12px;border:1px solid #d7dde5;background:#f6f8fb;font-weight:600;">${label}</td>
            <td style="padding:10px 12px;border:1px solid #d7dde5;">${value}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${certificateTitle}</title>
          <style>
            body { font-family: Mulish, Arial, sans-serif; color: #1A2046; margin: 0; background: #F5F2E9; }
            .page { max-width: 840px; margin: 32px auto; background: #ffffff; padding: 48px; box-shadow: 0 18px 48px rgba(21,22,44,.14); position: relative; }
            .page::before { content: ""; position: absolute; inset: 14px; border: 1px solid rgba(182,146,79,.55); pointer-events: none; }
            .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #D9D3C0; }
            .brand h1 { margin: 10px 0 0; font-size: 28px; font-family: "Libre Caslon Display", Georgia, serif; font-weight: 400; }
            .brand p { margin: 6px 0 0; color: #6A6B7C; }
            .eyebrow { display: inline-block; color: #8C6E38; font-size: 11px; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; }
            .platform { margin-top: 8px; font-size: 14px; color: #1A2046; font-weight: 600; }
            h2 { font-size: 30px; margin: 32px 0 16px; font-family: "Libre Caslon Display", Georgia, serif; font-weight: 400; }
            p { line-height: 1.75; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; margin: 28px 0; }
            .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #D9D3C0; color: #6A6B7C; font-size: 13px; }
            .signature { margin-top: 56px; }
            .signature-line { width: 280px; border-top: 1px solid #1A2046; margin-top: 48px; padding-top: 8px; font-weight: 600; }
            .print-button { position: fixed; right: 24px; top: 24px; padding: 10px 16px; background: #1A2046; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
            @media print {
              body { background: #fff; }
              .page { margin: 0; box-shadow: none; max-width: none; }
              .page::before { inset: 10px; }
              .print-button { display: none; }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Imprimir o guardar PDF</button>
          <div class="page">
            <div class="header">
              <div class="brand">
                <span class="eyebrow">ACL Web</span>
                <div class="platform">Plataforma de Planillas</div>
                <h1>${company.display_name}</h1>
                <p>Cedula juridica: ${company.tax_id || "No registrada"}</p>
              </div>
              <div style="text-align:right">
                <strong>Fecha de emision</strong>
                <div>${summary.issueDate}</div>
              </div>
            </div>
            <h2>${certificateTitle}</h2>
            <p>${leadParagraph}</p>
            <p>${middleParagraph}</p>
            <table>${detailRows}</table>
            <p>La presente constancia se emite a solicitud de la persona interesada para los fines que estime convenientes.</p>
            <div class="signature">
              <div class="signature-line">ACL Web · Planillas · ${company.display_name}</div>
            </div>
            <div class="footer">
              Documento generado desde la plataforma de ACL Costa Rica el ${summary.issueDate}.
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerateCertificate = (kind: CertificateKind) => {
    if (!employee || !company) return;

    setIsGenerating(kind);
    try {
      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=1200");
      if (!printWindow) {
        throw new Error("No se pudo abrir la ventana para generar la constancia.");
      }

      printWindow.document.open();
      printWindow.document.write(buildCertificateHtml(kind));
      printWindow.document.close();

      toast({
        title: "Constancia lista",
        description: kind === "laboral" ? "Se genero la constancia laboral." : "Se genero la constancia salarial.",
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la constancia.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando constancias...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Tu cuenta no esta asociada a un registro de empleado. Contacta a tu administrador.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileBadge className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mis Constancias</h1>
            <p className="text-muted-foreground">Genera constancias laborales y salariales desde tu portal.</p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit">
          {company?.display_name || "ACL Costa Rica"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Empresa</p>
                <p className="text-lg font-semibold">{company?.display_name}</p>
              </div>
              <Building2 className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Salario base</p>
                <p className="text-lg font-semibold">{formatCurrency(employee.base_salary, employee.currency)}</p>
              </div>
              <Wallet className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Fecha de ingreso</p>
                <p className="text-lg font-semibold">
                  {employee.hire_date ? format(new Date(employee.hire_date), "dd MMM yyyy", { locale: es }) : "No registrada"}
                </p>
              </div>
              <FileText className="h-10 w-10 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Constancia laboral</CardTitle>
            <CardDescription>
              Confirma la relacion laboral, fecha de ingreso y datos generales del colaborador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Util para tramites bancarios, expedientes internos o solicitudes administrativas.
            </p>
            <Separator />
            <Button
              className="w-full"
              onClick={() => handleGenerateCertificate("laboral")}
              disabled={isGenerating !== null}
            >
              {isGenerating === "laboral" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generar constancia laboral
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Constancia salarial</CardTitle>
            <CardDescription>
              Incluye salario base y, si existe, el ultimo neto calculado disponible en planilla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pensada para tramites que requieren respaldo de ingreso del colaborador.
            </p>
            <Separator />
            <Button
              className="w-full"
              onClick={() => handleGenerateCertificate("salarial")}
              disabled={isGenerating !== null}
            >
              {isGenerating === "salarial" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generar constancia salarial
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
