export type GridShortcut = 'copy' | 'paste' | 'undo' | 'redo' | 'selectAll' | null;

/** Само каквото ни трябва от KeyboardEvent — за да е функцията чиста и тестваема. */
type KeyLike = {
  key: string;
  /** Физическият клавиш (`KeyC`), независим от подредбата. */
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/**
 * Разпознава прякия път, независимо от клавиатурната подредба.
 *
 * ⚠️ Защо не само `e.key`: `key` дава буквата според активната подредба, тоест на
 * **българска** подредба Ctrl+C идва като `key === 'с'` (кирилско) и сравнението с
 * латинско `'c'` не хваща — копирането тихо не се случваше. `code` дава физическия
 * клавиш (`KeyC`) и решава това.
 *
 * ⚠️ Защо не само `e.code`: на подредби като AZERTY физическият `KeyA` е клавишът,
 * надписан Q — там потребителят очаква да важи надписът, тоест `key`.
 *
 * Затова приемаме и двете: съвпадение по физически клавиш ИЛИ по изписана буква.
 */
function matches(e: KeyLike, letter: string): boolean {
  return e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;
}

export function detectGridShortcut(e: KeyLike): GridShortcut {
  if (!e.ctrlKey && !e.metaKey) return null;

  if (matches(e, 'c')) return 'copy';
  if (matches(e, 'v')) return 'paste';
  if (matches(e, 'y')) return 'redo';
  if (matches(e, 'z')) return e.shiftKey ? 'redo' : 'undo';
  if (matches(e, 'a')) return 'selectAll';

  return null;
}
