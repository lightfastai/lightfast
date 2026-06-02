import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const { default: WorkspaceRootPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/page"
);

beforeEach(() => {
  redirectMock.mockClear();
});

describe("workspace root page", () => {
  it("redirects to the canonical new chat URL", async () => {
    await WorkspaceRootPage({
      params: Promise.resolve({ slug: "acme" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/acme/chat");
  });
});
