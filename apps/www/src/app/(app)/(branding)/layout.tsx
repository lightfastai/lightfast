import { BrandingNavbar } from "~/components/landing/branding-navbar";

/**
 * Branding Layout
 *
 * Minimal layout for brand pages (manifesto, about, etc.)
 * Uses custom BrandingNavbar with menu sheet and blur effects
 * Each page controls its own content structure
 */
export default function BrandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <BrandingNavbar />
      {children}
    </div>
  );
}
