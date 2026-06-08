import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { setOne, upsertInList } from "~/automations/automations-cache";

const listKey = ["automations", "list"] as const;

function trpcStub() {
  return {
    org: {
      workspace: {
        automations: {
          get: {
            queryOptions: ({ id }: { id: string }) => ({
              queryKey: ["automations", "get", id] as const,
            }),
          },
          list: {
            queryOptions: () => ({
              queryKey: listKey,
            }),
          },
        },
      },
    },
  } as unknown as Parameters<typeof setOne>[1];
}

function automation(publicId: string, status: "active" | "paused" = "active") {
  return {
    publicId,
    status,
  } as NonNullable<Parameters<Parameters<typeof setOne>[3]>[0]>;
}

describe("automation cache helpers", () => {
  it("leaves missing list caches unchanged when a transform has no row to patch", () => {
    const qc = new QueryClient();
    const trpc = trpcStub();

    upsertInList(qc, trpc, "automation_1", () => undefined);

    expect(qc.getQueryData(listKey)).toEqual([]);
  });

  it("keeps existing list rows when a transform declines an update", () => {
    const qc = new QueryClient();
    const trpc = trpcStub();
    const existing = automation("automation_1");
    qc.setQueryData(listKey, [existing]);

    upsertInList(qc, trpc, "automation_1", () => undefined);

    expect(qc.getQueryData(listKey)).toEqual([existing]);
  });

  it("clears single-row cache when a transform has no row to patch", () => {
    const qc = new QueryClient();
    const trpc = trpcStub();
    const getKey = ["automations", "get", "automation_1"] as const;

    setOne(qc, trpc, "automation_1", () => undefined);

    expect(qc.getQueryData(getKey)).toBeUndefined();
  });
});
