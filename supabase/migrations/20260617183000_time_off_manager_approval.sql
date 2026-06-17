ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS approval_stage text NOT NULL DEFAULT 'pending_hr';

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS manager_decision_at timestamptz;

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS manager_decision_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS manager_notes text;

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS hr_decision_at timestamptz;

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS hr_decision_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS hr_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vacation_requests_approval_stage_check'
  ) THEN
    ALTER TABLE public.vacation_requests
    ADD CONSTRAINT vacation_requests_approval_stage_check
    CHECK (approval_stage IN ('pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled'));
  END IF;
END $$;

UPDATE public.vacation_requests
SET approval_stage = CASE
  WHEN status = 'approved' THEN 'approved'
  WHEN status = 'rejected' THEN 'rejected'
  WHEN status = 'cancelled' THEN 'cancelled'
  ELSE 'pending_hr'
END
WHERE approval_stage IS NULL OR approval_stage = 'pending_hr';

CREATE OR REPLACE FUNCTION public.user_is_manager_for_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees subordinate
    JOIN public.employees manager
      ON subordinate.manager_id = manager.id
    WHERE subordinate.id = _employee_id
      AND manager.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_hr_manage_time_off(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'ACL_SuperAdmin'::public.app_role)
    OR public.has_role(_user_id, 'ACL_PayrollSpecialist'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = _user_id
        AND cu.company_id = _company_id
        AND cu.role IN ('company_manager', 'Client_Admin', 'Client_HR')
    );
$$;

CREATE OR REPLACE FUNCTION public.set_vacation_request_initial_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_manager_user boolean := false;
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'pending';
  END IF;

  IF NEW.approval_stage IS NULL OR NEW.approval_stage = 'pending_hr' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.employees subordinate
      JOIN public.employees manager
        ON subordinate.manager_id = manager.id
      WHERE subordinate.id = NEW.employee_id
        AND manager.user_id IS NOT NULL
    )
    INTO has_manager_user;

    IF has_manager_user THEN
      NEW.approval_stage := 'pending_manager';
    ELSE
      NEW.approval_stage := 'pending_hr';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vacation_request_initial_stage ON public.vacation_requests;
CREATE TRIGGER set_vacation_request_initial_stage
BEFORE INSERT ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_vacation_request_initial_stage();

CREATE OR REPLACE FUNCTION public.log_vacation_request_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email_value text;
  target_email_value text;
  details_value text;
  action_name text;
BEGIN
  actor_email_value := COALESCE(
    (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
    'system@aclcostarica.com'
  );

  target_email_value := (
    SELECT e.work_email
    FROM public.employees e
    WHERE e.id = COALESCE(NEW.employee_id, OLD.employee_id)
  );

  IF TG_OP = 'INSERT' THEN
    action_name := 'time_off_request_created';
    details_value := format(
      'Solicitud creada. Tipo: %s. Etapa inicial: %s. Estado: %s.',
      COALESCE(NEW.request_type, 'vacaciones'),
      COALESCE(NEW.approval_stage, 'pending_hr'),
      COALESCE(NEW.status, 'pending')
    );
  ELSE
    IF OLD.approval_stage IS DISTINCT FROM NEW.approval_stage OR OLD.status IS DISTINCT FROM NEW.status THEN
      action_name := CASE
        WHEN NEW.approval_stage = 'pending_hr' AND OLD.approval_stage = 'pending_manager' THEN 'time_off_manager_approved'
        WHEN NEW.approval_stage = 'rejected' AND NEW.manager_decision_by IS NOT NULL AND NEW.hr_decision_by IS NULL THEN 'time_off_manager_rejected'
        WHEN NEW.approval_stage = 'approved' THEN 'time_off_hr_approved'
        WHEN NEW.approval_stage = 'rejected' AND NEW.hr_decision_by IS NOT NULL THEN 'time_off_hr_rejected'
        WHEN NEW.approval_stage = 'cancelled' THEN 'time_off_request_cancelled'
        ELSE 'time_off_request_updated'
      END;

      details_value := format(
        'Cambio de flujo. Etapa: %s -> %s. Estado: %s -> %s. Notas jefe: %s. Notas RRHH: %s.',
        COALESCE(OLD.approval_stage, 'null'),
        COALESCE(NEW.approval_stage, 'null'),
        COALESCE(OLD.status, 'null'),
        COALESCE(NEW.status, 'null'),
        COALESCE(NEW.manager_notes, 'sin notas'),
        COALESCE(NEW.hr_notes, 'sin notas')
      );
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    log_id,
    action,
    actor_email,
    company_id,
    details,
    target_email
  )
  VALUES (
    encode(gen_random_bytes(16), 'hex'),
    action_name,
    actor_email_value,
    COALESCE(NEW.company_id, OLD.company_id),
    details_value,
    target_email_value
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_vacation_request_audit ON public.vacation_requests;
CREATE TRIGGER log_vacation_request_audit
AFTER INSERT OR UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_vacation_request_audit();

CREATE OR REPLACE FUNCTION public.process_vacation_request_approval(
  p_request_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_is_manager boolean := false;
  actor_is_hr boolean := false;
  request_row public.vacation_requests%ROWTYPE;
  request_employee public.employees%ROWTYPE;
  vacation_data public.employee_vacations%ROWTYPE;
  consumes_balance boolean := false;
  new_days_taken numeric := 0;
  new_days_pending numeric := 0;
  new_balance numeric := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Accion no valida';
  END IF;

  SELECT *
  INTO request_row
  FROM public.vacation_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  SELECT *
  INTO request_employee
  FROM public.employees
  WHERE id = request_row.employee_id;

  IF request_employee.id IS NULL THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;

  actor_is_manager := public.user_is_manager_for_employee(actor_id, request_row.employee_id);
  actor_is_hr := public.user_can_hr_manage_time_off(actor_id, request_row.company_id);
  consumes_balance := COALESCE(request_row.request_type, 'vacaciones') <> 'permiso_sin_goce';

  IF request_row.status <> 'pending' OR request_row.approval_stage NOT IN ('pending_manager', 'pending_hr') THEN
    RAISE EXCEPTION 'La solicitud ya no admite cambios';
  END IF;

  IF request_row.approval_stage = 'pending_manager' THEN
    IF NOT actor_is_manager AND NOT actor_is_hr THEN
      RAISE EXCEPTION 'No tiene permiso para decidir esta solicitud';
    END IF;

    IF p_action = 'approve' THEN
      UPDATE public.vacation_requests
      SET
        approval_stage = 'pending_hr',
        manager_decision_at = now(),
        manager_decision_by = actor_id,
        manager_notes = p_notes,
        updated_at = now()
      WHERE id = p_request_id;

      RETURN jsonb_build_object(
        'status', 'pending',
        'approval_stage', 'pending_hr'
      );
    END IF;

    UPDATE public.vacation_requests
    SET
      status = 'rejected',
      approval_stage = 'rejected',
      manager_decision_at = now(),
      manager_decision_by = actor_id,
      manager_notes = p_notes,
      reviewed_at = now(),
      reviewed_by = actor_id,
      review_notes = p_notes,
      updated_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'status', 'rejected',
      'approval_stage', 'rejected'
    );
  END IF;

  IF NOT actor_is_hr THEN
    RAISE EXCEPTION 'Solo RRHH o administracion puede decidir esta etapa';
  END IF;

  IF p_action = 'approve' THEN
    IF consumes_balance AND COALESCE(request_employee.vac_balance_days, 0) < request_row.days_requested THEN
      RAISE EXCEPTION 'Saldo insuficiente para aprobar la solicitud';
    END IF;

    UPDATE public.vacation_requests
    SET
      status = 'approved',
      approval_stage = 'approved',
      hr_decision_at = now(),
      hr_decision_by = actor_id,
      hr_notes = p_notes,
      reviewed_at = now(),
      reviewed_by = actor_id,
      review_notes = p_notes,
      updated_at = now()
    WHERE id = p_request_id;

    IF consumes_balance THEN
      SELECT *
      INTO vacation_data
      FROM public.employee_vacations
      WHERE employee_id = request_row.employee_id
        AND year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      FOR UPDATE;

      IF vacation_data.id IS NOT NULL THEN
        new_days_taken := COALESCE(vacation_data.days_taken, 0) + request_row.days_requested;
        new_days_pending := COALESCE(vacation_data.days_accrued, 0) - new_days_taken;

        UPDATE public.employee_vacations
        SET
          days_taken = new_days_taken,
          days_pending = new_days_pending
        WHERE id = vacation_data.id;
      END IF;

      new_balance := GREATEST(COALESCE(request_employee.vac_balance_days, 0) - request_row.days_requested, 0);

      UPDATE public.employees
      SET vac_balance_days = new_balance
      WHERE id = request_row.employee_id;
    END IF;

    RETURN jsonb_build_object(
      'status', 'approved',
      'approval_stage', 'approved'
    );
  END IF;

  UPDATE public.vacation_requests
  SET
    status = 'rejected',
    approval_stage = 'rejected',
    hr_decision_at = now(),
    hr_decision_by = actor_id,
    hr_notes = p_notes,
    reviewed_at = now(),
    reviewed_by = actor_id,
    review_notes = p_notes,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'status', 'rejected',
    'approval_stage', 'rejected'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_vacation_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  UPDATE public.vacation_requests
  SET
    status = 'cancelled',
    approval_stage = 'cancelled',
    updated_at = now()
  WHERE id = p_request_id
    AND employee_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = actor_id
    )
    AND status = 'pending'
    AND approval_stage IN ('pending_manager', 'pending_hr');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo cancelar la solicitud';
  END IF;

  RETURN jsonb_build_object(
    'status', 'cancelled',
    'approval_stage', 'cancelled'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_vacation_request_approval(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_vacation_request_approval(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_vacation_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_vacation_request(uuid) TO authenticated;

DROP POLICY IF EXISTS "Employees can view their own vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Employees can create their own vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Employees can cancel their own pending vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Admins and managers can manage vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Users can view vacation requests of their companies" ON public.vacation_requests;

CREATE POLICY "Employees can view their own vacation requests"
ON public.vacation_requests
FOR SELECT
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can view direct report vacation requests"
ON public.vacation_requests
FOR SELECT
USING (
  public.user_is_manager_for_employee(auth.uid(), employee_id)
);

CREATE POLICY "HR can view company vacation requests"
ON public.vacation_requests
FOR SELECT
USING (
  public.user_can_hr_manage_time_off(auth.uid(), company_id)
);

CREATE POLICY "Employees can create their own vacation requests"
ON public.vacation_requests
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can cancel their own pending vacation requests"
ON public.vacation_requests
FOR UPDATE
USING (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
  AND status = 'pending'
  AND approval_stage IN ('pending_manager', 'pending_hr')
)
WITH CHECK (
  employee_id IN (
    SELECT e.id
    FROM public.employees e
    WHERE e.user_id = auth.uid()
  )
  AND status IN ('pending', 'cancelled')
);

DROP POLICY IF EXISTS "Managers can view direct reports on employees" ON public.employees;
CREATE POLICY "Managers can view direct reports on employees"
ON public.employees
FOR SELECT
USING (
  manager_id IN (
    SELECT manager_employee.id
    FROM public.employees manager_employee
    WHERE manager_employee.user_id = auth.uid()
  )
);
