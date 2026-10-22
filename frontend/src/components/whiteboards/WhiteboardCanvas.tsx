import './excalidrawAssets';
import { useEffect, useRef } from 'react';
import { Excalidraw, hashElementsVersion } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useWhiteboardScene } from '@/hooks/useWhiteboards';
import { toStoredScene, type StoredScene } from '@/lib/whiteboardScene';

/** Записваме, когато рисуването спре за толкова време — не при всяко движение на мишката. */
const SAVE_DELAY_MS = 1000;

interface WhiteboardCanvasProps {
  boardId: string;
  /** Наблюдателите виждат дъската, но не могат да я променят. */
  canEdit: boolean;
}

/** Самото платно. Тежкото (Excalidraw, ~350 KB) се сваля едва при отваряне — виж `WhiteboardsSection`. */
export default function WhiteboardCanvas({ boardId, canEdit }: WhiteboardCanvasProps) {
  const { scene, isLoading, saveScene } = useWhiteboardScene(boardId);
  const baseline = useRef<string | null>(null);
  const pending = useRef<StoredScene | null>(null);
  const timer = useRef<number>();

  const flush = () => {
    window.clearTimeout(timer.current);
    if (pending.current) saveScene.mutate(pending.current);
    pending.current = null;
  };
  // При излизане от дъската (Назад, друг таб) записваме недовършеното веднага.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const handleChange = (elements: readonly ExcalidrawElement[], appState: { viewBackgroundColor: string }) => {
    // onChange идва и при отваряне, и при всяко мръдване на мишката. Записваме
    // само когато се е променило нарисуваното или фонът. Първото извикване е
    // заредената дъска — тя е отправната точка, не промяна.
    const key = `${hashElementsVersion(elements)}|${appState.viewBackgroundColor}`;
    if (baseline.current === null || key === baseline.current) {
      baseline.current = key;
      return;
    }
    baseline.current = key;
    pending.current = toStoredScene(elements, appState);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  if (isLoading || !scene) {
    return <div className="h-full min-h-[400px] rounded-xl bg-muted animate-pulse" />;
  }

  return (
    <Excalidraw
      initialData={{
        elements: scene.elements as ExcalidrawElement[],
        appState: scene.appState,
        scrollToContent: true,
      }}
      onChange={canEdit ? handleChange : undefined}
      viewModeEnabled={!canEdit}
      theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
      langCode="bg-BG"
      UIOptions={{
        // Картинките се пазят вътре в дъската и биха я направили огромна — засега без тях.
        tools: { image: false },
        canvasActions: { toggleTheme: false, saveToActiveFile: false },
      }}
    />
  );
}
