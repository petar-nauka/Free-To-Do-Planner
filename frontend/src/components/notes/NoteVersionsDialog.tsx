import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Eye, RotateCcw, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNoteVersions, NoteVersion } from '@/hooks/useNotes';
import { SafeHtml } from '@/components/common/SafeHtml';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

interface NoteVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
  onRestore: (version: NoteVersion) => void;
}

export function NoteVersionsDialog({ open, onOpenChange, noteId, onRestore }: NoteVersionsDialogProps) {
  const { t } = useTranslation();
  const dateLocale = i18n.language === 'bg' ? bg : enUS;
  const { versions, isLoading } = useNoteVersions(noteId);
  const [previewVersion, setPreviewVersion] = useState<NoteVersion | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPreviewVersion(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl rounded-2xl" data-testid="note-versions-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {t('notes.versionHistory', 'История на промените')}
            {versions.length > 0 && <Badge variant="secondary">{versions.length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh]">
          {/* Versions list */}
          <ScrollArea className="border rounded-xl bg-muted/30 h-[400px]">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('common.loading', 'Зареждане...')}
                </p>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <History className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  {t('notes.noVersions', 'Все още няма запазени версии за тази бележка.')}
                  <p className="text-xs mt-2 opacity-70">
                    {t('notes.versionsHint', 'Версиите се записват при всяка промяна на заглавието или съдържанието.')}
                  </p>
                </div>
              ) : (
                versions.map((v, idx) => (
                  <button
                    key={v.id}
                    data-testid={`note-version-${v.id}`}
                    onClick={() => setPreviewVersion(v)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-lg transition-colors border',
                      previewVersion?.id === v.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate flex-1">{v.title || 'Untitled'}</span>
                      {idx === 0 && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                          {t('notes.latestPrevious', 'Последна')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: dateLocale })}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {format(new Date(v.created_at), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Preview pane */}
          <div className="border rounded-xl p-3 bg-card overflow-hidden h-[400px] flex flex-col">
            {previewVersion ? (
              <>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <span className="font-semibold text-sm truncate">{previewVersion.title}</span>
                  <Button
                    size="sm"
                    variant="default"
                    className="rounded-xl"
                    data-testid="note-version-restore-btn"
                    onClick={() => {
                      onRestore(previewVersion);
                      onOpenChange(false);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {t('notes.restoreVersion', 'Възстанови')}
                  </Button>
                </div>
                <ScrollArea className="flex-1 pr-2">
                  {previewVersion.content ? (
                    <SafeHtml html={previewVersion.content} />
                  ) : (
                    <p className="opacity-50 text-sm">(празно)</p>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm">
                <div>
                  <Eye className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  {t('notes.selectVersion', 'Изберете версия за преглед')}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t('common.close', 'Затвори')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
