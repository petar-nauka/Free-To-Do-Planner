import '@testing-library/jest-dom/vitest';

// jsdom няма ResizeObserver, а cmdk / Radix компоненти го изискват при mount.
// Празен stub е достатъчен — тестовете не проверяват размери.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Също липсва в jsdom — cmdk скролва избрания елемент при mount.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
