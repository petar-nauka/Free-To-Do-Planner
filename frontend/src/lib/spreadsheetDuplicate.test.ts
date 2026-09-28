import { describe, it, expect } from 'vitest';
import { buildDuplicatePayload, duplicateName } from './spreadsheetDuplicate';
import type { Spreadsheet } from '@/hooks/useSpreadsheets';

const source: Spreadsheet = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  project_id: '11111111-2222-4333-8444-555555555555',
  user_id: 'old-user',
  name: 'Жени учени - имейли - следене',
  data: [
    [{ value: 'Категория' }, { value: 'Подкаст' }],
    [{ value: 'AI', bold: true, bgColor: '#fff3cd' }, { value: 'https://youtube.com/x' }],
  ],
  column_definitions: [
    { name: 'A', width: 220 },
    { name: 'B', width: 180 },
  ],
  freeze_header: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  archived_at: null,
};

describe('duplicateName', () => {
  it('слага "Copy " отпред', () => {
    expect(duplicateName('Центрове - имейли')).toBe('Copy Центрове - имейли');
  });

  it('дублирането на копие си слага още едно "Copy "', () => {
    // Нарочно буквално: така поне се вижда колко пъти е дублирано.
    expect(duplicateName('Copy Центрове')).toBe('Copy Copy Центрове');
  });

  it('понася празно име', () => {
    expect(duplicateName('')).toBe('Copy Untitled');
  });
});

describe('buildDuplicatePayload', () => {
  const payload = buildDuplicatePayload(source, {
    projectId: '99999999-8888-4777-8666-555555555555',
    userId: 'new-user',
  });

  it('копието носи новото име', () => {
    expect(payload.name).toBe('Copy Жени учени - имейли - следене');
  });

  it('пренася съдържанието на клетките заедно с форматирането', () => {
    expect(payload.data).toEqual(source.data);
    expect(payload.data[1][0].bold).toBe(true);
    expect(payload.data[1][0].bgColor).toBe('#fff3cd');
  });

  it('пренася колоните с ширините им', () => {
    expect(payload.column_definitions).toEqual(source.column_definitions);
    expect(payload.column_definitions[0].width).toBe(220);
  });

  it('пренася закачения заглавен ред', () => {
    expect(payload.freeze_header).toBe(true);
  });

  it('копието е ново, а не същият ред: без id и без дати', () => {
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });

  it('копието НИКОГА не тръгва архивирано', () => {
    // Иначе дублирането на архивирана таблица би раждало невидими копия.
    const archived = { ...source, archived_at: '2026-05-05T00:00:00Z' };
    const fromArchived = buildDuplicatePayload(archived, { projectId: 'p', userId: 'u' });
    expect(fromArchived).not.toHaveProperty('archived_at');
  });

  it('копието отива в подадения проект и на подадения потребител', () => {
    expect(payload.project_id).toBe('99999999-8888-4777-8666-555555555555');
    expect(payload.user_id).toBe('new-user');
  });

  it('не споделя памет с оригинала — промяна в копието не пипа източника', () => {
    // Плитко копие би значело, че редакцията на копието мълчаливо променя
    // и оригиналната таблица в кеша на приложението.
    payload.data[0][0].value = 'ПРОМЕНЕНО';
    expect(source.data[0][0].value).toBe('Категория');
  });
});
