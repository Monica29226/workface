-- =====================================================
-- COMPREHENSIVE EMPLOYEE DATA SECURITY FIX
-- Database-Level Column Security & Encryption
-- =====================================================

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First, let's create a backup of existing employee data
CREATE TABLE IF NOT EXISTS employees_backup AS SELECT * FROM employees;

-- Add encrypted columns for most sensitive data
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS cedula_encrypted TEXT,
ADD COLUMN IF NOT EXISTS iban_encrypted TEXT, 
ADD COLUMN IF NOT EXISTS nss_ccss_encrypted TEXT,
ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;

-- Create a function to get encryption key (in production, this would be from vault)
CREATE OR REPLACE FUNCTION get_encryption_key() 
RETURNS TEXT AS $$
BEGIN
  -- In production, this should retrieve from Supabase Vault
  -- For now, using a consistent key per installation
  RETURN encode(digest(current_database() || 'employee_data_key_2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing sensitive data to encrypted columns
UPDATE employees 
SET 
  cedula_encrypted = CASE 
    WHEN cedula IS NOT NULL THEN pgp_sym_encrypt(cedula, get_encryption_key())
    ELSE NULL 
  END,
  iban_encrypted = CASE 
    WHEN iban IS NOT NULL THEN pgp_sym_encrypt(iban, get_encryption_key())
    ELSE NULL 
  END,
  nss_ccss_encrypted = CASE 
    WHEN nss_ccss IS NOT NULL THEN pgp_sym_encrypt(nss_ccss, get_encryption_key())
    ELSE NULL 
  END,
  email_encrypted = CASE 
    WHEN email IS NOT NULL THEN pgp_sym_encrypt(email, get_encryption_key())
    ELSE NULL 
  END,
  phone_encrypted = CASE 
    WHEN phone IS NOT NULL THEN pgp_sym_encrypt(phone, get_encryption_key())
    ELSE NULL 
  END
WHERE cedula_encrypted IS NULL OR iban_encrypted IS NULL OR nss_ccss_encrypted IS NULL 
   OR email_encrypted IS NULL OR phone_encrypted IS NULL;

-- Create secure decrypt functions with role checking
CREATE OR REPLACE FUNCTION decrypt_cedula(encrypted_cedula TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only HR roles can decrypt cedula
  IF NOT EXISTS (
    SELECT 1 FROM company_users 
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  ) THEN
    RETURN CASE 
      WHEN encrypted_cedula IS NOT NULL THEN '***-****-****'
      ELSE NULL 
    END;
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_cedula, get_encryption_key());
EXCEPTION 
  WHEN others THEN 
    RETURN '***-ERROR-***';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION decrypt_iban(encrypted_iban TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only HR roles can decrypt IBAN
  IF NOT EXISTS (
    SELECT 1 FROM company_users 
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  ) THEN
    RETURN CASE 
      WHEN encrypted_iban IS NOT NULL THEN 'CR**************XXXX'
      ELSE NULL 
    END;
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_iban, get_encryption_key());
EXCEPTION 
  WHEN others THEN 
    RETURN 'CR**ERROR**XXXX';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION decrypt_nss_ccss(encrypted_nss TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Only HR roles can decrypt SSN
  IF NOT EXISTS (
    SELECT 1 FROM company_users 
    WHERE user_id = auth.uid() 
    AND active = true 
    AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
  ) THEN
    RETURN CASE 
      WHEN encrypted_nss IS NOT NULL THEN '*********'
      ELSE NULL 
    END;
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_nss, get_encryption_key());
EXCEPTION 
  WHEN others THEN 
    RETURN '***ERROR***';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION decrypt_email_safe(encrypted_email TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  LIMIT 1;
  
  -- HR roles see full email
  IF user_role = ANY (ARRAY['Owner', 'Admin', 'Payroll']) THEN
    RETURN pgp_sym_decrypt(encrypted_email, get_encryption_key());
  END IF;
  
  -- Managers see masked email
  IF user_role = 'Manager' THEN
    DECLARE
      full_email TEXT := pgp_sym_decrypt(encrypted_email, get_encryption_key());
      email_parts TEXT[];
    BEGIN
      email_parts := string_to_array(full_email, '@');
      RETURN substr(email_parts[1], 1, 2) || '***@' || email_parts[2];
    END;
  END IF;
  
  -- Others see restricted
  RETURN '***@***.***';
EXCEPTION 
  WHEN others THEN 
    RETURN '***@ERROR.***';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION decrypt_phone_safe(encrypted_phone TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  LIMIT 1;
  
  -- HR roles see full phone
  IF user_role = ANY (ARRAY['Owner', 'Admin', 'Payroll']) THEN
    RETURN pgp_sym_decrypt(encrypted_phone, get_encryption_key());
  END IF;
  
  -- Managers see partially masked phone
  IF user_role = 'Manager' THEN
    DECLARE
      full_phone TEXT := pgp_sym_decrypt(encrypted_phone, get_encryption_key());
    BEGIN
      RETURN substr(full_phone, 1, 4) || '-****';
    END;
  END IF;
  
  -- Others see restricted
  RETURN '****-****';
EXCEPTION 
  WHEN others THEN 
    RETURN '****-ERROR';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- CREATE SECURE EMPLOYEE VIEWS
-- =====================================================

-- HR View (full access)
CREATE OR REPLACE VIEW employees_hr_view AS 
SELECT 
  id, company_id, first_name, last_name,
  decrypt_cedula(cedula_encrypted) as cedula,
  decrypt_email_safe(email_encrypted) as email,
  decrypt_phone_safe(phone_encrypted) as phone,
  decrypt_iban(iban_encrypted) as iban,
  decrypt_nss_ccss(nss_ccss_encrypted) as nss_ccss,
  department, cost_center, hire_date, active,
  birth_date, civil_status, children_count,
  manager_id, termination_date, has_pension, has_garnishment,
  payment_currency, created_at, updated_at
FROM employees
WHERE company_id IN (
  SELECT company_users.company_id
  FROM company_users
  WHERE company_users.user_id = auth.uid() 
  AND company_users.active = true 
  AND company_users.role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
);

-- Manager View (basic data + masked sensitive fields)
CREATE OR REPLACE VIEW employees_manager_view AS 
SELECT 
  id, company_id, first_name, last_name,
  '***-****-****' as cedula,
  decrypt_email_safe(email_encrypted) as email,
  decrypt_phone_safe(phone_encrypted) as phone,
  'CR**MASKED**XXXX' as iban,
  '*********' as nss_ccss,
  department, cost_center, hire_date, active,
  NULL::date as birth_date, 
  civil_status, 
  NULL::integer as children_count,
  manager_id, termination_date, 
  NULL::boolean as has_pension, 
  NULL::boolean as has_garnishment,
  payment_currency, created_at, updated_at
FROM employees
WHERE (
  -- Managers can see their supervised employees
  manager_id = auth.uid() OR
  -- Or employees in their company if they have manager role
  company_id IN (
    SELECT company_users.company_id
    FROM company_users
    WHERE company_users.user_id = auth.uid() 
    AND company_users.active = true 
    AND company_users.role::text = 'Manager'
  )
) AND active = true;

-- Employee View (very limited, own profile only)
CREATE OR REPLACE VIEW employees_self_view AS 
SELECT 
  id, company_id, first_name, last_name,
  '***RESTRICTED***' as cedula,
  '***@***.***' as email,
  '****-****' as phone,
  '***RESTRICTED***' as iban,
  '***RESTRICTED***' as nss_ccss,
  department, cost_center, hire_date, active,
  NULL::date as birth_date, 
  NULL::text as civil_status, 
  NULL::integer as children_count,
  manager_id, termination_date, 
  NULL::boolean as has_pension, 
  NULL::boolean as has_garnishment,
  NULL::text as payment_currency, 
  created_at, updated_at
FROM employees
WHERE id IN (
  SELECT employee_user_mapping.employee_id 
  FROM employee_user_mapping 
  WHERE employee_user_mapping.user_id = auth.uid()
);

-- =====================================================
-- SECURE FUNCTIONS FOR CRUD OPERATIONS
-- =====================================================

-- Function to securely insert employee data
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE RLS POLICIES FOR ENHANCED SECURITY
-- =====================================================

-- Revoke direct access to employees table
REVOKE ALL ON employees FROM public;

-- Grant access only to the secure views based on roles
GRANT SELECT ON employees_hr_view TO authenticated;
GRANT SELECT ON employees_manager_view TO authenticated; 
GRANT SELECT ON employees_self_view TO authenticated;

-- Create a unified secure view that routes to appropriate view based on role
CREATE OR REPLACE VIEW employees_secure AS 
SELECT * FROM employees_hr_view
WHERE EXISTS (
  SELECT 1 FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
)
UNION ALL
SELECT * FROM employees_manager_view
WHERE EXISTS (
  SELECT 1 FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  AND role::text = 'Manager'
) AND NOT EXISTS (
  SELECT 1 FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll'])
)
UNION ALL
SELECT * FROM employees_self_view
WHERE NOT EXISTS (
  SELECT 1 FROM company_users 
  WHERE user_id = auth.uid() 
  AND active = true 
  AND role::text = ANY (ARRAY['Owner', 'Admin', 'Payroll', 'Manager'])
);

-- Grant access to the unified secure view
GRANT SELECT ON employees_secure TO authenticated;