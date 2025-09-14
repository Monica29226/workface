-- Resolver advertencias de seguridad
-- Añadir políticas RLS faltantes y arreglar función

-- Políticas faltantes para system_parameters
CREATE POLICY "Users can view parameters for their companies" ON public.system_parameters
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can manage parameters for their companies" ON public.system_parameters
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin')
    )
  );

-- Políticas faltantes para cost_centers
CREATE POLICY "Users can view cost centers for their companies" ON public.cost_centers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can manage cost centers for their companies" ON public.cost_centers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll')
    )
  );

-- Políticas faltantes para payroll_periods
CREATE POLICY "Users can view payroll periods for their companies" ON public.payroll_periods
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Users can manage payroll periods for their companies" ON public.payroll_periods
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll')
    )
  );

-- Arreglar función con search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Políticas adicionales para gestión completa de datos
CREATE POLICY "Users can manage contracts for their companies" ON public.contracts
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll')
    )
  );

CREATE POLICY "Users can manage timesheets for their companies" ON public.timesheets
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll', 'Manager')
    )
  );

CREATE POLICY "Users can manage payrolls for their companies" ON public.payrolls
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_users 
      WHERE user_id = auth.uid() AND active = true
      AND role IN ('Owner', 'Admin', 'Payroll')
    )
  );