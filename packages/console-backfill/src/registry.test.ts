import { describe, it, expect, beforeEach } from "vitest";
// Import directly from ./registry to avoid auto-registration side effects from ./index
import {
  registerConnector,
  getConnector,
  hasConnector,
  clearRegistry,
} from "./registry";
import type { BackfillConnector } from "./types";

function makeConnector(provider: string): BackfillConnector {
  return {
    provider: provider as BackfillConnector["provider"],
    supportedEntityTypes: ["pull_request"],
    defaultEntityTypes: ["pull_request"],
    validateScopes: async () => {},
    fetchPage: async () => ({ events: [], nextCursor: null, rawCount: 0 }),
  };
}

describe("registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("registerConnector stores connector and getConnector retrieves it", () => {
    const connector = makeConnector("github");
    registerConnector(connector);
    expect(getConnector("github" as BackfillConnector["provider"])).toBe(connector);
  });

  it("hasConnector returns false for unregistered provider", () => {
    // Use a provider name we know hasn't been registered
    expect(hasConnector("linear" as BackfillConnector["provider"])).toBe(false);
  });

  it("hasConnector returns true after registration", () => {
    const connector = makeConnector("vercel");
    registerConnector(connector);
    expect(hasConnector("vercel" as BackfillConnector["provider"])).toBe(true);
  });

  it("getConnector returns undefined for unknown provider", () => {
    expect(getConnector("slack" as BackfillConnector["provider"])).toBeUndefined();
  });

  it("re-registering a provider overwrites the existing entry", () => {
    const first = makeConnector("github");
    const second = makeConnector("github");
    registerConnector(first);
    registerConnector(second);
    expect(getConnector("github" as BackfillConnector["provider"])).toBe(second);
  });
});
