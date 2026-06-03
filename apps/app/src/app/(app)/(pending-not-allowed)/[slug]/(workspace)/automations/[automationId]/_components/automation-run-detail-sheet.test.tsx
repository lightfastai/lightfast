import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationRunDetailSheet } from "./automation-run-detail-sheet";

const mocks = vi.hoisted(() => ({
  getRunQueryOptions: vi.fn((input: unknown, options: unknown) => ({
    input,
    options,
  })),
  skipToken: Symbol("skipToken"),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  skipToken: mocks.skipToken,
  useQuery: (options: unknown) => mocks.useQuery(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          getRun: {
            queryOptions: mocks.getRunQueryOptions,
          },
        },
      },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/sheet", () => ({
  Sheet: ({
    children,
    onOpenChange: _onOpenChange,
    open,
  }: {
    children?: ReactNode;
    onOpenChange?: (open: boolean) => void;
    open: boolean;
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SheetContent: ({
    children,
    showCloseButton,
  }: {
    children?: ReactNode;
    showCloseButton?: boolean;
  }) => (
    <div data-show-close={String(showCloseButton)} role="dialog">
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    children,
    size: _size,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    size?: string;
    variant?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./automation-run-detail-content", () => ({
  AutomationRunDetailContent: ({
    run,
  }: {
    run: { publicId: string; status: string; trigger: string };
  }) => (
    <section>
      <h2>{run.publicId}</h2>
      <p>{run.status}</p>
      <p>{run.trigger}</p>
    </section>
  ),
}));

interface TestRun {
  id: number;
  publicId: string;
  status: string;
  trigger: string;
}

const initialRun: TestRun = {
  id: 2,
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  status: "completed",
  trigger: "manual",
};

const fetchedRun: TestRun = {
  id: 3,
  publicId: "automation_run_223e4567-e89b-12d3-a456-426614174000",
  status: "failed",
  trigger: "scheduled",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRunQueryOptions.mockImplementation(
    (input: unknown, options: unknown) => ({ input, options })
  );
  mocks.useQuery.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: false,
  });
});

describe("AutomationRunDetailSheet", () => {
  it("does not create a placeholder getRun query when the sheet is closed", () => {
    render(<AutomationRunDetailSheet onOpenChange={vi.fn()} publicId={null} />);

    expect(mocks.getRunQueryOptions).toHaveBeenCalledWith(
      mocks.skipToken,
      expect.objectContaining({ enabled: false })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the seeded run and disables the fallback getRun query", () => {
    render(
      <AutomationRunDetailSheet
        initialRun={initialRun as never}
        onOpenChange={vi.fn()}
        publicId={initialRun.publicId}
      />
    );

    expect(screen.getByText(initialRun.publicId)).toBeInTheDocument();
    expect(mocks.getRunQueryOptions).toHaveBeenCalledWith(
      { id: initialRun.publicId },
      expect.objectContaining({ enabled: false })
    );
  });

  it("fetches a deep-linked run outside the loaded runs page with run-history cache settings", () => {
    mocks.useQuery.mockReturnValue({
      data: fetchedRun,
      isError: false,
      isLoading: false,
    });

    render(
      <AutomationRunDetailSheet
        onOpenChange={vi.fn()}
        publicId={fetchedRun.publicId}
      />
    );

    expect(screen.getByText(fetchedRun.publicId)).toBeInTheDocument();
    expect(mocks.getRunQueryOptions).toHaveBeenCalledWith(
      { id: fetchedRun.publicId },
      expect.objectContaining({
        enabled: true,
        refetchOnWindowFocus: true,
        staleTime: 5000,
      })
    );
  });
});
