-- =====================================================
-- CRITICAL FIX: Security Issues from Previous Migration
-- =====================================================

-- Fix infinite recursion by using security definer functions properly
-- Drop problematic views and recreate without recursion

DROP VIEW IF EXISTS employees_secure CASCADE;
DROP VIEW IF EXISTS employees_hr_view CASCADE;
DROP VIEW IF EXISTS employees_manager_view CASCADE; 
DROP VIEW IF EXISTS employees_self_view CASCADE;

-- Fix the decrypt functions to avoid recursion
-- Use a simpler approach that doesn't query company_users within RLS context

CREATE OR REPLACE FUNCTION decrypt_cedula_safe(encrypted_cedula TEXT)
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  -- Return masked value if no encryption data or not authenticated
  IF encrypted_cedula IS NULL OR current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try to decrypt, return masked on any failure
  BEGIN
    RETURN pgp_sym_decrypt(encrypted_cedula, get_encryption_key());
  EXCEPTION 
    WHEN others THEN 
      RETURN '***-****-****';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_iban_safe(encrypted_iban TEXT)
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF encrypted_iban IS NULL OR current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(encrypted_iban, get_encryption_key());
  EXCEPTION 
    WHEN others THEN 
      RETURN 'CR**************XXXX';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_nss_ccss_safe(encrypted_nss TEXT)
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF encrypted_nss IS NULL OR current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(encrypted_nss, get_encryption_key());
  EXCEPTION 
    WHEN others THEN 
      RETURN '*********';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_email_safe_simple(encrypted_email TEXT)
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF encrypted_email IS NULL OR current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(encrypted_email, get_encryption_key());
  EXCEPTION 
    WHEN others THEN 
      RETURN '***@***.***';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_phone_safe_simple(encrypted_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF encrypted_phone IS NULL OR current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(encrypted_phone, get_encryption_key());
  EXCEPTION 
    WHEN others THEN 
      RETURN '****-****';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Update all functions to have proper search_path
CREATE OR REPLACE FUNCTION get_encryption_key() 
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(current_database() || 'employee_data_key_2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Recreate the security functions without recursion
CREATE OR REPLACE FUNCTION can_access_employee_sensitive_fields()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_employee_basic_data()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll', 'Manager'])
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS on employee_user_mapping table
ALTER TABLE employee_user_mapping ENABLE ROW LEVEL SECURITY;

-- Enable RLS on employees_backup table
ALTER TABLE employees_backup ENABLE ROW LEVEL SECURITY;

-- Create a simple policy for employees_backup (HR access only)
CREATE POLICY "HR can access employee backup" 
ON employees_backup 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = ANY (ARRAY['Owner', 'Admin'])
  )
);

-- Update the insert function with proper search_path
CREATE OR REPLACE FUNCTION insert_employee_secure(
  p_company_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_cedula TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL,
  p_nss_ccss TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_cost_center TEXT DEFAULT NULL,
  p_hire_date DATE DEFAULT CURRENT_DATE,
  p_birth_date DATE DEFAULT NULL,
  p_civil_status TEXT DEFAULT NULL,
  p_children_count INTEGER DEFAULT 0,
  p_manager_id UUID DEFAULT NULL,
  p_payment_currency TEXT DEFAULT 'CRC'
)
RETURNS UUID AS $$
DECLARE
  new_employee_id UUID;
BEGIN
  -- Check if user has HR access
  IF NOT EXISTS (
    SELECT 1 FROM company_users 
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
    AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create employee';
  END IF;

  -- Insert with encryption
  INSERT INTO employees (
    company_id, first_name, last_name,
    cedula_encrypted, email_encrypted, phone_encrypted,
    iban_encrypted, nss_ccss_encrypted,
    department, cost_center, hire_date, birth_date,
    civil_status, children_count, manager_id, payment_currency
  ) VALUES (
    p_company_id, p_first_name, p_last_name,
    CASE WHEN p_cedula IS NOT NULL THEN pgp_sym_encrypt(p_cedula, get_encryption_key()) ELSE NULL END,
    CASE WHEN p_email IS NOT NULL THEN pgp_sym_encrypt(p_email, get_encryption_key()) ELSE NULL END,
    CASE WHEN p_phone IS NOT NULL THEN pgp_sym_encrypt(p_phone, get_encryption_key()) ELSE NULL END,
    CASE WHEN p_iban IS NOT NULL THEN pgp_sym_encrypt(p_iban, get_encryption_key()) ELSE NULL END,
    CASE WHEN p_nss_ccss IS NOT NULL THEN pgp_sym_encrypt(p_nss_ccss, get_encryption_key()) ELSE NULL END,
    p_department, p_cost_center, p_hire_date, p_birth_date,
    p_civil_status, p_children_count, p_manager_id, p_payment_currency
  )
  RETURNING id INTO new_employee_id;

  RETURN new_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restore access to employees table (the RLS policies will handle security)
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;

-- Grant access to the new encrypted employee functions
GRANT EXECUTE ON FUNCTION decrypt_cedula_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_iban_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_nss_ccss_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_email_safe_simple(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_phone_safe_simple(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_employee_secure(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, INTEGER, UUID, TEXT) TO authenticated;