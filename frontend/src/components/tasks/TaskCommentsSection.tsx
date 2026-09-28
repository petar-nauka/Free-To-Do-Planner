import { useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTaskComments } from '@/hooks/useTaskComments';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface TaskCommentsSectionProps {
  taskId: string;
}

export function TaskCommentsSection({ taskId }: TaskCommentsSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { comments, isLoading, addComment, deleteComment } = useTaskComments(taskId);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync(newComment.trim());
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        {t('tasks.comments', 'Коментари')} ({comments.length})
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map(comment => (
            <div
              key={comment.id}
              className={cn(
                "rounded-xl p-3 text-sm",
                comment.user_id === user?.id
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-xs">
                  {comment.user_display_name || comment.user_email || 'User'}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-md"
                      onClick={() => deleteComment.mutate(comment.id)}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          {t('tasks.noComments', 'Няма коментари все още')}
        </p>
      )}

      {/* New comment input */}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('tasks.addComment', 'Напиши коментар...')}
          className="rounded-xl resize-none min-h-[40px] text-sm"
          rows={1}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          className="rounded-xl flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
