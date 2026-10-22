// Шрифтовете на Excalidraw идват от нашия сървър (/excalidraw/fonts/…), не от CDN:
// CSP-то в index.html (font-src 'self') иначе ги блокира. Копира ги plugin-ът
// `excalidrawFonts` във vite.config.ts.
//
// Отделен файл, внесен ПРЕДИ Excalidraw — така адресът е зададен, преди
// библиотеката да потърси първия шрифт.
(window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
