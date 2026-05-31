import { SIGNAL_INPUT_MAX_LENGTH } from "@repo/api-contract";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutationOptionsMock = vi.fn((options: unknown) => options);
const invalidateQueriesMock = vi.fn();
const mutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
    org: {
      workspace: {
        signals: {
          create: { mutationOptions: createMutationOptionsMock },
          list: {
            queryFilter: () => ({
              queryKey: ["org", "workspace", "signals", "list"],
            }),
          },
          workingSet: {
            queryFilter: () => ({
              queryKey: ["org", "workspace", "signals", "workingSet"],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => useMutationMock(options),
  useQuery: () => ({
    data: [
      { id: "org_1", initials: "L", name: "Lightfast", slug: "lightfast" },
    ],
  }),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/signals",
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogClose: ({ children }: { children?: ReactNode }) => children,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: toastSuccessMock },
}));

const { SignalCreateDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog"
);

function renderDialog() {
  const onOpenChange = vi.fn();
  render(<SignalCreateDialog onOpenChange={onOpenChange} open />);
  return { onOpenChange };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  createMutationOptionsMock.mockClear();
  invalidateQueriesMock.mockReset();
  mutateMock.mockReset();
  toastSuccessMock.mockReset();
  useMutationMock.mockReset();
  useMutationMock.mockImplementation((options: { onSuccess?: () => void }) => ({
    isPending: false,
    mutate: (variables: { input: string }) => {
      mutateMock(variables);
      options.onSuccess?.();
    },
  }));
});

describe("SignalCreateDialog", () => {
  it("renders the org breadcrumb header", () => {
    renderDialog();
    expect(screen.getByText("Lightfast")).toBeInTheDocument();
    expect(screen.getByText("New signal")).toBeInTheDocument();
  });

  it("submits with Cmd+Enter and keeps plain Enter as a newline", () => {
    renderDialog();
    const input = screen.getByLabelText("Signal input");
    fireEvent.change(input, { target: { value: "Customer needs a response" } });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer needs a response",
    });
  });

  it("trims input and invalidates the signals list on success", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "  Customer asked for rollout timing  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({
      input: "Customer asked for rollout timing",
    });
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(2);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "signals", "workingSet"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "signals", "list"],
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Signal queued", {
      description: "Classification will start shortly.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open and clears input when Create more is on", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("switch", { name: "Create more" }));
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "First signal" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));

    expect(mutateMock).toHaveBeenCalledWith({ input: "First signal" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Signal input")).toHaveValue("");
  });

  it("blocks blank submission", () => {
    renderDialog();
    fireEvent.submit(screen.getByRole("form", { name: "Create signal" }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("caps pasted input at the contract limit", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "a".repeat(SIGNAL_INPUT_MAX_LENGTH + 250) },
    });
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "a".repeat(SIGNAL_INPUT_MAX_LENGTH)
    );
    expect(screen.getByText("Limit reached")).toBeInTheDocument();
  });

  it("normalizes pasted line endings without collapsing multiline input", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Signal input"), {
      target: { value: "First line\r\n\r\nSecond line\rThird line" },
    });
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "First line\n\nSecond line\nThird line"
    );
  });

  it("restores a session draft on open", () => {
    sessionStorage.setItem(
      "lightfast:create-signal-draft:/lightfast/signals",
      "Recovered customer note"
    );
    renderDialog();
    expect(screen.getByLabelText("Signal input")).toHaveValue(
      "Recovered customer note"
    );
  });

  it("locks controls while creating", () => {
    useMutationMock.mockImplementation(() => ({
      isPending: true,
      mutate: mutateMock,
    }));
    renderDialog();
    expect(screen.getByLabelText("Signal input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creating" })).toBeDisabled();
  });
});
