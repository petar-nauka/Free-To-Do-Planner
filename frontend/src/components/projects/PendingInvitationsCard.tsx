import { Mail, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePendingInvitations, useProjectMembers } from '@/hooks/useProjectMembers';

export function PendingInvitationsCard() {
  const { invitations, isLoading } = usePendingInvitations();
  const { acceptInvitation, declineInvitation } = useProjectMembers(null);

  if (isLoading) {
    return null;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="w-4 h-4" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          You have {invitations.length} project invitation{invitations.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation: any) => (
          <div 
            key={invitation.id} 
            className="flex items-center justify-between p-3 bg-background rounded-xl"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {invitation.project?.name || 'Unknown Project'}
              </p>
              <p className="text-xs text-muted-foreground">
                Role: {invitation.role}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={() => declineInvitation.mutate(invitation.id)}
                disabled={declineInvitation.isPending}
              >
                {declineInvitation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => acceptInvitation.mutate(invitation.id)}
                disabled={acceptInvitation.isPending}
              >
                {acceptInvitation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
