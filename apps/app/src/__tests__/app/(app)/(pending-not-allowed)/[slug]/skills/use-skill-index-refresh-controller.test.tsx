import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData } from "./fixtures";

type MutationOptions = { onSuccess?: () => void };

class MockEventSource {
  static instances: MockEventSource[] = [];
  closed = false;
  listeners = new Map<string, (event: MessageEvent) => void>();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.(
      new MessageEvent(type, { data: JSON.stringify(data) })
    );
  }
}

const invalidateQueriesMock = vi.fn();
const listQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));
const requestMutationOptionsMock = vi.fn((options: MutationOptions) => options);
const mutateMock = vi.fn();
let latestMutationOptions: MutationOptions | undefined;

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: MutationOptions) => {
    latestMutationOptions = options;
    return {
      mutate: mutateMock,
    };
  },
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
            queryFilter: listQueryFilterMock,
          },
          requestRefresh: {
            mutationOptions: requestMutationOptionsMock,
          },
        },
      },
    },
  }),
}));

Object.defineProperty(globalThis, "EventSource", {
  configurable: true,
  value: MockEventSource,
});

const { useSkillIndexRefreshController } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller"
);

beforeEach(() => {
  invalidateQueriesMock.mockReset();
  listQueryFilterMock.mockClear();
  MockEventSource.instances = [];
  requestMutationOptionsMock.mockClear();
  mutateMock.mockReset();
  latestMutationOptions = undefined;
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

  it("does not request refresh for a stale snapshot with a terminal refresh error", () => {
    const stale = createListData({
      snapshotVersion: "v-stale-failed",
    });
    stale.freshness.status = "stale";
    stale.freshness.errorCode = "refresh_failed";

    renderHook(() => useSkillIndexRefreshController(stale));

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("requests one refresh for an unavailable snapshot without a version", async () => {
    const unavailable = createListData({
      snapshotVersion: null,
    });
    unavailable.freshness.status = "unavailable";

    expect(unavailable.snapshotVersion).toBeNull();

    const { rerender } = renderHook(
      ({ snapshot }) => useSkillIndexRefreshController(snapshot),
      { initialProps: { snapshot: unavailable } }
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    rerender({ snapshot: unavailable });
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

  it("invalidates the skills list query after a successful refresh request", async () => {
    const stale = createListData({
      snapshotVersion: "v-success",
    });
    stale.freshness.status = "stale";

    renderHook(() => useSkillIndexRefreshController(stale));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));

    latestMutationOptions?.onSuccess?.();

    expect(listQueryFilterMock).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "skills", "list"],
    });
  });

  it("invalidates the skills list when a skill-index event arrives", async () => {
    const { unmount } = renderHook(() =>
      useSkillIndexRefreshController(createListData({ snapshotVersion: "v1" }))
    );

    expect(MockEventSource.instances[0]?.url).toBe(
      "/api/skills/index/events"
    );

    MockEventSource.instances[0]?.emit("skill-index", {
      snapshotVersion: "v2",
      type: "skill_index.changed",
    });

    await waitFor(() =>
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ["org", "workspace", "skills", "list"],
      })
    );

    unmount();
    expect(MockEventSource.instances[0]?.closed).toBe(true);
  });
});
