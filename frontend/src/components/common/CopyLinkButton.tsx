import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface CopyLinkButtonProps {
  /** Надпис в подсказката; по подразбиране „Копирай линк". */
  title?: string;
  className?: string;
}

/**
 * Копира АДРЕСА НА СТРАНИЦАТА такъв, какъвто е в момента.
 *
 * Нарочно не сглобява линк от id-та: след като всеки обект си има адрес,
 * адресната лента вече сочи точно към отвореното нещо, така че копираното
 * никога не може да се размине с видяното. Ако някога отваряме нещо без
 * навигация, това ще проличи веднага — копираният линк ще води другаде.
 */
export function CopyLinkButton({ title, className }: CopyLinkButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = window.location.href;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Резервен начин: без HTTPS браузърът не дава достъп до клипборда.
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      toast({
        title: t('tasks.linkCopied', 'Линкът е копиран'),
        description: t('tasks.linkCopiedDesc', 'Можете да го споделите с колеги.'),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t('common.error', 'Грешка'),
        description: t('tasks.linkCopyFailed', 'Не успях да копирам линка. Опитайте ръчно: ') + url,
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn('rounded-xl flex-shrink-0', className)}
      title={title ?? t('tasks.copyLink', 'Копирай линк')}
      data-testid="copy-link-btn"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
    </Button>
  );
}
