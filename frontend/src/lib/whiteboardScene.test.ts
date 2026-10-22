import { describe, it, expect } from 'vitest';
import { toStoredScene, fromStoredScene } from './whiteboardScene';

const rect = { id: 'r1', type: 'rectangle', isDeleted: false };
const erased = { id: 'r2', type: 'ellipse', isDeleted: true };

describe('toStoredScene', () => {
  it('пази само живите елементи и цвета на фона', () => {
    const appState = { viewBackgroundColor: '#fff', zoom: { value: 2 }, cursorButton: 'down' };
    const scene = toStoredScene([rect, erased], appState);
    expect(scene).toEqual({ elements: [rect], appState: { viewBackgroundColor: '#fff' } });
  });
});

describe('fromStoredScene', () => {
  it('връща записаната сцена', () => {
    const stored = { elements: [rect], appState: { viewBackgroundColor: '#ffc9c9' } };
    expect(fromStoredScene(stored)).toEqual(stored);
  });

  it('нова дъска ({} в базата) е празна сцена', () => {
    expect(fromStoredScene({})).toEqual({ elements: [], appState: {} });
  });

  it('не пада при повредени данни', () => {
    expect(fromStoredScene(null)).toEqual({ elements: [], appState: {} });
    expect(fromStoredScene('боклук')).toEqual({ elements: [], appState: {} });
    expect(fromStoredScene({ elements: 'x', appState: [] })).toEqual({ elements: [], appState: {} });
  });
});
