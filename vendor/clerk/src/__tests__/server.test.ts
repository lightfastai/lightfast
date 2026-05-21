import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let toPlainClerkResource: typeof import("../server").toPlainClerkResource;

const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;
const originalClerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_fixture";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fixture";

  ({ toPlainClerkResource } = await import("../server"));
});

afterAll(() => {
  if (originalClerkSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
  }
  if (originalClerkPublishableKey === undefined) {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalClerkPublishableKey;
  }
});

class ClerkResourceFixture<T extends object> {
  constructor(fields: T) {
    Object.assign(this, fields);
  }
}

function clerkResource<T extends object>(fields: T): T {
  return new ClerkResourceFixture(fields) as T;
}

describe("toPlainClerkResource", () => {
  it("converts class-backed Clerk resources into plain objects", () => {
    const resource = clerkResource({ id: "ak_test", name: "Test key" });

    const result = toPlainClerkResource(resource);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).toEqual({ id: "ak_test", name: "Test key" });
  });

  it("converts nested class-backed Clerk resources and arrays", () => {
    const plan = clerkResource({ id: "cplan_team", slug: "team" });
    const resource = clerkResource({
      id: "sub_org",
      subscriptionItems: [clerkResource({ id: "sub_item", plan })],
    });

    const result = toPlainClerkResource(resource);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.subscriptionItems[0])).toBe(
      Object.prototype
    );
    expect(Object.getPrototypeOf(result.subscriptionItems[0]?.plan)).toBe(
      Object.prototype
    );
    expect(result.subscriptionItems[0]?.plan).toEqual({
      id: "cplan_team",
      slug: "team",
    });
  });

  it("preserves Date values", () => {
    const createdAt = new Date("2026-05-21T00:00:00.000Z");
    const resource = clerkResource({ createdAt });

    const result = toPlainClerkResource(resource);

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe("2026-05-21T00:00:00.000Z");
  });

  it("throws for own function fields instead of silently dropping data", () => {
    const resource = clerkResource({
      id: "resource_with_function",
      serialize: () => "unsupported",
    });

    expect(() => toPlainClerkResource(resource)).toThrow(DOMException);
  });
});
