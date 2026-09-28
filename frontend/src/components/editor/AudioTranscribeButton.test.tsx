import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// vi.mock factories are hoisted above top-level const/let declarations, so any
// mock state referenced inside them must be created via vi.hoisted() to avoid
// a TDZ error (documented Vitest pattern; matches useAiSettings.test.tsx /
// useSonioxTranscription.test.tsx in this repo).
const { start, stop, useAiSettingsMock } = vi.hoisted(() => {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    useAiSettingsMock: vi.fn(),
  };
});

let recording = false;

vi.mock('@/hooks/useSonioxTranscription', () => ({
  useSonioxTranscription: (p: any) => {
    (globalThis as any).__onFinalText = p.onFinalText;
    return { isRecording: recording, error: null, start, stop };
  },
}));

vi.mock('@/hooks/useAiSettings', () => ({
  useAiSettings: useAiSettingsMock,
}));

import { AudioTranscribeButton } from './AudioTranscribeButton';

const withKey = {
  settings: { stt_model: 'stt-rt-v5', stt_language: 'bg' },
  secretStatus: [{ provider: 'soniox', is_set: true, last4: 'AB12' }],
  isLoading: false,
};

const withoutKey = {
  settings: { stt_model: 'stt-rt-v5', stt_language: 'bg' },
  secretStatus: [],
  isLoading: false,
};

beforeEach(() => {
  start.mockClear();
  stop.mockClear();
  useAiSettingsMock.mockReset();
  recording = false;
});

describe('AudioTranscribeButton', () => {
  it('inserts final text into the editor', () => {
    useAiSettingsMock.mockReturnValue(withKey);

    const insertContent = vi.fn().mockReturnValue({ run: vi.fn() });
    const focus = vi.fn().mockReturnValue({ insertContent });
    const chain = vi.fn().mockReturnValue({ focus });
    const editor = { chain } as any;

    render(<AudioTranscribeButton editor={editor} />);
    (globalThis as any).__onFinalText('Здравей');
    expect(insertContent).toHaveBeenCalledWith('Здравей');
  });

  it('is disabled without a Soniox key', () => {
    useAiSettingsMock.mockReturnValue(withoutKey);

    const editor = { chain: vi.fn() } as any;
    render(<AudioTranscribeButton editor={editor} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('starts recording on click', () => {
    useAiSettingsMock.mockReturnValue(withKey);
    recording = false;

    const editor = { chain: vi.fn() } as any;
    render(<AudioTranscribeButton editor={editor} />);
    fireEvent.click(screen.getByRole('button'));
    expect(start).toHaveBeenCalled();
  });
});
