import { Users, Crown, Pencil, Eye, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProjectMembers, ProjectMember } from '@/hooks/useProjectMembers';
import { useAuth } from '@/hooks/useAuth';
import { Project } from '@/hooks/useProjects';
import { useState } from 'react';

interface TeamMembersDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: () => void;
}

export function TeamMembersDialog({ project, open, onOpenChange, onInvite }: TeamMembersDialogProps) {
  const { user } = useAuth();
  const { members, isLoading, updateMemberRole, removeMember } = useProjectMembers(project.id);
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);

  const isOwner = project.user_id === user?.id;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3" />;
      case 'editor':
        return <Pencil className="w-3 h-3" />;
      default:
        return <Eye className="w-3 h-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'editor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getInitials = (member: ProjectMember) => {
    const name = member.profile?.display_name || member.invited_email;
    return name.slice(0, 2).toUpperCase();
  };

  const handleRemove = async () => {
    if (removingMember) {
      await removeMember.mutateAsync(removingMember.id);
      setRemovingMember(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </DialogTitle>
            <DialogDescription>
              Manage who has access to "{project.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Owner */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.email?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">You</p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <Crown className="w-3 h-3" />
                Owner
              </Badge>
            </div>

            {/* Members */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">
                No team members yet. Invite someone to collaborate!
              </p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {getInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {member.profile?.display_name || member.invited_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.status === 'pending' ? 'Invitation pending' : member.invited_email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isOwner && member.status === 'accepted' ? (
                      <Select 
                        value={member.role} 
                        onValueChange={(v) => updateMemberRole.mutate({ memberId: member.id, role: v as 'editor' | 'viewer' })}
                      >
                        <SelectTrigger className="w-28 h-8 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="editor" className="rounded-lg text-xs">Editor</SelectItem>
                          <SelectItem value="viewer" className="rounded-lg text-xs">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                        {getRoleIcon(member.role)}
                        {member.status === 'pending' ? 'Pending' : member.role}
                      </Badge>
                    )}
                    
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => setRemovingMember(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {isOwner && (
            <div className="pt-2">
              <Button onClick={onInvite} className="w-full rounded-xl">
                Invite Member
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMember?.profile?.display_name || removingMember?.invited_email} will no longer have access to this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemove}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
