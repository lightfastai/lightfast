import { readFile, writeFile } from "node:fs/promises";

const configUrl = new URL("../.vercel/output/config.json", import.meta.url);
const config = JSON.parse(await readFile(configUrl, "utf8"));

if (Array.isArray(config.routes)) {
  const assetRouteIndex = config.routes.findIndex(
    (route) =>
      route?.src === "^/_astro/(.*)$" &&
      route?.headers?.["cache-control"] ===
        "public, max-age=31536000, immutable"
  );
  const filesystemRouteIndex = config.routes.findIndex(
    (route) => route?.handle === "filesystem"
  );

  if (
    assetRouteIndex !== -1 &&
    filesystemRouteIndex !== -1 &&
    assetRouteIndex > filesystemRouteIndex
  ) {
    const [assetRoute] = config.routes.splice(assetRouteIndex, 1);
    config.routes.splice(filesystemRouteIndex, 0, assetRoute);
    await writeFile(configUrl, `${JSON.stringify(config, null, 2)}\n`);
  }
}
