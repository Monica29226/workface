-- Add structured deductions detail and total_to_pay columns to payroll_lines
ALTER TABLE public.payroll_lines 
ADD COLUMN IF NOT EXISTS deductions_detail jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_to_pay numeric DEFAULT 0;

-- Add comment explaining the structure
COMMENT ON COLUMN public.payroll_lines.deductions_detail IS 'Structured JSON with items array containing code, label, type, rate, amount for each deduction';
COMMENT ON COLUMN public.payroll_lines.total_to_pay IS 'Final amount to pay after all adjustments (net_pay - additional items like lunch, other deductions + independent payments)';