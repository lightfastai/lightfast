import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/settings/")({
  component: AccountSettingsIndexRedirect,
});

function AccountSettingsIndexRedirect() {
  const search = Route.useSearch();
  return <Navigate replace search={search} to="/account/settings/general" />;
}
