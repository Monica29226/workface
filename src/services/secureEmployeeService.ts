import React from 'react';
import { supabase } from "@/integrations/supabase/client";

export interface SecureEmployee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  cedula: string | null; // Masked for unauthorized users
  email: string | null; // Masked for unauthorized users
  phone: string | null; // Masked for unauthorized users
  department: string | null;
  cost_center: string | null;
  hire_date: string;
  active: boolean;
  nss_ccss: string | null; // Hidden for unauthorized users
  iban: string | null; // Hidden for unauthorized users
  birth_date: string | null; // Hidden for unauthorized users
  civil_status: string | null;
  children_count: number | null;
  manager_id: string | null;
  termination_date: string | null;
  has_pension: boolean | null;
  has_garnishment: boolean | null;
  payment_currency: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced Secure Employee Service with Multi-Level Security
 * 
 * Security Levels:
 * - HR Level (Owner/Admin/Payroll): Full access to all sensitive data
 * - Manager Level: Basic employee data for supervised employees only
 * - Employee Level: Only their own basic profile data
 * - No Access: Completely blocked
 */
export class SecureEmployeeService {
  /**
   * Check if user has HR-level access (can see sensitive data)
   */
  static async hasHRAccess(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_access_employee_sensitive_fields');
      if (error) {
        console.error('Error checking HR access:', error);
        return false;
      }
      return data === true;
    } catch (error) {
      console.error('Error in hasHRAccess:', error);
      return false;
    }
  }

  /**
   * Check if user has manager-level access (can see basic employee data)
   */
  static async hasManagerAccess(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('can_access_employee_basic_data');
      if (error) {
        console.error('Error checking manager access:', error);
        return false;
      }
      return data === true;
    } catch (error) {
      console.error('Error in hasManagerAccess:', error);
      return false;
    }
  }

  /**
   * Mask sensitive employee data based on user's access level
   */
  private static maskEmployeeData(employee: any, hasHRAccess: boolean, hasManagerAccess: boolean): SecureEmployee {
    if (hasHRAccess) {
      // HR personnel see everything
      return employee as SecureEmployee;
    }

    if (hasManagerAccess) {
      // Managers see basic data but sensitive fields are masked
      return {
        ...employee,
        cedula: employee.cedula ? `${employee.cedula.substring(0, 1)}-XXXX-XXXX` : null,
        email: employee.email ? `${employee.email.substring(0, 2)}***@${employee.email.split('@')[1]}` : null,
        phone: employee.phone ? `${employee.phone.substring(0, 4)}-XXXX` : null,
        iban: null, // Hidden completely
        nss_ccss: null, // Hidden completely
        birth_date: null, // Hidden completely
        children_count: null, // Hidden completely
      };
    }

    // Regular employees or unauthorized users see very limited data
    return {
      ...employee,
      cedula: null,
      email: null,
      phone: null,
      iban: null,
      nss_ccss: null,
      birth_date: null,
      civil_status: null,
      children_count: null,
      has_pension: null,
      has_garnishment: null,
      payment_currency: null,
    };
  }

  /**
   * Get employees with proper security filtering
   */
  static async getSecureEmployees(companyId?: string): Promise<{ data: SecureEmployee[] | null; error: any }> {
    try {
      // Check user's access levels
      const [hasHR, hasManager] = await Promise.all([
        this.hasHRAccess(),
        this.hasManagerAccess()
      ]);

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
        console.error('Error fetching secure employees:', error);
        return { data: null, error };
      }

      if (!data) {
        return { data: [], error: null };
      }

      // Apply appropriate data masking
      const maskedData = data.map(emp => this.maskEmployeeData(emp, hasHR, hasManager));
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in getSecureEmployees:', error);
      return { data: null, error };
    }
  }

  /**
   * Get single employee with security filtering
   */
  static async getSecureEmployeeById(id: string): Promise<{ data: SecureEmployee | null; error: any }> {
    try {
      const [hasHR, hasManager] = await Promise.all([
        this.hasHRAccess(),
        this.hasManagerAccess()
      ]);

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching secure employee:', error);
        return { data: null, error };
      }

      const maskedData = this.maskEmployeeData(data, hasHR, hasManager);
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in getSecureEmployeeById:', error);
      return { data: null, error };
    }
  }

  /**
   * Create employee (HR only)
   */
  static async createSecureEmployee(employeeData: {
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
  }): Promise<{ data: SecureEmployee | null; error: any }> {
    try {
      const hasAccess = await this.hasHRAccess();
      if (!hasAccess) {
        return { data: null, error: 'Insufficient permissions to create employee' };
      }

      const { data, error } = await supabase
        .from('employees')
        .insert(employeeData)
        .select()
        .single();

      if (error) {
        console.error('Error creating secure employee:', error);
        return { data: null, error };
      }

      return { data: data as SecureEmployee, error: null };
    } catch (error) {
      console.error('Error in createSecureEmployee:', error);
      return { data: null, error };
    }
  }

  /**
   * Update employee (HR only for sensitive fields, Manager for basic fields)
   */
  static async updateSecureEmployee(id: string, updates: {
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
  }): Promise<{ data: SecureEmployee | null; error: any }> {
    try {
      const [hasHR, hasManager] = await Promise.all([
        this.hasHRAccess(),
        this.hasManagerAccess()
      ]);

      // Determine what fields can be updated based on access level
      const sensitiveFields = ['cedula', 'email', 'phone', 'nss_ccss', 'iban', 'birth_date', 'children_count', 'civil_status', 'has_pension', 'has_garnishment'];
      
      if (!hasHR && !hasManager) {
        return { data: null, error: 'Insufficient permissions to update employee' };
      }

      // If user only has manager access, filter out sensitive fields
      let filteredUpdates = { ...updates };
      if (hasManager && !hasHR) {
        sensitiveFields.forEach(field => {
          if (field in filteredUpdates) {
            delete (filteredUpdates as any)[field];
          }
        });
      }

      const { data, error } = await supabase
        .from('employees')
        .update(filteredUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating secure employee:', error);
        return { data: null, error };
      }

      const maskedData = this.maskEmployeeData(data, hasHR, hasManager);
      return { data: maskedData, error: null };
    } catch (error) {
      console.error('Error in updateSecureEmployee:', error);
      return { data: null, error };
    }
  }
}

/**
 * React Hook for secure employee data
 */
export function useSecureEmployees(companyId?: string) {
  const [employees, setEmployees] = React.useState<SecureEmployee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<any>(null);
  const [hasHRAccess, setHasHRAccess] = React.useState(false);
  const [hasManagerAccess, setHasManagerAccess] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Check permissions
      const [hrAccess, managerAccess] = await Promise.all([
        SecureEmployeeService.hasHRAccess(),
        SecureEmployeeService.hasManagerAccess()
      ]);
      
      setHasHRAccess(hrAccess);
      setHasManagerAccess(managerAccess);
      
      // Fetch employees
      const { data, error } = await SecureEmployeeService.getSecureEmployees(companyId);
      
      if (error) {
        setError(error);
      } else {
        setEmployees(data || []);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [companyId]);

  return { 
    employees, 
    loading, 
    error, 
    hasHRAccess, 
    hasManagerAccess,
    refetch: () => {
      // Re-run the effect
      setLoading(true);
      const fetchData = async () => {
        const { data, error } = await SecureEmployeeService.getSecureEmployees(companyId);
        if (error) {
          setError(error);
        } else {
          setEmployees(data || []);
        }
        setLoading(false);
      };
      fetchData();
    }
  };
}