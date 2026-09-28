/**
 * Разпознаване на адреси в свободен текст — едно място за правилата.
 *
 * Ползва се и от `LinkifiedText` (описания на задачи, бележки), и от клетките
 * на таблиците. Нарочно е малко и предпазливо: прави кликаеми **само** http(s)
 * адреси, защото съдържанието идва от потребителя и схеми като `javascript:`
 * биха изпълнили код при натискане.
 */

export const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Маха препинателните знаци, които обикновено се залепват след адрес в изречение
 * („виж https://nauka.bg, после…"). Затварящата скоба се запазва, защото често е
 * част от самия адрес (уикипедия: `/wiki/Тест_(пояснение)`).
 */
export function stripTrailingPunctuation(url: string): string {
  return url.replace(/[).,;:!?]+$/g, (m) => (m === ')' ? m : ''));
}

/** `www.nauka.bg` → `https://www.nauka.bg`; вече пълните адреси остават както са. */
export function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Първият безопасен адрес в текста, или `null`.
 *
 * Връща готов за отваряне адрес (с `https://` отпред, ако е липсвал).
 */
export function firstHttpUrl(text?: string | null): string | null {
  if (!text) return null;

  for (const match of text.matchAll(URL_REGEX)) {
    const href = normalizeHref(stripTrailingPunctuation(match[0]));
    if (/^https?:\/\//i.test(href)) return href;
  }

  return null;
}
