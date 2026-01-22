-- Add payroll_type field to distinguish between first and second fortnight
-- Values: 'adelanto' (first half - salary advance) or 'segunda' (second half - final payment)

-- Create enum for payroll type
CREATE TYPE public.payroll_type AS ENUM ('adelanto', 'segunda', 'completa');

-- Add column to payroll_batches
ALTER TABLE public.payroll_batches 
ADD COLUMN payroll_type public.payroll_type DEFAULT 'completa';

-- Add helpful comment
COMMENT ON COLUMN public.payroll_batches.payroll_type IS 
  'Type of payroll: adelanto (1st fortnight - salary advance), segunda (2nd fortnight - final), completa (full month)';