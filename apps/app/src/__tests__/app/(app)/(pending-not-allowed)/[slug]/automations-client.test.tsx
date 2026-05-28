import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useMutationMock = vi.fn();
const useQueryMock = vi.fn();
const useQueryClientMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

const listQueryOptions = {
  queryKey: ["org", "workspace", "automations", "list"],
};
const listRunsQueryOptions = {
  queryKey: ["org", "workspace", "automations", "listRuns"],
};

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          create: { mutationOptions: (options: unknown) => options },
          delete: { mutationOptions: (options: unknown) => options },
          list: { queryOptions: () => listQueryOptions },
          listRuns: { queryOptions: () => listRunsQueryOptions },
          pause: { mutationOptions: (options: unknown) => options },
          resume: { mutationOptions: (options: unknown) => options },
          runNow: { mutationOptions: (options: unknown) => options },
          update: { mutationOptions: (options: unknown) => options },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
  useQueryClient: useQueryClientMock,
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/lightfast/automations",
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

const { AutomationsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-client"
);

const automation = {
  id: 1,
  publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_acme",
  createdByUserId: "user_current",
  name: "Morning check",
  prompt: "Check the workspace",
  scheduleKind: "daily",
  scheduleConfig: { time: "09:00" },
  timezone: "UTC",
  status: "active",
  nextRunAt: "2026-05-28 09:00:00.000",
  lastRunAt: "2026-05-27 09:00:00.000",
  scheduleVersion: 1,
  createdAt: "2026-05-27 00:00:00.000",
  updatedAt: "2026-05-27 00:00:00.000",
};

const pausedAutomation = {
  ...automation,
  id: 3,
  publicId: "automation_223e4567-e89b-12d3-a456-426614174000",
  name: "Sentry errors hourly",
  prompt: "Check Sentry errors",
  scheduleKind: "hourly",
  scheduleConfig: { intervalHours: 1 },
  status: "paused",
  nextRunAt: null,
  lastRunAt: null,
};

const run = {
  id: 2,
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  automationId: 1,
  automationPublicId: automation.publicId,
  clerkOrgId: "org_acme",
  trigger: "scheduled",
  status: "completed",
  dueAt: "2026-05-27 09:00:00.000",
  startedAt: "2026-05-27 09:00:01.000",
  finishedAt: "2026-05-27 09:00:02.000",
  scheduleVersion: 1,
  idempotencyKey: "scheduled:test",
  output: {
    message: "Automation scaffold executed. AI execution is not enabled.",
  },
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-05-27 09:00:00.000",
  updatedAt: "2026-05-27 09:00:02.000",
};

beforeEach(() => {
  useAuthMock.mockReset();
  useMutationMock.mockReset();
  useQueryMock.mockReset();
  useQueryClientMock.mockReset();
  useSuspenseQueryMock.mockReset();

  useAuthMock.mockReturnValue({
    has: ({ role }: { role?: string }) => role === "org:admin",
    isLoaded: true,
  });
  useMutationMock.mockReturnValue({ isPending: false, mutate: vi.fn() });
  useQueryClientMock.mockReturnValue({ invalidateQueries: vi.fn() });
  useSuspenseQueryMock.mockReturnValue({
    data: [automation, pausedAutomation],
  });
  useQueryMock.mockReturnValue({ data: [run], isLoading: false });
});

describe("AutomationsClient", () => {
  it("renders a sparse grouped automation list", () => {
    render(<AutomationsClient />);

    expect(screen.getByRole("heading", { name: "Automations" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: /new automation/i })
    ).toHaveAttribute("href", "/lightfast/automations/new");
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Paused" })).toBeInTheDocument();
    expect(screen.getByText("Morning check")).toBeInTheDocument();
    expect(screen.getByText("Sentry errors hourly")).toBeInTheDocument();
    expect(screen.getAllByText("lightfast")).toHaveLength(2);
    expect(screen.getByText("Daily at 9:00 AM")).toBeInTheDocument();
    expect(screen.getAllByText("Paused")).toHaveLength(2);
    expect(screen.queryByText("Run history")).not.toBeInTheDocument();
  });
});
