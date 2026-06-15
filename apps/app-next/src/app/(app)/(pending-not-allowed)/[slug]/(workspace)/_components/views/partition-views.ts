/** A view as far as the switcher cares — id + label, entity-agnostic. */
export interface ViewSwitcherItem {
  name: string;
  publicId: string;
}

/**
 * Max saved-view pills rendered inline next to "All". Everything beyond this
 * collapses into the "+N" overflow dropdown. The active view is always promoted
 * into the inline set (see partitionViews), so it is never hidden in overflow.
 */
export const MAX_INLINE_VIEWS = 3;

/**
 * Split saved views into inline pills vs the overflow dropdown.
 *
 * - ≤ cap views: all inline, no overflow.
 * - active view within the first `cap`: stable first-`cap` inline.
 * - active view beyond `cap`: promote it into the last inline slot so the
 *   current selection is always a visible pill; the displaced views (original
 *   order, minus the promoted one) go to overflow.
 */
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
