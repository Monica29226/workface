-- Create payslip_settings table for customizing PDF output
CREATE TABLE public.payslip_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Logo and branding
  show_company_logo BOOLEAN NOT NULL DEFAULT true,
  show_platform_branding BOOLEAN NOT NULL DEFAULT true,
  
  -- Section visibility
  show_hours_section BOOLEAN NOT NULL DEFAULT true,
  show_earnings_section BOOLEAN NOT NULL DEFAULT true,
  show_deductions_section BOOLEAN NOT NULL DEFAULT true,
  show_accruals_section BOOLEAN NOT NULL DEFAULT true,
  show_usd_banner BOOLEAN NOT NULL DEFAULT true,
  
  -- Field visibility within sections
  show_hire_date BOOLEAN NOT NULL DEFAULT true,
  show_cost_center BOOLEAN NOT NULL DEFAULT true,
  show_overtime_hours BOOLEAN NOT NULL DEFAULT true,
  show_absence_days BOOLEAN NOT NULL DEFAULT true,
  show_vacation_days BOOLEAN NOT NULL DEFAULT true,
  show_bonuses BOOLEAN NOT NULL DEFAULT true,
  show_loans BOOLEAN NOT NULL DEFAULT true,
  show_aguinaldo_accrued BOOLEAN NOT NULL DEFAULT true,
  show_vacation_accrued BOOLEAN NOT NULL DEFAULT true,
  
  -- Custom texts
  document_title TEXT NOT NULL DEFAULT 'Comprobante de Pago',
  employee_label TEXT NOT NULL DEFAULT 'Colaborador',
  net_pay_label TEXT NOT NULL DEFAULT 'Total a Depositar',
  footer_text TEXT,
  
  -- Unique constraint per company
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.payslip_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view payslip settings for their companies"
ON public.payslip_settings
FOR SELECT
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert payslip settings for their companies"
ON public.payslip_settings
FOR INSERT
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update payslip settings for their companies"
ON public.payslip_settings
FOR UPDATE
USING (public.has_company_access(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_payslip_settings_updated_at
  BEFORE UPDATE ON public.payslip_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();