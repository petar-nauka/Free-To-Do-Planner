import { describe, it, expect } from 'vitest';
import { firstHttpUrl } from './linkify';

describe('firstHttpUrl', () => {
  it('намира адрес, който е цялото съдържание на клетката', () => {
    expect(firstHttpUrl('https://www.youtube.com/watch?v=-RXI2FbLRs8')).toBe(
      'https://www.youtube.com/watch?v=-RXI2FbLRs8'
    );
  });

  it('намира адрес всред текст', () => {
    expect(firstHttpUrl('виж тук https://nauka.bg за повече')).toBe('https://nauka.bg');
  });

  it('добавя https:// пред адрес, започващ с www.', () => {
    expect(firstHttpUrl('www.nauka.bg')).toBe('https://www.nauka.bg');
  });

  it('връща първия адрес, когато има няколко', () => {
    expect(firstHttpUrl('https://a.bg и https://b.bg')).toBe('https://a.bg');
  });

  it('маха препинателен знак, залепен накрая', () => {
    expect(firstHttpUrl('гледай https://nauka.bg, после пиши')).toBe('https://nauka.bg');
  });

  it('запазва затваряща скоба, която е част от адреса', () => {
    expect(firstHttpUrl('https://bg.wikipedia.org/wiki/Тест_(пояснение)')).toBe(
      'https://bg.wikipedia.org/wiki/Тест_(пояснение)'
    );
  });

  it('връща null, когато няма адрес', () => {
    expect(firstHttpUrl('Dwarkesh — Ryan Greenblatt')).toBeNull();
    expect(firstHttpUrl('')).toBeNull();
    expect(firstHttpUrl(null)).toBeNull();
    expect(firstHttpUrl(undefined)).toBeNull();
  });

  it('НЕ приема javascript: и други опасни схеми', () => {
    // Клетката се пълни от потребителя; не бива да правим кликаем линк,
    // който изпълнява код при натискане.
    expect(firstHttpUrl('javascript:alert(1)')).toBeNull();
    expect(firstHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(firstHttpUrl('file:///C:/Windows')).toBeNull();
  });

  it('не се подвежда по числа и дати', () => {
    expect(firstHttpUrl('10/10')).toBeNull();
    expect(firstHttpUrl('9.5/10')).toBeNull();
  });
});
