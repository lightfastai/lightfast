import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignalDetailSheet } from "./signal-detail-sheet";
import type { SignalListItem, SignalRow } from "./signals-model";

const useQueryMock = vi.fn();
const getQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgMembers: { list: { queryOptions: () => ({ queryKey: ["m"] }) } },
      },
      workspace: { signals: { get: { queryOptions: getQueryOptionsMock } } },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: vi.fn() },
}));

const classifiedItem: SignalListItem = {
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.9,
    disposition: "actionable",
    kind: "follow_up",
    priority: "high",
    summary: "s",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_follow_up",
  status: "classified",
};

const processingRow = {
  classification: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 9,
  input: "Raw processing input",
  publicId: "signal_proc",
  status: "processing",
  updatedAt: new Date("2026-05-27T01:00:00.000Z"),
} as SignalRow;

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: false,
  });
});

describe("SignalDetailSheet", () => {
  it("fetches the body for a classified projection row (no input in seed)", () => {
    render(
      <SignalDetailSheet
        initialItem={classifiedItem}
        onOpenChange={vi.fn()}
        publicId="signal_follow_up"
      />
    );

    // Header seeds from the projection immediately (the visible content heading
    // plus the sr-only SheetTitle both carry the title).
    expect(
      screen.getAllByRole("heading", { name: "Follow up on migration" }).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("SIG-7")).toBeInTheDocument();
    // get is enabled because the seed has no body.
    expect(getQueryOptionsMock).toHaveBeenCalledWith(
      { publicId: "signal_follow_up" },
      expect.objectContaining({ enabled: true })
    );
  });

  it("skips the body fetch for a processing row that already has input", () => {
    render(
      <SignalDetailSheet
        initialItem={processingRow}
        onOpenChange={vi.fn()}
        publicId="signal_proc"
      />
    );

    expect(screen.getByText("Raw processing input")).toBeInTheDocument();
    expect(getQueryOptionsMock).toHaveBeenCalledWith(
      { publicId: "signal_proc" },
      expect.objectContaining({ enabled: false })
    );
  });
});
