import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function AccountSettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
    } else if (typeof value === "string") {
      search.set(key, value);
    }
  }

  const query = search.toString();
  redirect(`/account/settings/general${query ? `?${query}` : ""}` as Route);
}
