import { lazy, Suspense, type ComponentProps } from 'react';
import type { RichTextEditor as RichTextEditorType } from './RichTextEditor';

// Редакторът (tiptap) е най-тежката библиотека в приложението и трябва само
// когато бележка е отворена. Затова се сваля при първа употреба, а не с
// първия екран. `import type` горе не тегли код — само описанието на props.
const RichTextEditor = lazy(() =>
  import('./RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

type Props = ComponentProps<typeof RichTextEditorType>;

/** Същият редактор, същите props — само че се зарежда при първо отваряне. */
export function LazyRichTextEditor(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-[200px] rounded-xl bg-muted animate-pulse" />}>
      <RichTextEditor {...props} />
    </Suspense>
  );
}
