/**
 * Lightfast Engine Visual Component
 *
 * Visual showcase for the Lightfast engine orchestration.
 * 5-column x 3-row grid layout showing the technical architecture.
 */

export function LightfastEngineVisual() {
  return (
    <div className="h-full min-h-[700px] grid grid-cols-5 grid-rows-3 gap-2">
      {/* Column 1: Empty space with dashed border (3 rows) */}
      <div className="row-span-3 border border-dashed border-border/50 rounded-sm" />

      {/* Column 2: Nested grid (1 col x 3 rows: 35% 35% 30%) */}
      <div className="row-span-3 border border-border/50 bg-muted/10 divide-y divide-border/50 rounded-sm grid grid-cols-1 grid-rows-[35%_35%_30%]">
        <div className="" />
        <div className="" />
        <div className="bg-muted/30" />
      </div>

      {/* Column 3: Single item (3 rows) */}
      <div className="row-span-3 border border-border/50 bg-muted/10 rounded-sm" />

      {/* Columns 4-5: Single item (2 cols x 3 rows) */}
      <div className="col-span-2 row-span-3 border border-border/50 bg-muted/10 rounded-sm" />
    </div>
  );
}
