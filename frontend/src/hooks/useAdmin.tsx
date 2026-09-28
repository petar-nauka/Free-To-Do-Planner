import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!error && !!data);
      setLoading(false);
    };

    checkAdminRole();
  }, [user]);

  return { isAdmin, loading };
}

export function useUsers() {
  const [users, setUsers] = useState<Array<{
    user_id: string;
    email: string | null;
    display_name: string | null;
    created_at: string;
    role: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, created_at');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setLoading(false);
      return;
    }

    // Merge profiles with roles
    const usersWithRoles = (profiles || []).map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.user_id);
      return {
        ...profile,
        role: userRole?.role || 'user'
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, refetch: fetchUsers };
}
