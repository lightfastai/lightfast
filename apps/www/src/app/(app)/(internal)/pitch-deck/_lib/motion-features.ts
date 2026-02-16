/**
 * Async loader for Framer Motion domMax features.
 * domMax includes layout animations required for FLIP transitions.
 * Bundle impact: ~15kb → ~25kb (additional ~10kb for layout engine).
 *
 * Usage with LazyMotion:
 * <LazyMotion features={loadMotionFeatures} strict>
 */
export const loadMotionFeatures = () =>
  import("framer-motion").then((mod) => mod.domMax);
