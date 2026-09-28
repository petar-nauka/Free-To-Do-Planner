import { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectMembers } from '@/hooks/useProjectMembers';

interface InviteMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ projectId, open, onOpenChange }: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const { inviteMember } = useProjectMembers(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await inviteMember.mutateAsync({ projectId, email: email.trim().toLowerCase(), role });
    setEmail('');
    setRole('viewer');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to collaborate on this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'editor' | 'viewer')}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="editor" className="rounded-lg">
                  <div>
                    <div className="font-medium">Editor</div>
                    <div className="text-xs text-muted-foreground">Can view, create, and edit</div>
                  </div>
                </SelectItem>
                <SelectItem value="viewer" className="rounded-lg">
                  <div>
                    <div className="font-medium">Viewer</div>
                    <div className="text-xs text-muted-foreground">Can only view content</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviteMember.isPending || !email.trim()}
              className="rounded-xl"
            >
              {inviteMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
