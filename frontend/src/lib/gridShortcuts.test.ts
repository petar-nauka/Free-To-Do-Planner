import { describe, it, expect } from 'vitest';
import { detectGridShortcut } from './gridShortcuts';

/** Събитие с латинска подредба. */
function latin(key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) {
  return {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  };
}

/**
 * Събитие с БЪЛГАРСКА подредба: `key` е кирилската буква, `code` остава физическият
 * клавиш. Точно това чупеше копирането — кодът сравняваше `key` с латинско 'c'.
 */
function bg(cyrillicKey: string, physicalCode: string, mods: Partial<{ ctrlKey: boolean; shiftKey: boolean }> = {}) {
  return { key: cyrillicKey, code: physicalCode, ctrlKey: false, metaKey: false, shiftKey: false, ...mods };
}

describe('detectGridShortcut — латинска подредба', () => {
  it('Ctrl+C копира, Ctrl+V поставя', () => {
    expect(detectGridShortcut(latin('c', { ctrlKey: true }))).toBe('copy');
    expect(detectGridShortcut(latin('v', { ctrlKey: true }))).toBe('paste');
  });

  it('Ctrl+Z отменя, Ctrl+Y и Ctrl+Shift+Z повтарят', () => {
    expect(detectGridShortcut(latin('z', { ctrlKey: true }))).toBe('undo');
    expect(detectGridShortcut(latin('y', { ctrlKey: true }))).toBe('redo');
    expect(detectGridShortcut(latin('z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
  });

  it('Ctrl+A избира всичко', () => {
    expect(detectGridShortcut(latin('a', { ctrlKey: true }))).toBe('selectAll');
  });

  it('работи и с Cmd на Mac', () => {
    expect(detectGridShortcut(latin('c', { metaKey: true }))).toBe('copy');
  });

  it('работи и с главни букви (при натиснат Shift/CapsLock)', () => {
    expect(detectGridShortcut(latin('C', { ctrlKey: true }))).toBe('copy');
  });
});

describe('detectGridShortcut — БЪЛГАРСКА подредба (бъгът)', () => {
  it('Ctrl+C копира, макар key да е кирилско „с"', () => {
    expect(detectGridShortcut(bg('с', 'KeyC', { ctrlKey: true }))).toBe('copy');
  });

  it('Ctrl+V поставя, макар key да е кирилско „ж"', () => {
    expect(detectGridShortcut(bg('ж', 'KeyV', { ctrlKey: true }))).toBe('paste');
  });

  it('Ctrl+Z отменя, макар key да е кирилско „я"', () => {
    expect(detectGridShortcut(bg('я', 'KeyZ', { ctrlKey: true }))).toBe('undo');
  });

  it('Ctrl+Shift+Z повтаря на кирилица', () => {
    expect(detectGridShortcut(bg('я', 'KeyZ', { ctrlKey: true, shiftKey: true }))).toBe('redo');
  });

  it('Ctrl+A избира всичко, макар key да е кирилско „а"', () => {
    expect(detectGridShortcut(bg('а', 'KeyA', { ctrlKey: true }))).toBe('selectAll');
  });
});

describe('detectGridShortcut — какво НЕ е пряк път', () => {
  it('буква без Ctrl не е пряк път (това е писане в клетка)', () => {
    expect(detectGridShortcut(latin('c'))).toBeNull();
    expect(detectGridShortcut(bg('с', 'KeyC'))).toBeNull();
  });

  it('Ctrl с друга буква не е пряк път', () => {
    expect(detectGridShortcut(latin('b', { ctrlKey: true }))).toBeNull();
  });

  it('не се подвежда по липсващ code (стари браузъри)', () => {
    expect(detectGridShortcut({ key: 'c', code: '', ctrlKey: true, metaKey: false, shiftKey: false })).toBe('copy');
    expect(detectGridShortcut({ key: 'с', code: '', ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
  });
});
