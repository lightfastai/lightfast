/**
 * Global test setup for console component tests.
 *
 * Runs before every test file. Sets env vars and polyfills that
 * browser-component tests need but happy-dom doesn't provide.
 */

// Suppress @t3-oss/env-core validation at module load time
process.env.SKIP_ENV_VALIDATION = "true";

// jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
import "@testing-library/jest-dom/vitest";

// Polyfill stubs for APIs that Radix primitives may reference
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
