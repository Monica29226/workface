
-- 1) Add request_type to vacation_requests
ALTER TABLE public.vacation_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'vacaciones';

ALTER TABLE public.vacation_requests
  DROP CONSTRAINT IF EXISTS vacation_requests_request_type_check;
ALTER TABLE public.vacation_requests
  ADD CONSTRAINT vacation_requests_request_type_check
  CHECK (request_type IN ('vacaciones','dia_libre','medio_dia','permiso_sin_goce'));

-- 2) Recalculate vacation accruals (idempotent)
CREATE OR REPLACE FUNCTION public.recalculate_vacation_accruals(
  p_company_id uuid,
  p_year integer DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  v_year_start date := make_date(v_year, 1, 1);
  v_year_end date := make_date(v_year, 12, 31);
  v_monthly_rate numeric;
  v_max_days numeric;
  v_expiry_months numeric;
  v_processed integer := 0;
  r record;
  v_start date;
  v_end date;
  v_months integer;
  v_accrued numeric;
  v_daily_rate numeric;
  v_expiry date;
BEGIN
  -- Authorization: requester must have admin or company access
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
    OR public.has_company_access(auth.uid(), p_company_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to recalculate vacation accruals for this company';
  END IF;

  SELECT COALESCE(vacation_monthly_accrual, 1),
         COALESCE(vacation_days_standard, 12),
         COALESCE(vacation_expiry_months, 12)
    INTO v_monthly_rate, v_max_days, v_expiry_months
  FROM public.company_parameters
  WHERE company_id = p_company_id
  LIMIT 1;

  IF v_monthly_rate IS NULL THEN
    v_monthly_rate := 1;
    v_max_days := 12;
    v_expiry_months := 12;
  END IF;

  FOR r IN
    SELECT id, hire_date
    FROM public.employees
    WHERE company_id = p_company_id
      AND status = 'activo'
      AND (p_employee_id IS NULL OR id = p_employee_id)
  LOOP
    IF r.hire_date IS NULL THEN
      CONTINUE;
    END IF;

    v_start := GREATEST(r.hire_date, v_year_start);
    v_end := LEAST(CURRENT_DATE, v_year_end);

    IF v_end < v_start THEN
      v_months := 0;
    ELSE
      -- Full months completed between v_start and v_end
      v_months := GREATEST(
        0,
        ((EXTRACT(YEAR FROM v_end) - EXTRACT(YEAR FROM v_start)) * 12
         + (EXTRACT(MONTH FROM v_end) - EXTRACT(MONTH FROM v_start))
         + CASE WHEN EXTRACT(DAY FROM v_end) >= EXTRACT(DAY FROM v_start) THEN 0 ELSE -1 END
        )::integer
      );
    END IF;

    v_accrued := LEAST(v_months * v_monthly_rate, v_max_days);
    v_expiry := (v_year_start + (v_expiry_months || ' months')::interval)::date;

    INSERT INTO public.employee_vacations
      (employee_id, company_id, year, days_accrued, accrual_start_date, expiry_date)
    VALUES
      (r.id, p_company_id, v_year, v_accrued, v_year_start, v_expiry)
    ON CONFLICT (employee_id, year) DO UPDATE
      SET days_accrued = GREATEST(EXCLUDED.days_accrued, public.employee_vacations.days_taken),
          accrual_start_date = COALESCE(public.employee_vacations.accrual_start_date, EXCLUDED.accrual_start_date),
          expiry_date = COALESCE(public.employee_vacations.expiry_date, EXCLUDED.expiry_date),
          updated_at = now();

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_vacation_accruals(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_vacation_accruals(uuid, integer, uuid) TO service_role;

-- 3) Process vacation request approval (manager -> HR -> approved/rejected)
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
  v_req public.vacation_requests%ROWTYPE;
  v_new_stage text;
  v_new_status text;
  v_is_manager boolean := false;
  v_is_hr boolean := false;
  v_year integer;
BEGIN
  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  SELECT * INTO v_req FROM public.vacation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vacation request not found';
  END IF;

  -- Permissions: HR/admin OR manager of the employee
  v_is_hr := public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role)
          OR EXISTS (
               SELECT 1 FROM public.company_users cu
                WHERE cu.user_id = auth.uid()
                  AND cu.company_id = v_req.company_id
                  AND cu.role IN ('company_manager','Client_Admin','Client_HR')
             );

  v_is_manager := EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.employees mgr ON mgr.id = e.manager_id
    WHERE e.id = v_req.employee_id
      AND mgr.user_id = auth.uid()
  );

  IF NOT (v_is_hr OR v_is_manager) THEN
    RAISE EXCEPTION 'Not authorized to act on this request';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', v_req.status;
  END IF;

  v_new_stage := v_req.approval_stage;
  v_new_status := v_req.status;

  IF p_action = 'reject' THEN
    v_new_status := 'rejected';
    v_new_stage := 'rejected';
  ELSE
    -- approve
    IF COALESCE(v_req.approval_stage,'pending_hr') = 'pending_manager' THEN
      IF NOT v_is_manager AND NOT v_is_hr THEN
        RAISE EXCEPTION 'Only the manager (or HR) can approve at this stage';
      END IF;
      v_new_stage := 'pending_hr';
    ELSE
      -- pending_hr -> approved
      IF NOT v_is_hr THEN
        RAISE EXCEPTION 'Only HR can give final approval';
      END IF;
      v_new_stage := 'approved';
      v_new_status := 'approved';
    END IF;
  END IF;

  UPDATE public.vacation_requests
     SET status = v_new_status,
         approval_stage = v_new_stage,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = COALESCE(p_notes, review_notes),
         manager_decision_at = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_manager'
                 THEN now() ELSE manager_decision_at END,
         manager_decision_by = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_manager'
                 THEN auth.uid() ELSE manager_decision_by END,
         manager_notes = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_manager'
                 THEN COALESCE(p_notes, manager_notes) ELSE manager_notes END,
         hr_decision_at = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_hr' AND v_new_stage IN ('approved','rejected')
                 THEN now() ELSE hr_decision_at END,
         hr_decision_by = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_hr' AND v_new_stage IN ('approved','rejected')
                 THEN auth.uid() ELSE hr_decision_by END,
         hr_notes = CASE
            WHEN COALESCE(v_req.approval_stage,'pending_hr') = 'pending_hr' AND v_new_stage IN ('approved','rejected')
                 THEN COALESCE(p_notes, hr_notes) ELSE hr_notes END
   WHERE id = p_request_id;

  -- Discount balance only when fully approved and request type consumes balance
  IF v_new_status = 'approved'
     AND v_req.request_type IN ('vacaciones','dia_libre','medio_dia') THEN
    v_year := EXTRACT(YEAR FROM v_req.start_date)::integer;

    INSERT INTO public.employee_vacations
      (employee_id, company_id, year, days_accrued, days_taken)
    VALUES
      (v_req.employee_id, v_req.company_id, v_year, 0, v_req.days_requested)
    ON CONFLICT (employee_id, year) DO UPDATE
      SET days_taken = public.employee_vacations.days_taken + EXCLUDED.days_taken,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'status', v_new_status,
    'approval_stage', v_new_stage
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_vacation_request_approval(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_vacation_request_approval(uuid, text, text) TO service_role;

-- 4) Cancel vacation request (by the employee)
CREATE OR REPLACE FUNCTION public.cancel_vacation_request(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.vacation_requests%ROWTYPE;
  v_owner boolean;
  v_year integer;
  v_was_approved boolean;
BEGIN
  SELECT * INTO v_req FROM public.vacation_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vacation request not found';
  END IF;

  v_owner := EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = v_req.employee_id
      AND e.user_id = auth.uid()
  );

  IF NOT v_owner
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'ACL_SuperAdmin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized to cancel this request';
  END IF;

  IF v_req.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Only pending or approved requests can be cancelled (current: %)', v_req.status;
  END IF;

  -- Employees can only cancel while still pending
  IF v_owner AND v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'You can only cancel requests that are still pending';
  END IF;

  v_was_approved := (v_req.status = 'approved');

  UPDATE public.vacation_requests
     SET status = 'cancelled',
         approval_stage = 'cancelled',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_request_id;

  -- Refund balance if it had been discounted
  IF v_was_approved
     AND v_req.request_type IN ('vacaciones','dia_libre','medio_dia') THEN
    v_year := EXTRACT(YEAR FROM v_req.start_date)::integer;
    UPDATE public.employee_vacations
       SET days_taken = GREATEST(0, days_taken - v_req.days_requested),
           updated_at = now()
     WHERE employee_id = v_req.employee_id
       AND year = v_year;
  END IF;

  RETURN jsonb_build_object('status','cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_vacation_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_vacation_request(uuid) TO service_role;
