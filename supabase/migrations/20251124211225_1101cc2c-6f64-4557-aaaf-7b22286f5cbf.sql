-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'es',
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  attachment_url TEXT,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_templates
CREATE POLICY "Users can view templates for their company"
  ON public.email_templates FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id))
  );

CREATE POLICY "Admins and managers can manage templates"
  ON public.email_templates FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id))
  );

-- RLS policies for email_logs
CREATE POLICY "Users can view email logs for their company"
  ON public.email_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (has_role(auth.uid(), 'company_manager'::app_role) AND has_company_access(auth.uid(), company_id))
  );

CREATE POLICY "System can insert email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update email logs"
  ON public.email_logs FOR UPDATE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();