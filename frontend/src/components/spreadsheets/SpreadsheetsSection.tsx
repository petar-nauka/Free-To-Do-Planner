import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Table2, Trash2, Archive, ArchiveRestore, ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react';
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
import { useSpreadsheets } from '@/hooks/useSpreadsheets';
import { SpreadsheetEditor } from './SpreadsheetEditor';

interface SpreadsheetsSectionProps {
  projectId: string;
  /** Id на таблицата, която адресът сочи, или null. */
  openSheetId?: string | null;
  /** Отваря/затваря таблица чрез навигация; null се връща към списъка. */
  onOpenSheet?: (sheet: { id: string; name?: string | null } | null) => void;
}

const PAGE_SIZE = 10;

export function SpreadsheetsSection({ projectId, openSheetId, onOpenSheet }: SpreadsheetsSectionProps) {
  const { t } = useTranslation();
  const {
    spreadsheets, archivedSpreadsheets, isLoading,
    createSpreadsheet, duplicateSpreadsheet, archiveSpreadsheet, unarchiveSpreadsheet, deleteSpreadsheet
  } = useSpreadsheets(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archivePage, setArchivePage] = useState(0);

  // Коя таблица е отворена решава адресът — тук няма локално състояние за това.
  const selected = spreadsheets.find((s) => s.id === openSheetId);

  const handleCreate = async () => {
    await createSpreadsheet.mutateAsync({ name: newName || 'Untitled' });
    setNewName('');
    setCreateOpen(false);
  };

  if (selected) {
    return (
      <SpreadsheetEditor
        spreadsheet={selected}
        onBack={() => onOpenSheet?.(null)}
        projectId={projectId}
      />
    );
  }

  const totalArchivePages = Math.ceil(archivedSpreadsheets.length / PAGE_SIZE);
  const pagedArchived = archivedSpreadsheets.slice(archivePage * PAGE_SIZE, (archivePage + 1) * PAGE_SIZE);

  if (showArchive) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setShowArchive(false); setArchivePage(0); }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold">{t('spreadsheets.archive', 'Архив на таблици')}</h3>
          <span className="text-sm text-muted-foreground">({archivedSpreadsheets.length})</span>
        </div>

        {archivedSpreadsheets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Archive className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{t('spreadsheets.archiveEmpty', 'Няма архивирани таблици.')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pagedArchived.map((sheet) => (
                <Card key={sheet.id} className="group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Table2 className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{sheet.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sheet.column_definitions.length} {t('spreadsheets.columns', 'колони')} · {sheet.data.length} {t('spreadsheets.rows', 'реда')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => unarchiveSpreadsheet.mutate(sheet.id)}
                        title={t('common.restore', 'Възстанови')}
                      >
                        <ArchiveRestore className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(sheet.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalArchivePages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivePage === 0}
                  onClick={() => setArchivePage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {archivePage + 1} / {totalArchivePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivePage >= totalArchivePages - 1}
                  onClick={() => setArchivePage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Delete from archive dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('spreadsheets.deleteConfirm', 'Изтриване на таблица')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('spreadsheets.deleteWarning', 'Сигурен ли си? Тази операция е необратима.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel', 'Отказ')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => { if (deleteId) { deleteSpreadsheet.mutate(deleteId); setDeleteId(null); } }}
              >
                {t('common.delete', 'Изтрий')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('spreadsheets.title', 'Таблици')}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchive(true)}>
            <Archive className="w-4 h-4 mr-1" />
            {t('spreadsheets.archive', 'Архив')}
            {archivedSpreadsheets.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {archivedSpreadsheets.length}
              </span>
            )}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('spreadsheets.create', 'Нова таблица')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t('common.loading', 'Зареждане...')}</div>
      ) : spreadsheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Table2 className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">{t('spreadsheets.empty', 'Няма таблици. Създай първата!')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spreadsheets.map((sheet) => (
            <Card
              key={sheet.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => onOpenSheet?.(sheet)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Table2 className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sheet.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sheet.column_definitions.length} {t('spreadsheets.columns', 'колони')} · {sheet.data.length} {t('spreadsheets.rows', 'реда')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); duplicateSpreadsheet.mutate(sheet); }}
                    disabled={duplicateSpreadsheet.isPending}
                    title={t('spreadsheets.duplicateSheet', 'Дублирай')}
                    data-testid={`duplicate-sheet-${sheet.id}`}
                  >
                    <CopyPlus className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); archiveSpreadsheet.mutate(sheet.id); }}
                    title={t('spreadsheets.archiveSheet', 'Архивирай')}
                  >
                    <Archive className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(sheet.id); }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('spreadsheets.create', 'Нова таблица')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('spreadsheets.namePlaceholder', 'Име на таблицата')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createSpreadsheet.isPending}>
              {t('common.create', 'Създай')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('spreadsheets.deleteConfirm', 'Изтриване на таблица')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('spreadsheets.deleteWarning', 'Сигурен ли си? Тази операция е необратима.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Отказ')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteSpreadsheet.mutate(deleteId); setDeleteId(null); } }}
            >
              {t('common.delete', 'Изтрий')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
