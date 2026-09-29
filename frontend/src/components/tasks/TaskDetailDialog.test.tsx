import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));
vi.mock('@/hooks/useArchivedTasks', () => ({
  useArchivedTasks: () => ({ archiveTask: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock('@/hooks/useTaskComments', () => ({ useTaskComments: () => ({ comments: [] }) }));
vi.mock('@/hooks/useTimeTracking', () => ({
  useTimeTracking: () => ({
    activeTimer: null,
    startTimer: { mutate: vi.fn(), isPending: false },
    stopTimer: { mutate: vi.fn(), isPending: false },
  }),
  useTaskTotalTime: () => ({ data: 0 }),
  formatDuration: () => '',
}));
vi.mock('@/components/attachments/AttachmentsSection', () => ({ AttachmentsSection: () => null }));
vi.mock('@/components/tasks/EditTaskDialog', () => ({ EditTaskDialog: () => null }));

import { TaskDetailDialog } from './TaskDetailDialog';
import type { Task } from '@/hooks/useTasks';

const task = {
  id: 't1',
  project_id: 'p1',
  title: 'Задача',
  priority: 'medium',
  status: 'new',
  note_id: 'n1',
  spreadsheet_id: 's1',
} as unknown as Task;

// Повтаря връзките от Dashboard: отваряне = нов адрес, затваряне на задачата =
// замяна на адреса с таба „Задачи".
function Harness() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <TaskDetailDialog
        task={task}
        open={location.pathname === '/p/x/tasks/t1'}
        onOpenChange={(open) => { if (!open) navigate('/p/x/tasks', { replace: true }); }}
        onOpenNote={(id) => navigate(`/p/x/notes/${id}`)}
        onOpenSpreadsheet={(id) => navigate(`/p/x/sheets/${id}`)}
      />
    </>
  );
}

function renderAtTask() {
  render(
    <MemoryRouter initialEntries={['/p/x/tasks/t1']}>
      <Harness />
    </MemoryRouter>,
  );
}

describe('TaskDetailDialog — свързани елементи', () => {
  it('„Отвори свързаната бележка" води до бележката', () => {
    renderAtTask();
    fireEvent.click(screen.getByTestId('task-detail-open-note'));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/x/notes/n1');
    expect(screen.queryByTestId('task-detail-dialog')).not.toBeInTheDocument();
  });

  it('„Отвори свързаната таблица" води до таблицата', () => {
    renderAtTask();
    fireEvent.click(screen.getByTestId('task-detail-open-spreadsheet'));
    expect(screen.getByTestId('location')).toHaveTextContent('/p/x/sheets/s1');
  });
});
