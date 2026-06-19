import { CompanyNavbar } from "./_components/company-navbar";

export default function CompanyGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <CompanyNavbar />
      {children}
    </div>
  );
}
