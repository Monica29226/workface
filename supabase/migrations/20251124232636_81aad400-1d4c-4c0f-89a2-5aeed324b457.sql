-- Add fields to payroll_lines for manual editing and detailed tracking
ALTER TABLE payroll_lines
ADD COLUMN IF NOT EXISTS regular_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS absence_days numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS vacation_days_taken numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_leave_days numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_bonuses numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_deductions numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_adjustments jsonb DEFAULT '{}';

-- Create audit table for tracking changes to payroll lines
CREATE TABLE IF NOT EXISTS payroll_line_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_line_id uuid REFERENCES payroll_lines(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now(),
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE payroll_line_changes ENABLE ROW LEVEL SECURITY;

-- Allow admins and managers to view change history
CREATE POLICY "Admins and managers can view payroll line changes"
ON payroll_line_changes
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'company_manager'::app_role) AND 
   EXISTS (
     SELECT 1 FROM payroll_lines pl
     WHERE pl.id = payroll_line_changes.payroll_line_id
     AND has_company_access(auth.uid(), pl.company_id)
   ))
);

-- Allow system to insert change records
CREATE POLICY "System can insert payroll line changes"
ON payroll_line_changes
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payroll_line_changes_line_id ON payroll_line_changes(payroll_line_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_changes_changed_at ON payroll_line_changes(changed_at DESC);