import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          get: { queryOptions: () => ({ queryKey: ["get"] }) },
          list: { queryOptions: () => ({ queryKey: ["list"] }) },
          update: { mutationOptions: (options: unknown) => options },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: mutateMock, isPending: false }),
  useQueryClient: () => ({}),
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@repo/ui/components/markdown", () => ({
  Markdown: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

const automation = {
  publicId: "automation_1",
  prompt: "## Review\n- summarize diffs",
} as never;

async function renderEditor() {
  const { AutomationPromptEditor } = await import(
    "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor"
  );
  render(<AutomationPromptEditor automation={automation} />);
}

describe("AutomationPromptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => true });
  });

  it("renders an always-editable field seeded with the raw markdown for an admin", async () => {
    await renderEditor();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("## Review\n- summarize diffs");
    expect(screen.queryByTestId("markdown")).toBeNull();
  });

  it("renders read-only markdown for a non-admin (no editor)", async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => false });
    await renderEditor();
    expect(screen.getByTestId("markdown").textContent).toContain("Review");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("commits on Cmd+Enter", async () => {
    await renderEditor();
    const textarea = screen.getByRole("textbox");
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "New instructions" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      prompt: "New instructions",
    });
  });

  it("commits on blur", async () => {
    await renderEditor();
    const textarea = screen.getByRole("textbox");
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "Blurred body" } });
    fireEvent.blur(textarea);
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      prompt: "Blurred body",
    });
  });

  it("does not commit on plain Enter (newline)", async () => {
    await renderEditor();
    const textarea = screen.getByRole("textbox");
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "Line one" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("reverts on Escape", async () => {
    await renderEditor();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "Discarded" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(mutateMock).not.toHaveBeenCalled();
    expect(textarea.value).toBe("## Review\n- summarize diffs");
  });
});
