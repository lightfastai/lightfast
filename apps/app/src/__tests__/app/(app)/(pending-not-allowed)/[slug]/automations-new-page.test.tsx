import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hasMock = vi.fn();
const authMock = vi.fn(() => ({ has: hasMock }));
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const automationCreateFormMock = vi.fn(({ slug }: { slug: string }) => (
  <div data-testid="automation-create-form">{slug}</div>
));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form",
  () => ({
    AutomationCreateForm: automationCreateFormMock,
  })
);

const { default: NewAutomationPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/page"
);

function invoke(slug = "acme") {
  return NewAutomationPage({
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  hasMock.mockReset();
  authMock.mockClear();
  redirectMock.mockClear();
  automationCreateFormMock.mockClear();
});

describe("new automation page", () => {
  it("renders the create form for org admins", async () => {
    hasMock.mockReturnValue(true);

    const element = await invoke("acme");
    render(element);

    expect(hasMock).toHaveBeenCalledWith({ role: "org:admin" });
    expect(screen.getByTestId("automation-create-form")).toHaveTextContent(
      "acme"
    );
  });

  it("redirects non-admins back to the automation list", async () => {
    hasMock.mockReturnValue(false);

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/automations"
    );
    expect(automationCreateFormMock).not.toHaveBeenCalled();
  });
});
