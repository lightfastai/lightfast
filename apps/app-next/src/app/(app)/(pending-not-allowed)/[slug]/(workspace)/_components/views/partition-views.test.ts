import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_VIEWS,
  partitionViews,
  type ViewSwitcherItem,
} from "./partition-views";

function views(count: number): ViewSwitcherItem[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `View ${index + 1}`,
    publicId: `v_${index}`,
  }));
}

describe("partitionViews", () => {
  it("keeps every view inline at or under the cap", () => {
    const { overflow, visible } = partitionViews(views(3), null);
    expect(visible).toHaveLength(3);
    expect(overflow).toHaveLength(0);
  });

  it("collapses the tail into overflow past the cap", () => {
    const { overflow, visible } = partitionViews(views(5), null);
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_2"]);
    expect(overflow.map((v) => v.publicId)).toEqual(["v_3", "v_4"]);
  });

  it("keeps order stable when the active view is already inline", () => {
    const { visible } = partitionViews(views(5), "v_1");
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_2"]);
  });

  it("promotes an overflowed active view into the last inline slot", () => {
    const { overflow, visible } = partitionViews(views(5), "v_4");
    expect(visible.map((v) => v.publicId)).toEqual(["v_0", "v_1", "v_4"]);
    expect(overflow.map((v) => v.publicId)).toEqual(["v_2", "v_3"]);
  });

  it("defaults the cap to MAX_INLINE_VIEWS", () => {
    expect(partitionViews(views(4), null).visible).toHaveLength(
      MAX_INLINE_VIEWS
    );
  });
});
