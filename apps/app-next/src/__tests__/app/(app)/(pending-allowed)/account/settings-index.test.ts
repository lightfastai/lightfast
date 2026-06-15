import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountSettingsIndexPage from "~/app/(app)/(pending-allowed)/account/settings/page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("account settings index page", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects to the general settings page", async () => {
    await expect(
      AccountSettingsIndexPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT:/account/settings/general");

    expect(redirectMock).toHaveBeenCalledWith("/account/settings/general");
  });

  it("preserves connector callback query parameters", async () => {
    await expect(
      AccountSettingsIndexPage({
        searchParams: Promise.resolve({
          connector: "granola",
          error: "access_denied",
        }),
      })
    ).rejects.toThrow(
      "NEXT_REDIRECT:/account/settings/general?connector=granola&error=access_denied"
    );

    expect(redirectMock).toHaveBeenCalledWith(
      "/account/settings/general?connector=granola&error=access_denied"
    );
  });
});
