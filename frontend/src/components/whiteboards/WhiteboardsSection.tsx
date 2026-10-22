import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, PenTool, Trash2, ChevronLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { useWhiteboards, useCanEditProject } from '@/hooks/useWhiteboards';
import i18n from '@/i18n';

// Excalidraw е тежък (~350 KB) — сваля се едва когато дъска бъде отворена.
const WhiteboardCanvas = lazy(() => import('./WhiteboardCanvas'));

interface WhiteboardsSectionProps {
  projectId: string;
  /** Id на дъската, която адресът сочи, или null. */
  openBoardId?: string | null;
  /** Отваря/затваря дъска чрез навигация; null се връща към списъка. */
  onOpenBoard?: (board: { id: string; name?: string | null } | null) => void;
}

type NameDialog = { mode: 'create' } | { mode: 'rename'; id: string } | null;

export function WhiteboardsSection({ projectId, openBoardId, onOpenBoard }: WhiteboardsSectionProps) {
  const { t } = useTranslation();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const { whiteboards, isLoading, createWhiteboard, renameWhiteboard, deleteWhiteboard } = useWhiteboards(projectId);
  const canEdit = useCanEditProject(projectId);
  const [nameDialog, setNameDialog] = useState<NameDialog>(null);
  const [nameInput, setNameInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Коя дъска е отворена решава адресът — тук няма локално състояние за това.
  const selected = whiteboards.find((b) => b.id === openBoardId);

  const openNameDialog = (dialog: NonNullable<NameDialog>, name = '') => {
    setNameInput(name);
    setNameDialog(dialog);
  };

  const handleSaveName = async () => {
    if (!nameDialog) return;
    if (nameDialog.mode === 'create') {
      const board = await createWhiteboard.mutateAsync({ name: nameInput.trim() });
      onOpenBoard?.(board);
    } else if (nameInput.trim()) {
      await renameWhiteboard.mutateAsync({ id: nameDialog.id, name: nameInput.trim() });
    }
    setNameDialog(null);
  };

  const nameDialogEl = (
    <Dialog open={!!nameDialog} onOpenChange={(open) => !open && setNameDialog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {nameDialog?.mode === 'rename'
              ? t('whiteboards.rename', 'Преименувай дъската')
              : t('whiteboards.create', 'Нова дъска')}
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder={t('whiteboards.namePlaceholder', 'Име на дъската')}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
        />
        <DialogFooter>
          <Button onClick={handleSaveName} disabled={createWhiteboard.isPending || renameWhiteboard.isPending}>
            {nameDialog?.mode === 'rename' ? t('common.save', 'Запази') : t('common.create', 'Създай')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={() => onOpenBoard?.(null)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3
            className={canEdit ? 'font-semibold text-lg cursor-pointer hover:underline' : 'font-semibold text-lg'}
            onClick={() => canEdit && openNameDialog({ mode: 'rename', id: selected.id }, selected.name)}
          >
            {selected.name}
          </h3>
          <CopyLinkButton title={t('whiteboards.copyLink', 'Копирай линк към дъската')} />
          {canEdit === false && (
            <span className="text-xs text-muted-foreground ml-auto">
              {t('whiteboards.viewOnly', 'Само за преглед')}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-[500px] rounded-xl border border-border overflow-hidden" data-testid="whiteboard-canvas">
          {canEdit === undefined ? (
            <div className="h-full bg-muted animate-pulse" />
          ) : (
            <Suspense fallback={<div className="h-full bg-muted animate-pulse" />}>
              {/* key: при смяна на дъската платното се създава наново със своето съдържание */}
              <WhiteboardCanvas key={selected.id} boardId={selected.id} canEdit={canEdit} />
            </Suspense>
          )}
        </div>
        {nameDialogEl}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('whiteboards.title', 'Дъски')}</h3>
        {canEdit && (
          <Button size="sm" onClick={() => openNameDialog({ mode: 'create' })}>
            <Plus className="w-4 h-4 mr-1" />
            {t('whiteboards.create', 'Нова дъска')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t('common.loading', 'Зареждане...')}</div>
      ) : whiteboards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <PenTool className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{t('whiteboards.empty', 'Няма дъски. Създай първата и рисувай!')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {whiteboards.map((board) => (
            <Card
              key={board.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => onOpenBoard?.(board)}
              data-testid={`whiteboard-${board.id}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <PenTool className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{board.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(board.updated_at), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(board.id); }}
                    title={t('common.delete', 'Изтрий')}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {nameDialogEl}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('whiteboards.deleteConfirm', 'Изтриване на дъска')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('whiteboards.deleteWarning', 'Сигурен ли си? Рисунката ще бъде изтрита завинаги.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Отказ')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteWhiteboard.mutate(deleteId); setDeleteId(null); } }}
            >
              {t('common.delete', 'Изтрий')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
