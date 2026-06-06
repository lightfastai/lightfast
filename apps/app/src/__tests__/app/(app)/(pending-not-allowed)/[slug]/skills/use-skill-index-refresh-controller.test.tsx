import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData } from "./fixtures";

const invalidateQueriesMock = vi.fn();
const requestMutationOptionsMock = vi.fn((options: unknown) => options);
const mutateMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => ({
    mutate: mutateMock,
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: {
          list: {
            queryFilter: () => ({
              queryKey: ["org", "workspace", "skills", "list"],
            }),
          },
          requestRefresh: {
            mutationOptions: requestMutationOptionsMock,
          },
        },
      },
    },
  }),
}));

const { useSkillIndexRefreshController } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller"
);

beforeEach(() => {
  invalidateQueriesMock.mockReset();
  requestMutationOptionsMock.mockClear();
  mutateMock.mockReset();
});

describe("useSkillIndexRefreshController", () => {
  it("does not request refresh for fresh snapshots", () => {
    renderHook(() =>
      useSkillIndexRefreshController(
        createListData({
          snapshotVersion: "v1",
        })
      )
    );

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("requests one refresh for a stale snapshot version", async () => {
    const stale = createListData({
      snapshotVersion: "v-stale",
    });
    stale.freshness.status = "stale";

    const { rerender } = renderHook(
      ({ snapshot }) => useSkillIndexRefreshController(snapshot),
      { initialProps: { snapshot: stale } }
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    rerender({ snapshot: stale });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("requests refresh again when the stale snapshot version changes", async () => {
    const staleA = createListData({ snapshotVersion: "v-stale-a" });
    staleA.freshness.status = "stale";
    const staleB = createListData({ snapshotVersion: "v-stale-b" });
    staleB.freshness.status = "stale";

    const { rerender } = renderHook(
      ({ snapshot }) => useSkillIndexRefreshController(snapshot),
      { initialProps: { snapshot: staleA } }
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    rerender({ snapshot: staleB });
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(2));
  });
});
