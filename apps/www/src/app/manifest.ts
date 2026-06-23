import type { MetadataRoute } from "next";
import { buildSiteManifest } from "~/lib/site/identity";

export default function manifest(): MetadataRoute.Manifest {
  return buildSiteManifest();
}
