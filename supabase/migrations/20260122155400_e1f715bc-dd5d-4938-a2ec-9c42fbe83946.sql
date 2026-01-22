-- Add 'autorizado' status to payroll_batch_status enum
ALTER TYPE public.payroll_batch_status ADD VALUE IF NOT EXISTS 'autorizado' AFTER 'aprobado';

-- Add comment explaining the workflow
COMMENT ON TYPE public.payroll_batch_status IS 'Workflow: borrador → calculado → aprobado → autorizado → enviado. Envío de colillas solo permitido en estado autorizado.';