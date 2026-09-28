import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above top-level const/let declarations, so any
// mock state referenced inside them must be created via vi.hoisted() to avoid
// a TDZ error (documented Vitest pattern; matches useAiSettings.test.tsx).
const { lastOptionsRef, startMock, stopMock, cancelMock } = vi.hoisted(() => {
  return {
    lastOptionsRef: { current: null as any },
    startMock: vi.fn(),
    stopMock: vi.fn().mockResolvedValue(undefined),
    cancelMock: vi.fn(),
  };
});

vi.mock('@soniox/speech-to-text-web', () => ({
  SonioxClient: vi.fn().mockImplementation((opts: any) => {
    lastOptionsRef.current = opts;
    return {
      start: (startOpts: any) => {
        lastOptionsRef.current = { ...opts, ...startOpts };
        startMock(startOpts);
        opts.onStarted?.();
      },
      stop: stopMock,
      cancel: cancelMock,
    };
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: { apiKey: 'tmp-123' }, error: null }) } },
}));

import { useSonioxTranscription } from './useSonioxTranscription';

beforeEach(() => {
  startMock.mockClear();
  stopMock.mockClear();
  cancelMock.mockClear();
  lastOptionsRef.current = null;
});

describe('useSonioxTranscription', () => {
  it('starts recording and passes language/model to Soniox', async () => {
    const onFinalText = vi.fn();
    const { result } = renderHook(() => useSonioxTranscription({ onFinalText, language: 'bg', model: 'stt-rt-v5' }));

    await act(async () => { await result.current.start(); });

    await waitFor(() => expect(result.current.isRecording).toBe(true));
    expect(startMock).toHaveBeenCalled();
    expect(lastOptionsRef.current.model).toBe('stt-rt-v5');
    expect(lastOptionsRef.current.languageHints).toEqual(['bg']);
  });

  it('emits only newly-final tokens via onFinalText', async () => {
    const onFinalText = vi.fn();
    const { result } = renderHook(() => useSonioxTranscription({ onFinalText, language: 'bg' }));
    await act(async () => { await result.current.start(); });

    // Simulate a partial result callback from the library:
    act(() => {
      lastOptionsRef.current.onPartialResult({
        tokens: [
          { text: 'Здравей', is_final: true },
          { text: ' свят', is_final: false },
        ],
      });
    });
    expect(onFinalText).toHaveBeenCalledWith('Здравей');
    expect(onFinalText).toHaveBeenCalledTimes(1); // non-final не се вмъква
  });

  it('with translateTo, sends one-way translation config and inserts only translated tokens', async () => {
    const onFinalText = vi.fn();
    const { result } = renderHook(() =>
      useSonioxTranscription({ onFinalText, language: 'bg', translateTo: 'en' })
    );
    await act(async () => { await result.current.start(); });

    // One-way translation config is sent to Soniox:
    expect(lastOptionsRef.current.translation).toEqual({ type: 'one_way', target_language: 'en' });

    // Stream carries both original (bg) and translated (en) tokens; only the translated
    // final tokens are inserted into the note.
    act(() => {
      lastOptionsRef.current.onPartialResult({
        tokens: [
          { text: 'Здравей', is_final: true, translation_status: 'original' },
          { text: 'Hello', is_final: true, translation_status: 'translation' },
          { text: ' there', is_final: false, translation_status: 'translation' },
        ],
      });
    });
    expect(onFinalText).toHaveBeenCalledWith('Hello');
    expect(onFinalText).toHaveBeenCalledTimes(1);
  });

  it('cancels the live Soniox session on unmount (e.g. note switch mid-dictation)', async () => {
    const onFinalText = vi.fn();
    const { result, unmount } = renderHook(() => useSonioxTranscription({ onFinalText, language: 'bg' }));

    await act(async () => { await result.current.start(); });
    await waitFor(() => expect(result.current.isRecording).toBe(true));

    unmount();

    expect(cancelMock).toHaveBeenCalledTimes(1);
  });
});
