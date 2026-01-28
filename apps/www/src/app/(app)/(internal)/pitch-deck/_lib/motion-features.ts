/**
 * Async loader for Framer Motion domAnimation features.
 * This keeps the ~15-18kb domAnimation bundle out of the initial load.
 *
 * Usage with LazyMotion:
 * <LazyMotion features={loadMotionFeatures} strict>
 */
export const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domAnimation);
