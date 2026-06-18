import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  automationQueryKeys,
  removeFromList,
  setOne,
  upsertInList,
} from "~/automations/automations-cache";

const listKey = automationQueryKeys.list();

function automation(publicId: string, status: "active" | "paused" = "active") {
  return {
    publicId,
    status,
  } as NonNullable<Parameters<Parameters<typeof setOne>[2]>[0]>;
}

describe("automation cache helpers", () => {
  it("leaves missing list caches unchanged when a transform has no row to patch", () => {
    const qc = new QueryClient();

    upsertInList(qc, "automation_1", () => undefined);

    expect(qc.getQueryData(listKey)).toBeUndefined();
  });

  it("leaves missing list caches unchanged when removing a row", () => {
    const qc = new QueryClient();

    removeFromList(qc, "automation_1");

    expect(qc.getQueryData(listKey)).toBeUndefined();
  });

  it("keeps existing list rows when a transform declines an update", () => {
    const qc = new QueryClient();
    const existing = automation("automation_1");
    qc.setQueryData(listKey, [existing]);

    upsertInList(qc, "automation_1", () => undefined);

    expect(qc.getQueryData(listKey)).toEqual([existing]);
  });

  it("clears single-row cache when a transform has no row to patch", () => {
    const qc = new QueryClient();
    const getKey = automationQueryKeys.detail("automation_1");

    setOne(qc, "automation_1", () => undefined);

    expect(qc.getQueryData(getKey)).toBeUndefined();
  });
});
