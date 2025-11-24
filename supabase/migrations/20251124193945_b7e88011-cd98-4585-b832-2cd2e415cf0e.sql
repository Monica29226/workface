-- Add new role values to app_role enum
-- These must be committed before use
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ACL_SuperAdmin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ACL_PayrollSpecialist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ACL_Auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Client_Admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Client_HR';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Client_Viewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'Employee_Portal';