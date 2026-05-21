import { afterAll, beforeAll, describe, expect, it } from "vitest";

let getClerkFrontendApi: typeof import("../env").getClerkFrontendApi;

const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;
const originalClerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_fake-secret-key-for-tests";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = `pk_test_${Buffer.from(
    "test-clerk.lightfast.example$"
  ).toString("base64")}`;

  ({ getClerkFrontendApi } = await import("../env"));
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

describe("getClerkFrontendApi", () => {
  it("derives the frontend API from the validated Clerk env", () => {
    expect(getClerkFrontendApi()).toBe("https://test-clerk.lightfast.example");
  });
});
