import type { Metadata } from "next";
import { ApiKeysPageClient } from "./page-client";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "API Keys - Settings",
  description: "Manage your API keys and access tokens.",
});

export default function ApiKeysPage() {
  return <ApiKeysPageClient />;
}
