import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'company_manager' | 'employee';

interface UserRoleData {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  companyAccess: string[]; // IDs de empresas a las que tiene acceso
}

export function useUserRole(): UserRoleData {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [companyAccess, setCompanyAccess] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchUserRole(user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setRole(null);
        setCompanyAccess([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (rolesError) throw rolesError;

      // Set highest role (admin > company_manager > employee)
      if (rolesData) {
        setRole(rolesData.role as AppRole);
      }

      // Fetch company access
      const { data: companyData, error: companyError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId);

      if (companyError) throw companyError;

      if (companyData) {
        setCompanyAccess(companyData.map(c => c.company_id));
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    } finally {
      setLoading(false);
    }
  };

  return { user, role, loading, companyAccess };
}
