import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/settings/")({
  component: AccountSettingsIndexRedirect,
});

function AccountSettingsIndexRedirect() {
  return <Navigate replace to="/account/settings/general" />;
}
