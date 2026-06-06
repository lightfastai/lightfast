import { describe, expect, it } from "vitest";
import { partitionViews, type ViewSwitcherItem } from "./partition-views";

function views(count: number): ViewSwitcherItem[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `View ${index + 1}`,
    publicId: `view_${index + 1}`,
  }));
}

describe("partitionViews", () => {
  it("keeps all views visible when they fit inside the cap", () => {
    const result = partitionViews(views(3), null);

    expect(result.visible).toHaveLength(3);
    expect(result.overflow).toHaveLength(0);
  });

  it("moves excess views into overflow", () => {
    const result = partitionViews(views(5), null);

    expect(result.visible.map((view) => view.publicId)).toEqual([
      "view_1",
      "view_2",
      "view_3",
    ]);
    expect(result.overflow.map((view) => view.publicId)).toEqual([
      "view_4",
      "view_5",
    ]);
  });

  it("promotes an active overflow view into the visible set", () => {
    const result = partitionViews(views(5), "view_5");

    expect(result.visible.map((view) => view.publicId)).toEqual([
      "view_1",
      "view_2",
      "view_5",
    ]);
    expect(result.overflow.map((view) => view.publicId)).toEqual([
      "view_3",
      "view_4",
    ]);
  });
});
