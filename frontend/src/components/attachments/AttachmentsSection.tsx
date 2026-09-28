import { useRef, useState } from 'react';
import { Paperclip, Upload, X, Download, FileIcon, Image, FileText as FileTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAttachments, Attachment } from '@/hooks/useAttachments';
import { validateFileUpload } from '@/lib/fileValidation';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';

interface AttachmentsSectionProps {
  projectId: string;
  taskId?: string;
  noteId?: string;
  compact?: boolean;
  maxFileSizeMb?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null) {
  if (contentType?.startsWith('image/')) return Image;
  if (contentType?.includes('pdf') || contentType?.includes('document')) return FileTextIcon;
  return FileIcon;
}

export function AttachmentsSection({ projectId, taskId, noteId, compact, maxFileSizeMb }: AttachmentsSectionProps) {
  const { t } = useTranslation();
  const { attachments, uploadAttachment, deleteAttachment, getDownloadUrl } = useAttachments(projectId, { taskId, noteId });
  const { toast } = useToast();
  const { getSetting } = useAppSettings();
  const effectiveMaxMb = maxFileSizeMb ?? (parseInt(getSetting('max_file_size_mb') || '4') || 4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      // Pre-validate before sending to the upload mutation (better UX)
      const validation = validateFileUpload(file, { maxSizeMb: effectiveMaxMb });
      if (!validation.valid) {
        toast({
          title: t('attachments.uploadBlocked', 'Файлът е блокиран'),
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }
      uploadAttachment.mutate({ file, taskId, noteId });
    });
  };

  const handleDownload = async (attachment: Attachment) => {
    const url = await getDownloadUrl(attachment.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="w-4 h-4" />
          {t('attachments.title', 'Файлове')}
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground">({attachments.length})</span>
          )}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          <Upload className="w-3 h-3 mr-1" />
          {uploadAttachment.isPending ? t('common.loading') : t('attachments.upload', 'Качи')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-3 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          attachments.length === 0 && !isDragging && "py-4"
        )}
      >
        {attachments.length === 0 && !isDragging && (
          <p className="text-xs text-muted-foreground">
            {t('attachments.dropHere', 'Плъзни файлове тук или натисни "Качи"')}
          </p>
        )}

        {isDragging && (
          <p className="text-xs text-primary font-medium">
            {t('attachments.dropNow', 'Пусни файловете тук')}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.content_type);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md"
                      onClick={() => handleDownload(att)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md text-destructive hover:text-destructive"
                      onClick={() => deleteAttachment.mutate(att)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
