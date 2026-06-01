// The isometric figure renderer + scenes live in @repo/ui (Remotion-free, pure
// React + SVG over @repo/ui/lib/iso) so the app's empty states and these
// Remotion compositions render the exact same figure. Re-exported here to keep
// the composition imports stable.
export {
  IsoFigure,
  type IsoScene,
  peopleScene,
  signalsScene,
} from "@repo/ui/components/iso-figure";
