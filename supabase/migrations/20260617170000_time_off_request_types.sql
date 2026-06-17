ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'vacaciones';

ALTER TABLE public.vacation_requests
ADD COLUMN IF NOT EXISTS is_half_day boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vacation_requests_request_type_check'
  ) THEN
    ALTER TABLE public.vacation_requests
    ADD CONSTRAINT vacation_requests_request_type_check
    CHECK (request_type IN ('vacaciones', 'dia_libre', 'medio_dia', 'permiso_sin_goce'));
  END IF;
END $$;

UPDATE public.vacation_requests
SET request_type = 'vacaciones'
WHERE request_type IS NULL;

UPDATE public.vacation_requests
SET is_half_day = false
WHERE is_half_day IS NULL;
