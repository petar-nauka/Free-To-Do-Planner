import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { navigate, useAllTasksMock } = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAllTasksMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

vi.mock('@/hooks/useAllTasks', () => ({ useAllTasks: useAllTasksMock }));
// Частичен мок — `@/i18n` (внесен от компонента за локала на датите) ползва
// initReactI18next от истинския модул.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

import { PostponedTasksCard } from './PostponedTasksCard';

function task(id: string, daysAgo: number, extra: Record<string, unknown> = {}) {
  const stamp = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    id,
    title: `Задача ${id}`,
    project_id: 'p1',
    project_name: 'Проект 1',
    status: 'new',
    priority: 'high',
    due_date: null,
    created_at: stamp,
    updated_at: stamp,
    ...extra,
  };
}

beforeEach(() => {
  navigate.mockClear();
  useAllTasksMock.mockReset();
  localStorage.clear();
});

describe('PostponedTasksCard', () => {
  it('показва задачите без движение 30+ дни и от колко дни стоят', () => {
    useAllTasksMock.mockReturnValue({ data: [task('a', 45), task('b', 5)], isLoading: false });

    render(<PostponedTasksCard />);

    expect(screen.getByTestId('postponed-task-a')).toBeInTheDocument();
    expect(screen.queryByTestId('postponed-task-b')).not.toBeInTheDocument();
    expect(screen.getByText('стои от 45 дни')).toBeInTheDocument();
  });

  it('клик върху ред отваря задачата', () => {
    useAllTasksMock.mockReturnValue({ data: [task('a', 45)], isLoading: false });

    render(<PostponedTasksCard />);
    fireEvent.click(screen.getByTestId('postponed-task-a'));

    expect(navigate).toHaveBeenCalledWith('/p/proekt-1-p1/tasks/zadacha-a-a');
  });

  it('показва „Топ 10 от N", когато отложените са повече от 10', () => {
    const many = Array.from({ length: 14 }, (_, i) => task(`t${i}`, 40 + i));
    useAllTasksMock.mockReturnValue({ data: many, isLoading: false });

    render(<PostponedTasksCard />);

    expect(screen.getByTestId('postponed-tasks-count')).toHaveTextContent('Топ 10 от 14');
    expect(screen.getAllByTestId(/^postponed-task-/)).toHaveLength(10);
  });

  it('запомня избрания праг в localStorage', () => {
    useAllTasksMock.mockReturnValue({ data: [task('a', 45)], isLoading: false });

    render(<PostponedTasksCard />);
    // 45 дни е > 30, но < 60 → при праг 60 списъкът трябва да се изпразни.
    fireEvent.keyDown(screen.getByTestId('postponed-days-filter'), { key: 'Enter' });
    fireEvent.click(screen.getByText('Над 60 дни'));

    expect(localStorage.getItem('postponed_tasks_days')).toBe('60');
    expect(screen.queryByTestId('postponed-task-a')).not.toBeInTheDocument();
    expect(screen.getByText('Няма отложени задачи 🎉')).toBeInTheDocument();
  });

  it('чете запомнения праг при първи рендер', () => {
    localStorage.setItem('postponed_tasks_days', '90');
    useAllTasksMock.mockReturnValue({ data: [task('a', 45)], isLoading: false });

    render(<PostponedTasksCard />);

    expect(screen.queryByTestId('postponed-task-a')).not.toBeInTheDocument();
  });

  it('предлага във филтъра само проекти с отложени задачи', () => {
    useAllTasksMock.mockReturnValue({
      data: [task('a', 40), task('b', 3, { project_id: 'p2', project_name: 'Пресен проект' })],
      isLoading: false,
    });

    render(<PostponedTasksCard />);
    fireEvent.keyDown(screen.getByTestId('postponed-project-filter'), { key: 'Enter' });

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Проект 1');
    expect(options).not.toContain('Пресен проект');
  });
});
