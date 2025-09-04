import type { Metadata } from "next";
import { SettingsNav } from "~/components/settings/settings-nav";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account settings and preferences.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Settings Navigation - Sidebar on desktop, tabs on mobile */}
        <aside className="lg:w-64 flex-shrink-0">
          <SettingsNav />
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-card border rounded-xl overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}