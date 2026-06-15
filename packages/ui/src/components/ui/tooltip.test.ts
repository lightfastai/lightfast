import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tooltipSource = readFileSync(
  "src/components/ui/tooltip.tsx",
  "utf8"
);

describe("Tooltip", () => {
  it("uses popover surface tokens instead of inverted primary tokens", () => {
    expect(tooltipSource).toContain("bg-popover text-popover-foreground");
    expect(tooltipSource).toContain("border");
    expect(tooltipSource).toContain("shadow-md");
    expect(tooltipSource).toContain("text-[11px]");
    expect(tooltipSource).toContain("font-semibold");
    expect(tooltipSource).toContain("rounded-xl");
    expect(tooltipSource).toContain("px-2");
    expect(tooltipSource).not.toContain("px-3");
    expect(tooltipSource).not.toContain("TooltipPrimitive.Arrow");
    expect(tooltipSource).not.toContain("bg-popover fill-popover");
    expect(tooltipSource).not.toContain("rounded-md");
    expect(tooltipSource).not.toContain("rounded-lg");
    expect(tooltipSource).not.toContain("text-xs");
    expect(tooltipSource).not.toContain("bg-primary text-primary-foreground");
    expect(tooltipSource).not.toContain("bg-primary fill-primary");
  });
});
