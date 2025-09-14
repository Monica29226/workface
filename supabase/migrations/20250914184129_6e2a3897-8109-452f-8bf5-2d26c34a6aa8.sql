-- Create company_parameters table for configuration settings
CREATE TABLE public.company_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  anio INTEGER NOT NULL,
  moneda_default VARCHAR DEFAULT 'CRC',
  formato_decimal INTEGER DEFAULT 2,
  tipo_cambio JSONB DEFAULT '[]'::jsonb, -- Array of {periodo: "YYYY-MM", tc: number}
  vacaciones JSONB DEFAULT '{"dias_por_mes": 1.25}'::jsonb,
  aguinaldo JSONB DEFAULT '{"desde": "12-01", "hasta": "11-30"}'::jsonb,
  renta JSONB DEFAULT '{"tramos": [{"hasta": 941000, "tasa": 0}, {"hasta": 1381000, "tasa": 0.10}, {"hasta": 2423000, "tasa": 0.15}, {"hasta": 4845000, "tasa": 0.20}, {"sobre": 4845000, "tasa": 0.25}], "deducciones": {"conyuge": 25000, "hijo": 25000}}'::jsonb,
  ccss JSONB DEFAULT '{"empleado": 0.10, "patrono": 0.26}'::jsonb,
  recargos JSONB DEFAULT '{"hora_extra": 1.50, "nocturnidad": 1.25, "feriado": 2.00}'::jsonb,
  weekend_rates JSONB DEFAULT '{"saturday_mult": 1.00, "sunday_mult": 1.50}'::jsonb,
  workweek VARCHAR DEFAULT 'Mon-Fri',
  feriados JSONB DEFAULT '[]'::jsonb, -- Array of {fecha: "YYYY-MM-DD", nombre: string, doble: boolean}
  cesantia_matriz JSONB DEFAULT '[]'::jsonb, -- Array of cesantia calculation rules
  centros_costo JSONB DEFAULT '[]'::jsonb, -- Array of cost centers
  proyectos JSONB DEFAULT '[]'::jsonb, -- Array of projects
  email_config JSONB DEFAULT '{"mode": "smtp", "batch": {"size": 50, "delay_ms": 1000}}'::jsonb,
  pie_legal_pdf TEXT,
  version INTEGER DEFAULT 1,
  publicado BOOLEAN DEFAULT false,
  publicado_at TIMESTAMP WITH TIME ZONE,
  publicado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint per company and year
  UNIQUE(company_id, anio)
);

-- Enable Row Level Security
ALTER TABLE public.company_parameters ENABLE ROW LEVEL SECURITY;

-- Create policies for company_parameters
CREATE POLICY "Users can manage parameters for their companies" 
ON public.company_parameters 
FOR ALL 
USING (company_id IN ( 
  SELECT company_users.company_id
  FROM company_users
  WHERE (company_users.user_id = auth.uid() AND company_users.active = true AND company_users.role::text = ANY (ARRAY['Owner'::character varying, 'Admin'::character varying]::text[]))
));

CREATE POLICY "Users can view parameters from their companies" 
ON public.company_parameters 
FOR SELECT 
USING (company_id IN ( 
  SELECT company_users.company_id
  FROM company_users
  WHERE (company_users.user_id = auth.uid() AND company_users.active = true)
));

-- Create parameter_versions table for version history
CREATE TABLE public.parameter_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parameter_id UUID NOT NULL REFERENCES public.company_parameters(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL, -- Complete parameter data snapshot
  comentario TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on parameter_versions
ALTER TABLE public.parameter_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage parameter versions for their companies" 
ON public.parameter_versions 
FOR ALL 
USING (parameter_id IN (
  SELECT cp.id FROM public.company_parameters cp
  WHERE cp.company_id IN ( 
    SELECT company_users.company_id
    FROM company_users
    WHERE (company_users.user_id = auth.uid() AND company_users.active = true AND company_users.role::text = ANY (ARRAY['Owner'::character varying, 'Admin'::character varying]::text[]))
  )
));

-- Create audit_log table for tracking changes
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,
  accion VARCHAR NOT NULL,
  entidad VARCHAR NOT NULL,
  entidad_id UUID,
  antes JSONB,
  despues JSONB,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit log for their companies" 
ON public.audit_log 
FOR SELECT 
USING (company_id IN ( 
  SELECT company_users.company_id
  FROM company_users
  WHERE (company_users.user_id = auth.uid() AND company_users.active = true AND company_users.role::text = ANY (ARRAY['Owner'::character varying, 'Admin'::character varying]::text[]))
));

-- Create triggers for updated_at
CREATE TRIGGER update_company_parameters_updated_at
BEFORE UPDATE ON public.company_parameters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert demo data for Horizonte Positivo (2025)
INSERT INTO public.company_parameters (
  company_id, 
  anio, 
  moneda_default,
  tipo_cambio,
  pie_legal_pdf,
  publicado
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000', 
  2025, 
  'CRC',
  '[
    {"periodo": "2025-01", "tc": 510.27},
    {"periodo": "2025-02", "tc": 510.27},
    {"periodo": "2025-03", "tc": 510.27},
    {"periodo": "2025-04", "tc": 510.27},
    {"periodo": "2025-05", "tc": 510.27},
    {"periodo": "2025-06", "tc": 510.27},
    {"periodo": "2025-07", "tc": 510.27},
    {"periodo": "2025-08", "tc": 510.27},
    {"periodo": "2025-09", "tc": 510.27},
    {"periodo": "2025-10", "tc": 510.27},
    {"periodo": "2025-11", "tc": 510.27},
    {"periodo": "2025-12", "tc": 510.27}
  ]'::jsonb,
  'Este documento es de carácter informativo y está sujeto a las disposiciones del Código de Trabajo y la Caja Costarricense de Seguro Social.',
  true
);

-- Same for Alturas de Tenorio
INSERT INTO public.company_parameters (
  company_id, 
  anio, 
  moneda_default,
  tipo_cambio,
  pie_legal_pdf,
  publicado
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001', 
  2025, 
  'CRC',
  '[
    {"periodo": "2025-01", "tc": 510.27},
    {"periodo": "2025-02", "tc": 510.27},
    {"periodo": "2025-03", "tc": 510.27},
    {"periodo": "2025-04", "tc": 510.27},
    {"periodo": "2025-05", "tc": 510.27},
    {"periodo": "2025-06", "tc": 510.27},
    {"periodo": "2025-07", "tc": 510.27},
    {"periodo": "2025-08", "tc": 510.27},
    {"periodo": "2025-09", "tc": 510.27},
    {"periodo": "2025-10", "tc": 510.27},
    {"periodo": "2025-11", "tc": 510.27},
    {"periodo": "2025-12", "tc": 510.27}
  ]'::jsonb,
  'Este documento es de carácter informativo y está sujeto a las disposiciones del Código de Trabajo y la Caja Costarricense de Seguro Social.',
  true
);