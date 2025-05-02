import { ThemeProvider, useTheme } from "@repo/ui/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "./sidebar";
import { TitleBar } from "./title-bar";
import { WorkspaceContainer } from "./workspace-container";

export interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayoutContent({ children }: RootLayoutProps) {
  const { theme } = useTheme();

  return (
    <div className="bg-background flex h-screen w-full flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <SidebarInset>
          <WorkspaceContainer>{children}</WorkspaceContainer>
        </SidebarInset>
      </div>
    </div>
  );
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <SidebarProvider defaultOpen>
        <RootLayoutContent>{children}</RootLayoutContent>
      </SidebarProvider>
    </ThemeProvider>
  );
}
