import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { mockRpc, mockUpsert, mockMaybeSingle, mockGetUser } = vi.hoisted(() => {
  return {
    mockRpc: vi.fn(),
    mockUpsert: vi.fn().mockResolvedValue({ error: null }),
    mockMaybeSingle: vi.fn(),
    mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
      upsert: mockUpsert,
    })),
    rpc: mockRpc,
  },
}));

import { useAiSettings } from './useAiSettings';

beforeEach(() => {
  mockRpc.mockReset();
  mockUpsert.mockReset();
  mockMaybeSingle.mockReset();
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('useAiSettings', () => {
  it('loads settings and secret status', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { stt_provider: 'soniox', stt_model: 'stt-rt-v5', stt_language: 'bg',
        stt_translate_to: null, ai_provider: 'ollama', ai_base_url: null, ai_model: 'deepseek-v4-flash' },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ provider: 'soniox', is_set: true, last4: 'AB12' }], error: null });

    const { result } = renderHook(() => useAiSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings?.stt_language).toBe('bg');
    expect(result.current.secretStatus).toEqual([{ provider: 'soniox', is_set: true, last4: 'AB12' }]);
  });

  it('saveSecret calls the set_ai_secret RPC', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAiSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockRpc.mockClear();
    await act(async () => { await result.current.saveSecret('soniox', 'sk-test-1234'); });

    expect(mockRpc).toHaveBeenCalledWith('set_ai_secret', { p_provider: 'soniox', p_key: 'sk-test-1234' });
  });

  it('sets isLoading to false even when getUser rejects', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('auth error'));
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAiSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.settings).toBe(null);
    expect(result.current.secretStatus).toEqual([]);
  });
});
