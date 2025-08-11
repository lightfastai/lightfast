import { UnauthenticatedHeader } from "~/components/layouts/unauthenticated-header";

interface UnauthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function UnauthenticatedLayout({ children }: UnauthenticatedLayoutProps) {
  return (
    <div className="relative h-full">
      <UnauthenticatedHeader />
      {children}
    </div>
  );
}