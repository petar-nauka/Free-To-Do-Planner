import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string | null;
  role: 'owner' | 'editor' | 'viewer';
  invited_by: string;
  invited_email: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export function useProjectMembers(projectId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch profiles for members with user_id
      const membersWithProfiles = await Promise.all(
        data.map(async (member) => {
          if (member.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, email, avatar_url')
              .eq('user_id', member.user_id)
              .single();
            return { ...member, profile: profile || undefined };
          }
          return member;
        })
      );
      
      return membersWithProfiles as ProjectMember[];
    },
    enabled: !!projectId && !!user,
  });

  const inviteMember = useMutation({
    mutationFn: async ({ 
      projectId, 
      email, 
      role 
    }: { 
      projectId: string; 
      email: string; 
      role: 'editor' | 'viewer' 
    }) => {
      // Check if user exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      const { data, error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: existingProfile?.user_id || null,
          role,
          invited_by: user!.id,
          invited_email: email,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Invitation sent!', description: 'The user will see this project when they accept.' });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({ title: 'Already invited', description: 'This email has already been invited.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'editor' | 'viewer' }) => {
      const { data, error } = await supabase
        .from('project_members')
        .update({ role })
        .eq('id', memberId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Role updated!' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Member removed' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const acceptInvitation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase
        .rpc('accept_project_invitation', { p_member_id: memberId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      toast({ title: 'Invitation accepted!', description: 'You now have access to this project.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const declineInvitation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .rpc('decline_project_invitation', { p_member_id: memberId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      toast({ title: 'Invitation declined' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    members,
    isLoading,
    inviteMember,
    updateMemberRole,
    removeMember,
    acceptInvitation,
    declineInvitation,
  };
}

export function usePendingInvitations() {
  const { user } = useAuth();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['pending-invitations', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          *,
          project:projects(name, description, color, icon)
        `)
        .eq('invited_email', user.email)
        .eq('status', 'pending');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  return { invitations, isLoading };
}
