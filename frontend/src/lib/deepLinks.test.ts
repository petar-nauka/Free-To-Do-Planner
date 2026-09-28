import { describe, it, expect } from 'vitest';
import {
  entitySegment,
  legacyPathToNew,
  notePath,
  parseEntityId,
  projectPath,
  projectTabPath,
  sheetPath,
  slugify,
  taskPath,
} from './deepLinks';

const PROJECT_ID = 'a1b2c3d4-5e6f-4890-abcd-ef1234567890';
const TASK_ID = '0f9e8d7c-6b5a-4321-9876-543210fedcba';

describe('slugify', () => {
  it('превръща кирилица в латиница по официалната транслитерация', () => {
    expect(slugify('Идеи за броя')).toBe('idei-za-broya');
  });

  it('покрива многознаковите букви ж, ч, ш, щ, ю, я', () => {
    expect(slugify('Жичка чаша щука юмрук ябълка')).toBe('zhichka-chasha-shtuka-yumruk-yabalka');
  });

  it('маха пунктуация и свива тиретата', () => {
    expect(slugify('Сайт: редизайн — фаза 2!')).toBe('sayt-redizayn-faza-2');
  });

  it('реже дългите имена до 50 знака', () => {
    const result = slugify('a'.repeat(120));
    expect(result).toHaveLength(50);
  });

  it('не оставя тире накрая след рязането', () => {
    expect(slugify(`${'b'.repeat(49)} втора дума`)).not.toMatch(/-$/);
  });

  it('връща празен низ за име само от емоджи', () => {
    expect(slugify('🔥🚀')).toBe('');
  });

  it('понася null и undefined', () => {
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('entitySegment', () => {
  it('долепя id-то без тирета след името', () => {
    expect(entitySegment('БГ Наука', PROJECT_ID)).toBe('bg-nauka-a1b2c3d45e6f4890abcdef1234567890');
  });

  it('дава сегмент само от id, когато име липсва', () => {
    expect(entitySegment(null, PROJECT_ID)).toBe('a1b2c3d45e6f4890abcdef1234567890');
  });
});

describe('parseEntityId', () => {
  it('чете id-то от последните 32 знака на сегмента', () => {
    expect(parseEntityId('bg-nauka-a1b2c3d45e6f4890abcdef1234567890')).toBe(PROJECT_ID);
  });

  it('приема и пълен UUID с тирета (стари линкове)', () => {
    expect(parseEntityId(PROJECT_ID)).toBe(PROJECT_ID);
  });

  it('връща null за боклук', () => {
    expect(parseEntityId('няма-такова-нещо')).toBeNull();
    expect(parseEntityId('')).toBeNull();
    expect(parseEntityId(undefined)).toBeNull();
  });

  it('връща null, когато последните 32 знака не са шестнайсетични', () => {
    expect(parseEntityId('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
  });

  it('обиколката име → сегмент → id връща оригиналното id', () => {
    for (const name of ['Сайт редизайн', '', 'Q4 2026 план', '🔥 спешно']) {
      expect(parseEntityId(entitySegment(name, TASK_ID))).toBe(TASK_ID);
    }
  });
});

describe('legacyPathToNew — старите линкове от имейлите', () => {
  const project = { id: PROJECT_ID, name: 'БГ Наука' };

  it('превежда линк към задача', () => {
    const params = new URLSearchParams(`project=${PROJECT_ID}&task=${TASK_ID}`);
    expect(legacyPathToNew(params, project)).toBe(
      '/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890/tasks/0f9e8d7c6b5a43219876543210fedcba',
    );
  });

  it('превежда линк към бележка', () => {
    const params = new URLSearchParams(`project=${PROJECT_ID}&note=${TASK_ID}`);
    expect(legacyPathToNew(params, project)).toContain('/notes/0f9e8d7c6b5a43219876543210fedcba');
  });

  it('превежда линк само към проект', () => {
    const params = new URLSearchParams(`project=${PROJECT_ID}`);
    expect(legacyPathToNew(params, project)).toBe('/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890');
  });

  it('връща null, когато няма стар параметър за превод', () => {
    expect(legacyPathToNew(new URLSearchParams('foo=bar'), project)).toBeNull();
  });

  it('игнорира ?task= / ?note=, които не са UUID (защита от подхвърлен адрес)', () => {
    // Старият параметър идва от адресната лента, тоест от когото и да е.
    // Ако не е id, не го вграждаме в пътя — отваряме само проекта.
    const params = new URLSearchParams(`project=${PROJECT_ID}&task=${encodeURIComponent('\\\\evil.example')}`);
    expect(legacyPathToNew(params, project)).toBe('/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890');
  });

  it('задачата бие бележката, ако по някаква причина има и двете', () => {
    const params = new URLSearchParams(`project=${PROJECT_ID}&task=${TASK_ID}&note=${PROJECT_ID}`);
    expect(legacyPathToNew(params, project)).toContain('/tasks/');
  });
});

describe('строителите на пътища', () => {
  const project = { id: PROJECT_ID, name: 'БГ Наука' };
  const task = { id: TASK_ID, title: 'Сайт редизайн' };

  it('проектът сочи към собствения си адрес', () => {
    expect(projectPath(project)).toBe('/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890');
  });

  it('табът се долепя след проекта', () => {
    expect(projectTabPath(project, 'notes')).toBe('/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890/notes');
  });

  it('задачата седи под таба tasks', () => {
    expect(taskPath(project, task)).toBe(
      '/p/bg-nauka-a1b2c3d45e6f4890abcdef1234567890/tasks/sayt-redizayn-0f9e8d7c6b5a43219876543210fedcba',
    );
  });

  it('бележката седи под таба notes', () => {
    expect(notePath(project, { id: TASK_ID, title: 'Идеи' })).toContain('/notes/idei-');
  });

  it('таблицата седи под таба sheets, не spreadsheets', () => {
    expect(sheetPath(project, { id: TASK_ID, name: 'Бюджет' })).toContain('/sheets/byudzhet-');
  });

  it('работи и когато имената липсват', () => {
    expect(taskPath({ id: PROJECT_ID }, { id: TASK_ID })).toBe(
      '/p/a1b2c3d45e6f4890abcdef1234567890/tasks/0f9e8d7c6b5a43219876543210fedcba',
    );
  });
});
