import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationRunsSection } from "./automation-runs-section";

const mocks = vi.hoisted(() => ({
  listRunsQueryOptions: vi.fn((input: unknown) => ({
    input,
    queryKey: ["listRuns", input],
  })),
  selectedRunId: null as string | null,
  setSelectedRunId: vi.fn(),
  sheetProps: [] as Array<{
    initialRun?: unknown;
    onOpenChange: (open: boolean) => void;
    publicId: string | null;
  }>,
  useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: (options: unknown) => mocks.useSuspenseQuery(options),
}));

vi.mock("nuqs", () => ({
  parseAsString: {},
  useQueryState: () => [mocks.selectedRunId, mocks.setSelectedRunId] as const,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          listRuns: {
            queryOptions: mocks.listRunsQueryOptions,
          },
        },
      },
    },
  }),
}));

vi.mock("./automation-run-detail-sheet", () => ({
  AutomationRunDetailSheet: (props: {
    initialRun?: unknown;
    onOpenChange: (open: boolean) => void;
    publicId: string | null;
  }) => {
    mocks.sheetProps.push(props);
    return (
      <button onClick={() => props.onOpenChange(false)} type="button">
        Close sheet
      </button>
    );
  },
}));

vi.mock("@vendor/lib/time", () => ({
  formatRelativeTimeToNow: () => "just now",
}));

interface TestRun {
  createdAt: Date;
  publicId: string;
  status: string;
  trigger: string;
}

const selectedRun: TestRun = {
  createdAt: new Date("2026-05-27T09:00:00.000Z"),
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  status: "completed",
  trigger: "manual",
};

const otherRun: TestRun = {
  createdAt: new Date("2026-05-27T08:00:00.000Z"),
  publicId: "automation_run_223e4567-e89b-12d3-a456-426614174000",
  status: "failed",
  trigger: "scheduled",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectedRunId = null;
  mocks.sheetProps = [];
  mocks.useSuspenseQuery.mockReturnValue({ data: [selectedRun, otherRun] });
});

describe("AutomationRunsSection", () => {
  it("uses the run search param to select a run and seed the sheet", () => {
    mocks.selectedRunId = selectedRun.publicId;

    render(<AutomationRunsSection automationId="automation_1" />);

    expect(mocks.useSuspenseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { id: "automation_1", limit: 20 },
        refetchOnWindowFocus: true,
        staleTime: 5000,
      })
    );
    expect(mocks.sheetProps.at(-1)).toMatchObject({
      initialRun: selectedRun,
      publicId: selectedRun.publicId,
    });
  });

  it("writes the selected run id to the run search param", () => {
    render(<AutomationRunsSection automationId="automation_1" />);

    fireEvent.click(screen.getByRole("button", { name: /completed/i }));

    expect(mocks.setSelectedRunId).toHaveBeenCalledWith(selectedRun.publicId);
  });

  it("clears the run search param when the sheet closes", () => {
    mocks.selectedRunId = selectedRun.publicId;

    render(<AutomationRunsSection automationId="automation_1" />);

    fireEvent.click(screen.getByRole("button", { name: /close sheet/i }));

    expect(mocks.setSelectedRunId).toHaveBeenCalledWith(null);
  });
});
