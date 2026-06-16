export interface ViewSwitcherItem {
  name: string;
  publicId: string;
}

export const MAX_INLINE_VIEWS = 3;

export function partitionViews<T extends ViewSwitcherItem>(
  views: T[],
  activeViewId: string | null,
  cap: number = MAX_INLINE_VIEWS
): { overflow: T[]; visible: T[] } {
  if (views.length <= cap) {
    return { overflow: [], visible: views };
  }

  const activeIndex = activeViewId
    ? views.findIndex((view) => view.publicId === activeViewId)
    : -1;

  if (activeIndex < cap) {
    return { overflow: views.slice(cap), visible: views.slice(0, cap) };
  }

  const visible = [...views.slice(0, cap - 1), views[activeIndex] as T];
  const visibleIds = new Set(visible.map((view) => view.publicId));
  const overflow = views.filter((view) => !visibleIds.has(view.publicId));
  return { overflow, visible };
}
