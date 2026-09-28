import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { HIGHLIGHT_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { AudioTranscribeButton } from './AudioTranscribeButton';
import { shouldSyncEditorContent } from './editorSync';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  enableAudio?: boolean;
}

export function RichTextEditor({ content, onChange, placeholder, enableAudio = false }: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false, // We handle clicks manually below
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'tiptap-table' },
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[200px] p-4',
      },
      handleClick: (view, pos, event) => {
        // Handle link clicks manually to avoid iframe blocking
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link && link.href) {
          event.preventDefault();
          event.stopPropagation();
          window.open(link.href, '_blank', 'noopener,noreferrer');
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    // Не пре-зареждай съдържанието, докато редакторът е фокусиран (потребителят пише/диктува):
    // auto-save → refetch иначе връща остаряло съдържание, setContent нулира курсора и текстът
    // спира да влиза по средата на диктовката. Синхронизираме само при външна промяна (смяна на
    // бележка / зареждане), когато редакторът не е фокусиран.
    if (shouldSyncEditorContent(editor.isFocused, content, editor.getHTML())) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) return null;

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkUrl('');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="border-b border-border p-2 flex flex-wrap gap-1 bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('bold') && "bg-muted")}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('italic') && "bg-muted")}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('underline') && "bg-muted")}
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('strike') && "bg-muted")}
        >
          <Strikethrough className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('heading', { level: 1 }) && "bg-muted")}
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('heading', { level: 2 }) && "bg-muted")}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('heading', { level: 3 }) && "bg-muted")}
        >
          <Heading3 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('bulletList') && "bg-muted")}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('orderedList') && "bg-muted")}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('table') && "bg-muted")}
            >
              <TableIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <Plus className="w-4 h-4 mr-2" />
              Вмъкни таблица 3×3
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()}>
              Добави колона
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}>
              Добави ред
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()}>
              Изтрий колона
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()}>
              Изтрий ред
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Изтрий таблица
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border mx-1 self-center" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('link') && "bg-muted")}
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 rounded-xl p-3" align="start">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="rounded-lg"
              />
              <Button onClick={setLink} size="sm" className="rounded-lg">
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-lg h-8 w-8 p-0", editor.isActive('highlight') && "bg-muted")}
            >
              <Highlighter className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl p-2" align="start">
            <div className="flex gap-1 flex-wrap">
              {HIGHLIGHT_COLORS.map(({ name, class: colorClass }) => (
                <button
                  key={name}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: name }).run()}
                  className={cn("w-6 h-6 rounded-md transition-transform hover:scale-110", colorClass)}
                />
              ))}
              <button
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                className="w-6 h-6 rounded-md border border-border text-xs"
              >
                ✕
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {enableAudio && editor && (
          <>
            <div className="w-px h-6 bg-border mx-1 self-center" />
            <AudioTranscribeButton editor={editor} />
          </>
        )}
      </div>


      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}
