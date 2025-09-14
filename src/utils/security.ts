import { supabase } from "@/integrations/supabase/client";

/**
 * Security Utility Functions for Employee Data Protection
 * 
 * This module provides comprehensive security functions to protect sensitive
 * employee data according to role-based access controls.
 */

export interface SecurityContext {
  hasHRAccess: boolean;
  hasManagerAccess: boolean;
  hasBasicAccess: boolean;
  userRole: string | null;
  companyId: string | null;
}

/**
 * Get comprehensive security context for current user
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        hasHRAccess: false,
        hasManagerAccess: false,
        hasBasicAccess: false,
        userRole: null,
        companyId: null
      };
    }

    // Get user role and company
    const { data: userRole } = await supabase
      .from('company_users')
      .select('role, company_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (!userRole) {
      return {
        hasHRAccess: false,
        hasManagerAccess: false,
        hasBasicAccess: false,
        userRole: null,
        companyId: null
      };
    }

    // Check specific access levels
    const hrRoles = ['Owner', 'Admin', 'Payroll'];
    const managerRoles = ['Owner', 'Admin', 'Payroll', 'Manager'];
    const basicRoles = ['Owner', 'Admin', 'Payroll', 'Manager', 'Employee'];

    return {
      hasHRAccess: hrRoles.includes(userRole.role),
      hasManagerAccess: managerRoles.includes(userRole.role),
      hasBasicAccess: basicRoles.includes(userRole.role),
      userRole: userRole.role,
      companyId: userRole.company_id
    };
  } catch (error) {
    console.error('Error getting security context:', error);
    return {
      hasHRAccess: false,
      hasManagerAccess: false,
      hasBasicAccess: false,
      userRole: null,
      companyId: null
    };
  }
}

/**
 * Mask sensitive employee data based on access level
 */
export function maskEmployeeData(employee: any, securityContext: SecurityContext): any {
  if (securityContext.hasHRAccess) {
    // HR personnel see everything
    return employee;
  }

  if (securityContext.hasManagerAccess) {
    // Managers see basic data but sensitive fields are masked
    return {
      ...employee,
      cedula: employee.cedula ? `${employee.cedula.substring(0, 1)}-****-****` : null,
      email: employee.email ? `${employee.email.substring(0, 2)}***@${employee.email.split('@')[1] || '***'}` : null,
      phone: employee.phone ? `${employee.phone.substring(0, 4)}-****` : null,
      iban: '**MASKED**', // Hidden but shown as masked
      nss_ccss: '**MASKED**', // Hidden but shown as masked
      birth_date: null,
      children_count: null,
    };
  }

  // Regular employees or unauthorized users see very limited data
  return {
    ...employee,
    cedula: '**RESTRICTED**',
    email: '**RESTRICTED**',
    phone: '**RESTRICTED**',
    iban: '**RESTRICTED**',
    nss_ccss: '**RESTRICTED**',
    birth_date: null,
    civil_status: null,
    children_count: null,
    has_pension: null,
    has_garnishment: null,
    payment_currency: null,
  };
}

/**
 * Mask sensitive payroll data based on access level
 */
export function maskPayrollData(payroll: any, securityContext: SecurityContext): any {
  if (securityContext.hasHRAccess) {
    // HR personnel see everything
    return payroll;
  }

  // All other users cannot see salary information
  return {
    ...payroll,
    gross_salary: '**RESTRICTED**',
    net_salary: '**RESTRICTED**',
    social_charges: '**RESTRICTED**',
    salary_retention: '**RESTRICTED**',
    vacations_amount: '**RESTRICTED**',
    aguinaldo: '**RESTRICTED**',
  };
}

/**
 * Check if user can perform action on specific resource
 */
export async function canPerformAction(action: 'create' | 'read' | 'update' | 'delete', resource: 'employees' | 'payrolls' | 'contracts', resourceId?: string): Promise<boolean> {
  try {
    const context = await getSecurityContext();
    
    if (!context.hasBasicAccess) {
      return false;
    }

    switch (resource) {
      case 'employees':
        if (action === 'create' || action === 'delete') {
          return context.hasHRAccess;
        }
        if (action === 'update') {
          return context.hasHRAccess || context.hasManagerAccess;
        }
        if (action === 'read') {
          return context.hasBasicAccess;
        }
        break;

      case 'payrolls':
        if (action === 'create' || action === 'update' || action === 'delete') {
          return context.hasHRAccess;
        }
        if (action === 'read') {
          return context.hasHRAccess; // Only HR can read payroll data
        }
        break;

      case 'contracts':
        if (action === 'create' || action === 'update' || action === 'delete') {
          return context.hasHRAccess;
        }
        if (action === 'read') {
          return context.hasHRAccess || context.hasManagerAccess;
        }
        break;
    }

    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Sanitize query parameters to prevent unauthorized data access
 */
export function sanitizeCompanyQuery(baseQuery: any, requiredCompanyId?: string): any {
  // Always ensure queries are scoped to user's company
  if (requiredCompanyId) {
    return baseQuery.eq('company_id', requiredCompanyId);
  }
  
  // If no company specified, the RLS policies should handle it
  return baseQuery;
}

/**
 * Log security event for audit purposes
 */
export async function logSecurityEvent(event: {
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  level: 'info' | 'warning' | 'error';
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const context = await getSecurityContext();

    await supabase
      .from('audit_log')
      .insert({
        entidad: event.resource,
        entidad_id: event.resourceId || null,
        accion: event.action,
        motivo: `Security Event: ${event.details || 'No details'}`,
        user_id: user.id,
        company_id: context.companyId || null,
        antes: null,
        despues: { 
          security_level: event.level,
          user_role: context.userRole,
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Validate that user has access to specific company data
 */
export async function validateCompanyAccess(companyId: string): Promise<boolean> {
  try {
    const context = await getSecurityContext();
    return context.companyId === companyId;
  } catch (error) {
    console.error('Error validating company access:', error);
    return false;
  }
}

/**
 * Get filtered fields based on user access level
 */
export function getSelectableFields(resource: 'employees' | 'payrolls' | 'contracts', securityContext: SecurityContext): string {
  switch (resource) {
    case 'employees':
      if (securityContext.hasHRAccess) {
        return '*';
      } else if (securityContext.hasManagerAccess) {
        return 'id, company_id, first_name, last_name, department, cost_center, hire_date, active, manager_id, created_at, updated_at';
      } else {
        return 'id, first_name, last_name, department, active';
      }

    case 'payrolls':
      if (securityContext.hasHRAccess) {
        return '*';
      } else {
        return 'id, employee_id, period_id, status'; // Very limited for non-HR
      }

    case 'contracts':
      if (securityContext.hasHRAccess) {
        return '*';
      } else if (securityContext.hasManagerAccess) {
        return 'id, employee_id, company_id, start_date, end_date, status, contract_type, workday_type';
      } else {
        return 'id, employee_id, start_date, status';
      }

    default:
      return 'id';
  }
}