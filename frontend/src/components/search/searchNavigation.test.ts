import { describe, it, expect } from 'vitest';
import { buildSearchResultPath } from './searchNavigation';
import { parseEntityId } from '@/lib/deepLinks';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const NOTE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const TASK_ID = '99999999-8888-4777-8666-555555555555';

describe('buildSearchResultPath', () => {
  it('отваря проект', () => {
    expect(buildSearchResultPath({ type: 'project', id: PROJECT_ID, title: 'БГ Наука' })).toBe(
      '/p/bg-nauka-11111111222243338444555555555555'
    );
  });

  it('отваря бележка в нейния проект', () => {
    // Бъгът: кликът върху бележка само затваряше диалога — никаква навигация.
    expect(
      buildSearchResultPath({
        type: 'note',
        id: NOTE_ID,
        title: 'Идеи',
        projectId: PROJECT_ID,
        projectName: 'БГ Наука',
      })
    ).toBe('/p/bg-nauka-11111111222243338444555555555555/notes/idei-aaaaaaaabbbb4ccc8dddeeeeeeeeeeee');
  });

  it('отваря задача в нейния проект', () => {
    expect(
      buildSearchResultPath({
        type: 'task',
        id: TASK_ID,
        title: 'Сайт',
        projectId: PROJECT_ID,
        projectName: 'БГ Наука',
      })
    ).toBe('/p/bg-nauka-11111111222243338444555555555555/tasks/sayt-99999999888847778666555555555555');
  });

  it('строи разчитаем адрес и когато имената липсват', () => {
    const path = buildSearchResultPath({ type: 'task', id: TASK_ID, projectId: PROJECT_ID });
    const [, , projectSegment, , itemSegment] = path!.split('/');

    expect(parseEntityId(projectSegment)).toBe(PROJECT_ID);
    expect(parseEntityId(itemSegment)).toBe(TASK_ID);
  });

  it('връща null когато бележка/задача е без проект (няма накъде да навигираме)', () => {
    expect(buildSearchResultPath({ type: 'note', id: NOTE_ID })).toBeNull();
    expect(buildSearchResultPath({ type: 'task', id: TASK_ID })).toBeNull();
  });
});
