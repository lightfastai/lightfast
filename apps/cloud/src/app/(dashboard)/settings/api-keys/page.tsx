import type { Metadata } from "next";
import { ApiKeysPageClient } from "./page-client";

export const metadata: Metadata = {
  title: "API Keys",
  description: "Manage your API keys and access tokens.",
};

export default function ApiKeysPage() {
  return <ApiKeysPageClient />;
}