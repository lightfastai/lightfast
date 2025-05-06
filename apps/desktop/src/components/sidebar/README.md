# Sidebar Components

This directory contains all the components used in the application sidebar.

## Structure

- `app-sidebar.tsx` - Main sidebar component that composes all other components
- `connection-indicators.tsx` - Shows connection status for various services
- `sessions-group.tsx` - Manages sessions with touch/swipe navigation
- `user-dropdown.tsx` - User profile and settings dropdown
- `workspaces-group.tsx` - Workspace navigation and selection
- `use-create-workspace.tsx` - Hook for workspace creation logic

## Usage

The sidebar is used in the root layout and provides navigation between workspaces and sessions.

```tsx
import { AppSidebar } from "@/components/sidebar";

function Layout() {
  return (
    <div>
      <AppSidebar />
      {/* Rest of the app */}
    </div>
  );
}
```

## Touch Navigation

The sessions group implements touch/swipe navigation between sessions. Users can swipe left or right on the sessions section to navigate between their chat sessions.
