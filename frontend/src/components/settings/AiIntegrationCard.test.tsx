import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const saveSecret = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useAiSettings', () => ({
  useAiSettings: () => ({
    settings: { stt_provider: 'soniox', stt_model: 'stt-rt-v5', stt_language: 'bg',
      stt_translate_to: null, ai_provider: 'ollama', ai_base_url: null, ai_model: 'deepseek-v4-flash' },
    secretStatus: [{ provider: 'soniox', is_set: true, last4: 'AB12' }],
    isLoading: false,
    saveSettings: vi.fn(), saveSecret, refetchSecretStatus: vi.fn(),
  }),
}));

import AiIntegrationCard from './AiIntegrationCard';

describe('AiIntegrationCard', () => {
  it('shows the Soniox section and masked key status', () => {
    render(<AiIntegrationCard />);
    expect(screen.getByText(/Гласови бележки/i)).toBeInTheDocument();
    expect(screen.getByText(/AB12/)).toBeInTheDocument(); // last4 индикатор
  });

  it('shows the Ollama section', () => {
    render(<AiIntegrationCard />);
    expect(screen.getByText(/AI модел/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('deepseek-v4-flash')).toBeInTheDocument();
  });
});
