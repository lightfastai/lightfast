import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className="relative h-full">
      <AuthenticatedHeader />
      {children}
    </div>
  );
}