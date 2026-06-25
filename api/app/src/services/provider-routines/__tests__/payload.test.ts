import { describe, expect, it } from "vitest";
import {
  captureProviderRoutinePayload,
  REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE,
} from "../payload";

describe("captureProviderRoutinePayload", () => {
  it("preserves object payload data", () => {
    expect(
      captureProviderRoutinePayload({
        labels: ["bug"],
        title: "Investigate regression",
      })
    ).toEqual({
      labels: ["bug"],
      title: "Investigate regression",
    });
  });

  it("wraps top-level scalar payloads without treating them as absent", () => {
    expect(captureProviderRoutinePayload(null)).toEqual({ value: null });
    expect(captureProviderRoutinePayload("ok")).toEqual({ value: "ok" });
    expect(captureProviderRoutinePayload(undefined)).toBeNull();
  });

  it("normalizes values that cannot be stored as JSON directly", () => {
    const payload: Record<string, unknown> = {
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
      id: 12n,
      invalidAt: new Date("invalid"),
    };
    payload.self = payload;

    expect(captureProviderRoutinePayload(payload)).toEqual({
      createdAt: "2026-06-24T00:00:00.000Z",
      id: "12",
      invalidAt: null,
      self: "[Circular]",
    });
  });

  it("redacts secret-like keys and values before persistence", () => {
    expect(
      captureProviderRoutinePayload({
        authorization: "Bearer raw-token",
        nested: {
          title: "secret-title",
          visible: "customer issue",
        },
        refreshToken: "raw-refresh-token",
      })
    ).toEqual({
      authorization: REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE,
      nested: {
        title: REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE,
        visible: "customer issue",
      },
      refreshToken: REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE,
    });
  });
});
