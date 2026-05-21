import { UserLayoutShell } from "~/components/user-layout-shell";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserLayoutShell>{children}</UserLayoutShell>;
}
