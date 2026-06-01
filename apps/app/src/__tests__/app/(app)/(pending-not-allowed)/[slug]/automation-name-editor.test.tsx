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

const automation = { publicId: "automation_1", name: "Daily review" } as never;

async function renderEditor() {
  const { AutomationNameEditor } = await import(
    "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor"
  );
  render(<AutomationNameEditor automation={automation} />);
}

describe("AutomationNameEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => true });
  });

  it("renders the name as plain text with no editor for a non-admin", async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, has: () => false });
    await renderEditor();
    expect(screen.getByText("Daily review")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("renders an always-editable field seeded with the name for an admin", async () => {
    await renderEditor();
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(input.value).toBe("Daily review");
  });

  it("commits a renamed value on blur", async () => {
    await renderEditor();
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Weekly review" } });
    fireEvent.blur(input);
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      name: "Weekly review",
    });
  });

  it("commits on Enter", async () => {
    await renderEditor();
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).toHaveBeenCalledWith({
      id: "automation_1",
      name: "Renamed",
    });
  });

  it("reverts on Escape without committing", async () => {
    await renderEditor();
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mutateMock).not.toHaveBeenCalled();
    expect(input.value).toBe("Daily review");
  });

  it("does not commit an unchanged value", async () => {
    await renderEditor();
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
