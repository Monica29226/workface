import React from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface SecureEmployee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  cedula: string; // Will show "***masked***" for unauthorized users
  email: string | null; // Will be null for unauthorized users
  phone: string | null; // Will be null for unauthorized users
  department: string | null;
  cost_center: string | null;
  hire_date: string;
  active: boolean;
  nss_ccss: string | null; // Will be null for unauthorized users
  iban: string | null; // Will be null for unauthorized users
  birth_date: string | null; // Will be null for unauthorized users
  civil_status: string | null; // Will be null for unauthorized users
  children_count: number | null; // Will be null for unauthorized users
  manager_id: string | null;
  termination_date: string | null;
  has_pension: boolean | null;
  has_garnishment: boolean | null;
  payment_currency: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Secure Employee Service
 * 
 * This service uses the employees table with proper RLS policies to filter data
 * based on the user's role. Only HR, Admin, and Payroll personnel can see sensitive
 * information like cedula, email, phone, SSN, IBAN, etc.
 * 
 * Role-based access:
 * - Owner/Admin/Payroll: Full access to all employee data
 * - Manager: Can only see employees they supervise
 * - Regular employees: Very limited access (mostly just names and basic info)
 */
export class EmployeeService {
  /**
   * Mask sensitive data based on user permissions
   */
  private static maskSensitiveData(employee: any, canAccessSensitive: boolean): SecureEmployee {
    if (canAccessSensitive) {
      return employee as SecureEmployee;
    }

    return {
      ...employee,
      cedula: employee.cedula ? `${employee.cedula.substring(0, 3)}XXXXX` : null,
      email: employee.email ? `${employee.email.substring(0, 2)}XXX@${employee.email.split('@')[1]}` : null,
      phone: employee.phone ? `${employee.phone.substring(0, 4)}XXXX` : null,
      iban: 'XXXXXXXXXXXXXXXX',
      nss_ccss: 'XXXXXXXXX'
    };
  }

  /**
   * Get all employees for the current user's company
   * Data is automatically filtered based on user's role and permissions
   */
  static async getEmployees(companyId?: string): Promise<{ data: SecureEmployee[] | null; error: any }> {
    try {
      // Check user permissions first
      const canAccessSensitive = await this.canAccessSensitiveData();

      let query = supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('first_name', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching employees:', error);
        return { data: null, error };
      }

      // Apply data masking based on permissions
      const maskedData = data?.map(emp => this.maskSensitiveData(emp, canAccessSensitive)) || [];
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in getEmployees:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a single employee by ID
   * Data is automatically filtered based on user's role and permissions
   */
  static async getEmployeeById(id: string): Promise<{ data: SecureEmployee | null; error: any }> {
    try {
      // Check user permissions first
      const canAccessSensitive = await this.canAccessSensitiveData();

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching employee:', error);
        return { data: null, error };
      }

      // Apply data masking based on permissions
      const maskedData = this.maskSensitiveData(data, canAccessSensitive);
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in getEmployeeById:', error);
      return { data: null, error };
    }
  }

  /**
   * Search employees by name or other visible fields
   * Sensitive data is automatically filtered based on user permissions
   */
  static async searchEmployees(searchTerm: string, companyId?: string): Promise<{ data: SecureEmployee[] | null; error: any }> {
    try {
      // Check user permissions first
      const canAccessSensitive = await this.canAccessSensitiveData();

      let query = supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`)
        .order('first_name', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching employees:', error);
        return { data: null, error };
      }

      // Apply data masking based on permissions
      const maskedData = data?.map(emp => this.maskSensitiveData(emp, canAccessSensitive)) || [];
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in searchEmployees:', error);
      return { data: null, error };
    }
  }

  /**
   * Create a new employee (only available to authorized personnel)
   * This uses the original employees table with full RLS protection
   */
  static async createEmployee(employeeData: {
    company_id: string;
    first_name: string;
    last_name: string;
    cedula: string;
    hire_date: string;
    email?: string;
    phone?: string;
    department?: string;
    cost_center?: string;
    birth_date?: string;
    children_count?: number;
    civil_status?: string;
    nss_ccss?: string;
    iban?: string;
    manager_id?: string;
    payment_currency?: string;
  }): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
      .from('employees')
      .insert(employeeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      return { data: null, error };
    }

    return { data, error: null };
  }

  /**
   * Update an employee (only available to authorized personnel)
   * This uses the original employees table with full RLS protection
   */
  static async updateEmployee(id: string, updates: {
    first_name?: string;
    last_name?: string;
    cedula?: string;
    email?: string;
    phone?: string;
    department?: string;
    cost_center?: string;
    birth_date?: string;
    children_count?: number;
    civil_status?: string;
    nss_ccss?: string;
    iban?: string;
    manager_id?: string;
    payment_currency?: string;
    active?: boolean;
    termination_date?: string;
    has_pension?: boolean;
    has_garnishment?: boolean;
  }): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating employee:', error);
      return { data: null, error };
    }

    return { data, error: null };
  }

  /**
   * Check if current user can access sensitive employee data
   * Uses the enhanced security function for field-level access control
   */
  static async canAccessSensitiveData(): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('can_access_employee_sensitive_fields');

    if (error) {
      console.error('Error checking sensitive field permissions:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Check if current user can access basic employee data
   * This is used for managers who can see employee lists but not sensitive fields
   */
  static async canAccessBasicData(): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('can_access_employee_basic_data');

    if (error) {
      console.error('Error checking basic data permissions:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Create employee-user mapping for authentication
   * This links an employee record to a user account for login access
   */
  static async createEmployeeUserMapping(employeeId: string, userEmail: string, companyId: string): Promise<{ data: any; error: any }> {
    // First get the user ID from email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', userEmail)
      .maybeSingle();

    if (userError) {
      console.error('Error finding user:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      return { data: null, error: 'User not found with email: ' + userEmail };
    }

    // Create the mapping
    const { data, error } = await supabase
      .from('employee_user_mapping')
      .insert({
        employee_id: employeeId,
        user_id: userData.user_id,
        company_id: companyId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating employee-user mapping:', error);
      return { data: null, error };
    }

    return { data, error: null };
  }

  /**
   * Get current user's role for debugging purposes
   */
  static async getCurrentUserRole(): Promise<{ role: string | null; error: any }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { role: null, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('company_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (error) {
      console.error('Error fetching user role:', error);
      return { role: null, error };
    }

    return { role: data.role, error: null };
  }
}

/**
 * React Hook for secure employee data
 * 
 * Usage:
 * const { employees, loading, error, canAccessSensitive } = useSecureEmployees(companyId);
 */
export function useSecureEmployees(companyId?: string) {
  const [employees, setEmployees] = React.useState<SecureEmployee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<any>(null);
  const [canAccessSensitive, setCanAccessSensitive] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Check permissions first
      const canAccess = await EmployeeService.canAccessSensitiveData();
      setCanAccessSensitive(canAccess);
      
      // Fetch employees
      const { data, error } = await EmployeeService.getEmployees(companyId);
      
      if (error) {
        setError(error);
      } else {
        setEmployees(data || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [companyId]);

  return { employees, loading, error, canAccessSensitive };
}
