import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function AccountSettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = new URL(
    "/account/settings/general",
    "https://lightfast.localhost"
  );

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        target.searchParams.append(key, item);
      }
    } else if (typeof value === "string") {
      target.searchParams.set(key, value);
    }
  }

  redirect(`${target.pathname}${target.search}` as Route);
}
