/**
 * Test actor definitions
 *
 * Pre-defined actors for consistent test data generation.
 */

import type { TestActor } from "../types";

/**
 * Default test actors representing different team roles
 */
export const DEFAULT_ACTORS: Record<string, TestActor> = {
  alice: {
    id: "test-alice-001",
    name: "alice",
    email: "alice@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
  },
  bob: {
    id: "test-bob-002",
    name: "bob",
    email: "bob@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
  },
  charlie: {
    id: "test-charlie-003",
    name: "charlie",
    email: "charlie@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie",
  },
  david: {
    id: "test-david-004",
    name: "david",
    email: "david@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
  },
  eve: {
    id: "test-eve-005",
    name: "eve",
    email: "eve@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=eve",
  },
  frank: {
    id: "test-frank-006",
    name: "frank",
    email: "frank@test.local",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=frank",
  },
};

/**
 * Bot actors for automated events
 */
export const BOT_ACTORS: Record<string, TestActor> = {
  vercelBot: {
    id: "bot-vercel-001",
    name: "vercel-bot",
    email: "bot@vercel.com",
  },
  githubActions: {
    id: "bot-github-actions",
    name: "github-actions[bot]",
    email: "actions@github.com",
  },
  dependabot: {
    id: "bot-dependabot",
    name: "dependabot[bot]",
    email: "dependabot@github.com",
  },
};

/**
 * Get a random actor from the default set
 */
export function randomActor(): TestActor {
  const actors = Object.values(DEFAULT_ACTORS);
  const actor = actors[Math.floor(Math.random() * actors.length)];
  if (!actor) {
    throw new Error("No actors available");
  }
  return actor;
}

/**
 * Get actor by name
 */
export function getActor(name: string): TestActor {
  return (
    DEFAULT_ACTORS[name] ??
    BOT_ACTORS[name] ?? {
      id: `test-${name}`,
      name,
      email: `${name}@test.local`,
    }
  );
}

/**
 * Create a custom actor
 */
export function createActor(name: string, overrides?: Partial<TestActor>): TestActor {
  return {
    id: `test-${name}-${Date.now()}`,
    name,
    email: `${name}@test.local`,
    ...overrides,
  };
}
