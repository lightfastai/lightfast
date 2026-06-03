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

  it("formats errors without leaking stack traces", () => {
    const result = formatMcpError(new Error("Nope"));
    expect(result).toEqual({
      content: [{ text: "Nope", type: "text" }],
      isError: true,
    });
  });
});
