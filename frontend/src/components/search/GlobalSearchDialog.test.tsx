import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// vi.mock factories са hoist-нати над top-level декларациите → мок състоянието се
// създава с vi.hoisted() (същият модел като AudioTranscribeButton.test.tsx).
const { navigate, useGlobalSearchMock } = vi.hoisted(() => ({
  navigate: vi.fn(),
  useGlobalSearchMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@/hooks/useGlobalSearch', () => ({ useGlobalSearch: useGlobalSearchMock }));
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ projects: [] }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

import { GlobalSearchDialog } from './GlobalSearchDialog';

beforeEach(() => {
  navigate.mockClear();
  useGlobalSearchMock.mockReset();
});

describe('GlobalSearchDialog — клик върху резултат', () => {
  it('навигира до бележката (бъгът: диалогът се затваряше без навигация)', () => {
    useGlobalSearchMock.mockReturnValue({
      results: [{ type: 'note', id: 'n1', title: 'КУРСОВЕ 2026', projectId: 'p1' }],
      isLoading: false,
    });

    const onOpenChange = vi.fn();
    render(<GlobalSearchDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId('search-result-note-n1'));

    expect(navigate).toHaveBeenCalledWith('/p/p1/notes/kursove-2026-n1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('навигира до задачата', () => {
    useGlobalSearchMock.mockReturnValue({
      results: [{ type: 'task', id: 't1', title: 'Задача', projectId: 'p1' }],
      isLoading: false,
    });

    render(<GlobalSearchDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('search-result-task-t1'));

    expect(navigate).toHaveBeenCalledWith('/p/p1/tasks/zadacha-t1');
  });

  it('навигира до проекта', () => {
    useGlobalSearchMock.mockReturnValue({
      results: [{ type: 'project', id: 'p1', title: 'Проект' }],
      isLoading: false,
    });

    render(<GlobalSearchDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('search-result-project-p1'));

    expect(navigate).toHaveBeenCalledWith('/p/proekt-p1');
  });
});
