/**
 * Какво от бяла дъска (Excalidraw) пазим в `whiteboards.data` и как го четем обратно.
 *
 * Пазим само нарисуваното и цвета на фона. Мащаб, позиция, избрани елементи и
 * т.н. са временно състояние на екрана — записът им би правил запис при всяко
 * мръдване на мишката. Изтритите елементи (Excalidraw ги държи за „назад")
 * също не отиват в базата.
 *
 * Модулът нарочно не внася Excalidraw — така тестовете и списъкът с дъски не
 * свалят тежката библиотека.
 */

type SceneElement = { isDeleted?: boolean };

export interface StoredScene<E = unknown> {
  elements: E[];
  appState: { viewBackgroundColor?: string };
}

export function toStoredScene<E extends SceneElement>(
  elements: readonly E[],
  appState: { viewBackgroundColor?: string },
): StoredScene<E> {
  return {
    elements: elements.filter((el) => !el.isDeleted),
    appState: { viewBackgroundColor: appState.viewBackgroundColor },
  };
}

/** Безопасно чете колоната `data`: нова дъска е `{}`, а повреден запис не бива да чупи страницата. */
export function fromStoredScene(data: unknown): StoredScene {
  const scene = data && typeof data === 'object' && !Array.isArray(data) ? (data as Partial<StoredScene>) : {};
  const appState = scene.appState && typeof scene.appState === 'object' && !Array.isArray(scene.appState)
    ? scene.appState
    : {};
  return {
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState,
  };
}
