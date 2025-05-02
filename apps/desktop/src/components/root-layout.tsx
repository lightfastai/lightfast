import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

import { ThemeProvider, useTheme } from "@repo/ui/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { ContentLayout } from "./content-layout";
import { AppSidebar } from "./sidebar";
import { TitleBar } from "./title-bar";
import { WorkspaceContainer } from "./workspace-container";

export interface RootLayoutProps {
  children: React.ReactNode;
}

function RootLayoutContent({ children }: RootLayoutProps) {
  const { theme } = useTheme();

  // Initialize global keyboard shortcuts (Cmd+S, Cmd+B for sidebar toggle)
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-full flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <SidebarInset>
          <WorkspaceContainer>
            <ContentLayout>{children}</ContentLayout>
          </WorkspaceContainer>
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
