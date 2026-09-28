import { describe, it, expect } from 'vitest';
import { shouldSyncEditorContent } from './editorSync';

describe('shouldSyncEditorContent', () => {
  it('syncs an external change when the editor is NOT focused (note switch / load)', () => {
    expect(shouldSyncEditorContent(false, '<p>new</p>', '<p>old</p>')).toBe(true);
  });

  it('does NOT sync while the editor is focused (avoids clobbering the caret mid-dictation)', () => {
    // The bug: auto-save refetch pushed back stale content and reset the cursor while typing/dictating.
    expect(shouldSyncEditorContent(true, '<p>stale from server</p>', '<p>live dictation…</p>')).toBe(false);
  });

  it('does not sync when content is unchanged', () => {
    expect(shouldSyncEditorContent(false, '<p>same</p>', '<p>same</p>')).toBe(false);
    expect(shouldSyncEditorContent(true, '<p>same</p>', '<p>same</p>')).toBe(false);
  });
});
