import { clerkSetup } from "@clerk/testing/playwright";
import { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  await clerkSetup();
}
