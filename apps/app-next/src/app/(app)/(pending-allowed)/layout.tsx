import { ShellDataBoundary } from "~/components/shell-data-boundary";
import { UserLayoutShell } from "~/components/user-layout-shell";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellDataBoundary>
      <UserLayoutShell>{children}</UserLayoutShell>
    </ShellDataBoundary>
  );
}
