/** Test setup: jest-dom matchers, and the browser APIs jsdom lacks that Radix and the shell use. */
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.assign(globalThis, { ResizeObserver: NoopResizeObserver });
}
if (typeof window !== 'undefined') {
  // jsdom implements scrollTo as a "not implemented" error; the shell scrolls to top on navigation.
  window.scrollTo = () => {};
}
