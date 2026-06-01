import { afterEach, describe, expect, it, vi } from "vitest";

const { createClerkClientMock } = vi.hoisted(() => ({
  createClerkClientMock: vi.fn((input: { secretKey: string }) => ({
    secretKey: input.secretKey,
  })),
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: createClerkClientMock,
}));

vi.mock("../env", () => ({
  clerkEnvBase: {
    CLERK_SECRET_KEY: "sk_test_validated-secret-key",
  },
}));

const { createBackendClerkClient } = await import("../backend");
const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;

afterEach(() => {
  if (originalClerkSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
  }
});

describe("createBackendClerkClient", () => {
  it("uses the package validated Clerk secret", () => {
    process.env.CLERK_SECRET_KEY = "sk_test_process-env-secret-key";

    const client = createBackendClerkClient();

    expect(client).toEqual({ secretKey: "sk_test_validated-secret-key" });
    expect(createClerkClientMock).toHaveBeenCalledWith({
      secretKey: "sk_test_validated-secret-key",
    });
  });
});
