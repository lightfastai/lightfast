import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col bg-background">
      <UserPageHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
