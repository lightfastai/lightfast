import { describe, expect, it } from "vitest";

import { formatMcpError, formatMcpSuccess } from "../results";

describe("MCP result formatting", () => {
  it("returns structured content for object results", () => {
    expect(formatMcpSuccess({ id: "signal_1", status: "queued" })).toEqual({
      content: [
        {
          text: '{\n  "id": "signal_1",\n  "status": "queued"\n}',
          type: "text",
        },
      ],
      structuredContent: { id: "signal_1", status: "queued" },
    });
  });

  it("wraps primitive results in structuredContent.result", () => {
    expect(formatMcpSuccess("ok")).toEqual({
      content: [{ text: '"ok"', type: "text" }],
      structuredContent: { result: "ok" },
    });
  });

  it("returns JSON-compatible structured content", () => {
    expect(
      formatMcpSuccess({
        createdAt: new Date("2026-06-25T03:26:25.180Z"),
      })
    ).toEqual({
      content: [
        {
          text: '{\n  "createdAt": "2026-06-25T03:26:25.180Z"\n}',
          type: "text",
        },
      ],
      structuredContent: {
        createdAt: "2026-06-25T03:26:25.180Z",
      },
    });
  });

  it("degrades safely when result JSON serialization throws", () => {
    expect(formatMcpSuccess({ count: 1n })).toEqual({
      content: [{ text: "[object Object]", type: "text" }],
      structuredContent: { result: null },
    });
  });

  it("degrades safely for circular result objects", () => {
    const result: { self?: unknown } = {};
    result.self = result;

    expect(formatMcpSuccess(result)).toEqual({
      content: [{ text: "[object Object]", type: "text" }],
      structuredContent: { result: null },
    });
  });

  it("formats errors without leaking stack traces", () => {
    const result = formatMcpError(new Error("Nope"));
    expect(result).toEqual({
      content: [{ text: "Nope", type: "text" }],
      isError: true,
    });
  });
});
