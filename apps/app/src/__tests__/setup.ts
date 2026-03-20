/**
 * Global test setup for console component tests.
 *
 * Runs before every test file. Sets env vars and polyfills that
 * browser-component tests need but happy-dom doesn't provide.
 */

// Suppress @t3-oss/env-core validation at module load time
process.env.SKIP_ENV_VALIDATION = "true";

// jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
// Use the /matchers entry and call expect.extend() ourselves so we control which
// `expect` instance receives the extension. Importing "/vitest" as a side-effect
// calls `import { expect } from 'vitest'` inside jest-dom's own module, which in
// vitest 4's threads pool can resolve to a different module instance than the one
// the test workers use, silently making the matchers unreachable at runtime.
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(jestDomMatchers);

// Vitest 4 compatibility: the jest-dom/vitest entry only augments the `vitest` module's
// Assertion type via `declare module 'vitest'`. In vitest 4, ExpectStatic (defined in
// @vitest/expect) returns @vitest/expect.Assertion<T> directly, and the augmentation on
// the re-exporting `vitest` module does not propagate. We must also augment @vitest/expect.
declare module "@vitest/expect" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- T must match original Assertion<T> generic for module augmentation
  interface Assertion<T> {
    toAppearAfter(element: HTMLElement | SVGElement): void;
    toAppearBefore(element: HTMLElement | SVGElement): void;
    toBeChecked(): void;
    toBeDisabled(): void;
    toBeEmptyDOMElement(): void;
    toBeEnabled(): void;
    toBeInTheDocument(): void;
    toBeInvalid(): void;
    toBePartiallyChecked(): void;
    toBePartiallyPressed(): void;
    toBePressed(): void;
    toBeRequired(): void;
    toBeValid(): void;
    toBeVisible(): void;
    toContainElement(element: HTMLElement | SVGElement | null): void;
    toContainHTML(htmlText: string): void;
    toHaveAccessibleDescription(text?: string | RegExp): void;
    toHaveAccessibleErrorMessage(text?: string | RegExp): void;
    toHaveAccessibleName(text?: string | RegExp): void;
    toHaveAttribute(attr: string, value?: unknown): void;
    toHaveClass(...classNames: (string | RegExp)[]): void;
    toHaveClass(classNames: string, options?: { exact: boolean }): void;
    toHaveDescription(text?: string | RegExp): void;
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): void;
    toHaveErrorMessage(text?: string | RegExp): void;
    toHaveFocus(): void;
    toHaveFormValues(expectedValues: Record<string, unknown>): void;
    toHaveRole(role: string): void;
    toHaveSelection(selection?: string): void;
    toHaveStyle(css: string | Record<string, unknown>): void;
    toHaveTextContent(
      text: string | RegExp,
      options?: { normalizeWhitespace: boolean }
    ): void;
    toHaveValue(value?: string | string[] | number | null): void;
  }
}

// Polyfill stubs for APIs that Radix primitives may reference
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
