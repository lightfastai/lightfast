import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "~/lib/json-ld";

describe("JSON-LD serialization", () => {
  it("escapes script-breaking characters before embedding JSON", () => {
    const serialized = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
      lineSeparator: "\u2028",
      paragraphSeparator: "\u2029",
    });

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });
});
