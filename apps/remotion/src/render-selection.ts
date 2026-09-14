import { BRAND_COMPOSITIONS } from "./brand-manifest";
import { MANIFEST } from "./remotion/manifest";

export function selectRenderIds(args: string[]) {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]!;
    const value = args[i + 1];
    if (
      !(["--only", "--id", "--pack"].includes(flag) && value) ||
      values.has(flag)
    ) {
      throw new Error(`Invalid or duplicate render option: ${flag}`);
    }
    values.set(flag, value);
  }
  const only = values.get("--only") ?? "all";
  const id = values.get("--id");
  const pack = values.get("--pack");
  if (!["stills", "video", "all"].includes(only)) {
    throw new Error(`Unknown render type: ${only}`);
  }
  if (pack && (pack !== "brand" || id || only === "video")) {
    throw new Error(
      "--pack brand requires stills and cannot be combined with --id"
    );
  }
  if (id && !MANIFEST.compositions[id]) {
    throw new Error(`Unknown composition: ${id}`);
  }
  const ids = new Set(
    Object.entries(MANIFEST.compositions)
      .filter(
        ([key, entry]) =>
          (!pack || key in BRAND_COMPOSITIONS) &&
          (!id || key === id) &&
          (only === "all" ||
            entry.type === (only === "stills" ? "still" : "video"))
      )
      .map(([key]) => key)
  );
  // A preview consumes real output files; include its source renders in this run.
  if (ids.has("brand-preview")) {
    for (const source of Object.keys(BRAND_COMPOSITIONS)) {
      ids.add(source);
    }
  }
  if (ids.size === 0) {
    throw new Error("No compositions match the render options");
  }
  return ids;
}
