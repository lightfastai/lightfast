import { BRAND_COMPOSITIONS } from "./brand-manifest";
import { MANIFEST } from "./remotion/manifest";

export function selectRenderIds(args: string[]) {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]!;
    const value = args[i + 1];
    if (!(["--only", "--id"].includes(flag) && value) || values.has(flag)) {
      throw new Error(`Invalid or duplicate render option: ${flag}`);
    }
    values.set(flag, value);
  }
  const only = values.get("--only") ?? "all";
  const id = values.get("--id");
  if (!["stills", "video", "all", "brand"].includes(only)) {
    throw new Error(`Unknown render type: ${only}`);
  }
  if (id && !MANIFEST.compositions[id]) {
    throw new Error(`Unknown composition: ${id}`);
  }
  const ids = new Set(
    Object.entries(MANIFEST.compositions)
      .filter(
        ([key, entry]) =>
          (only !== "brand" || key in BRAND_COMPOSITIONS) &&
          (!id || key === id) &&
          (only === "all" ||
            entry.type === (only === "video" ? "video" : "still"))
      )
      .map(([key]) => key)
  );
  if (ids.size === 0) {
    throw new Error("No compositions match the render options");
  }
  return ids;
}
