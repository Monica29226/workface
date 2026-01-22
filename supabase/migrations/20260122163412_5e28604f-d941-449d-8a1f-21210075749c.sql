-- Actualizar valores por defecto de company_parameters según CCSS 2026
-- Cuota Patronal Total: 26.83% (CCSS + INA + IMAS + FODESAF + BP + Ley Protección + INS)
-- Cuota Obrera Total: 10.83% (CCSS 9.83% + BP 1%)

-- Actualizar valores por defecto de las columnas
ALTER TABLE public.company_parameters 
  ALTER COLUMN ccss_patronal_total SET DEFAULT 26.83,
  ALTER COLUMN ccss_obrero_total SET DEFAULT 10.83;

-- Actualizar tramos de renta 2026
ALTER TABLE public.company_parameters
  ALTER COLUMN renta_bracket_1_limit SET DEFAULT 918000,
  ALTER COLUMN renta_bracket_2_limit SET DEFAULT 1347000,
  ALTER COLUMN renta_bracket_3_limit SET DEFAULT 2364000,
  ALTER COLUMN renta_bracket_4_limit SET DEFAULT 4727000;

-- Actualizar registros existentes que tengan los valores antiguos
UPDATE public.company_parameters
SET 
  ccss_patronal_total = 26.83,
  ccss_obrero_total = 10.83,
  renta_bracket_1_limit = 918000,
  renta_bracket_2_limit = 1347000,
  renta_bracket_3_limit = 2364000,
  renta_bracket_4_limit = 4727000
WHERE 
  ccss_patronal_total = 14.50 
  OR ccss_obrero_total = 9.50
  OR renta_bracket_1_limit = 941000;