import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationActions } from "./automation-actions";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  listRunsQueryOptions: vi.fn((input: unknown) => ({
    queryKey: ["listRuns", input],
  })),
  getRunQueryOptions: vi.fn((input: unknown) => ({
    queryKey: ["getRun", input],
  })),
  mutate: vi.fn(),
  runNowMutationOptions: undefined as
    | {
        onSuccess?: (run: unknown) => void;
      }
    | undefined,
  setQueryData: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => {
    mocks.runNowMutationOptions = options as typeof mocks.runNowMutationOptions;
    return { isPending: false, mutate: mocks.mutate };
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          getRun: {
            queryOptions: mocks.getRunQueryOptions,
          },
          listRuns: {
            queryOptions: mocks.listRunsQueryOptions,
          },
          runNow: {
            mutationOptions: (options: unknown) => options,
          },
        },
      },
    },
  }),
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

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const automation = {
  publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
  status: "active",
} as never;

const run = {
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  status: "pending",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runNowMutationOptions = undefined;
  mocks.useAuth.mockReturnValue({
    has: ({ role }: { role?: string }) => role === "org:admin",
    isLoaded: true,
  });
});

describe("AutomationActions", () => {
  it("enqueues a manual run for the current automation", () => {
    render(<AutomationActions automation={automation} />);

    fireEvent.click(screen.getByRole("button", { name: /run now/i }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      id: "automation_123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("seeds the returned run into list and detail caches before refetching", () => {
    render(<AutomationActions automation={automation} />);

    mocks.runNowMutationOptions?.onSuccess?.(run);

    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["getRun", { id: "automation_run_123e4567-e89b-12d3-a456-426614174000" }],
      run
    );
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      [
        "listRuns",
        {
          id: "automation_123e4567-e89b-12d3-a456-426614174000",
          limit: 20,
        },
      ],
      expect.any(Function)
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "listRuns",
        {
          id: "automation_123e4567-e89b-12d3-a456-426614174000",
          limit: 20,
        },
      ],
    });
  });
});
