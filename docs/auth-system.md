# Modular Authentication System

This document explains the modular authentication system that has been created to eliminate code duplication and improve reusability across the application.

## Overview

The auth system has been refactored into reusable components and hooks that can be easily imported and used throughout the application.

## Components

### Core Auth Components

All auth components are located in `src/components/auth/` and can be imported from the barrel export:

```tsx
import {
  SignInButton,
  SignOutButton,
  UserDropdown,
  AuthWrapper,
  AuthenticatedOnly,
  UnauthenticatedOnly,
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "@/components/auth"
```

#### SignInButton

A reusable sign-in button component with customizable props:

```tsx
<SignInButton
  className="w-full"
  size="lg"
  variant="default"
  provider="github"
  onSignInStart={() => console.log("Starting sign in...")}
  onSignInComplete={() => console.log("Sign in complete!")}
>
  Custom Sign In Text
</SignInButton>
```

**Props:**
- `className?`: CSS classes
- `size?`: Button size ("default" | "sm" | "lg" | "icon")
- `variant?`: Button variant
- `provider?`: Auth provider (defaults to "github")
- `children?`: Custom button content
- `onSignInStart?`: Callback when sign in starts
- `onSignInComplete?`: Callback when sign in completes

#### SignOutButton

A reusable sign-out button with automatic auth state detection:

```tsx
<SignOutButton
  className="w-full"
  variant="outline"
  redirectTo="/signin"
  showOnlyWhenAuthenticated={true}
  onSignOutComplete={() => console.log("Signed out!")}
>
  Sign Out
</SignOutButton>
```

**Props:**
- `className?`: CSS classes
- `size?`: Button size
- `variant?`: Button variant
- `children?`: Custom button content
- `redirectTo?`: Redirect path after sign out (default: "/signin")
- `showOnlyWhenAuthenticated?`: Only show when user is authenticated (default: true)
- `onSignOutStart?`: Callback when sign out starts
- `onSignOutComplete?`: Callback when sign out completes

#### UserDropdown

A dropdown component showing user info and actions:

```tsx
<UserDropdown
  className="custom-class"
  showEmail={true}
  showSettings={true}
  settingsHref="/profile"
  onSignOut={() => console.log("Signing out...")}
/>
```

**Props:**
- `className?`: CSS classes
- `showEmail?`: Show user email (default: true)
- `showSettings?`: Show settings/profile link (default: true)
- `settingsHref?`: Settings page URL (default: "/profile")
- `onSignOut?`: Callback before sign out

#### AuthWrapper

A wrapper component that handles different authentication states:

```tsx
<AuthWrapper
  requireAuth={false}
  loadingComponent={<CustomLoader />}
  fallback={<CustomUnauthorized />}
>
  <YourContent />
</AuthWrapper>
```

**Props:**
- `children`: Content to render
- `fallback?`: Custom fallback for unauthenticated users
- `loadingComponent?`: Custom loading component
- `requireAuth?`: Whether authentication is required (default: false)

#### AuthenticatedOnly & UnauthenticatedOnly

Convenience wrappers for conditional rendering:

```tsx
<AuthenticatedOnly fallback={<SignInPrompt />}>
  <ProtectedContent />
</AuthenticatedOnly>

<UnauthenticatedOnly>
  <PublicOnlyContent />
</UnauthenticatedOnly>
```

## Hooks

### useAuth

The main auth hook providing comprehensive auth functionality:

```tsx
import { useAuth } from "@/components/auth"

function MyComponent() {
  const {
    // Auth state
    isAuthenticated,
    isLoading,
    user,

    // Auth actions
    signIn,
    signOut,

    // User info helpers
    displayName,
    email,
    isAnonymous,
    createdAt,
  } = useAuth()

  const handleSignIn = async () => {
    try {
      await signIn("github")
    } catch (error) {
      console.error("Sign in failed:", error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {isAuthenticated ? (
        <p>Welcome, {displayName}!</p>
      ) : (
        <button onClick={handleSignIn}>Sign In</button>
      )}
    </div>
  )
}
```

### useCurrentUser

Hook for getting current user data (returns null when unauthenticated):

```tsx
import { useCurrentUser } from "@/components/auth"

function UserProfile() {
  const user = useCurrentUser()

  if (!user) {
    return <p>Please sign in</p>
  }

  return <p>Hello, {user.name}!</p>
}
```

### useAuthState

Hook for auth state only (no user data):

```tsx
import { useAuthState } from "@/components/auth"

function AuthStatus() {
  const { isAuthenticated, isLoading, isUnauthenticated } = useAuthState()

  return (
    <div>
      {isLoading && <p>Checking auth...</p>}
      {isAuthenticated && <p>Signed in</p>}
      {isUnauthenticated && <p>Not signed in</p>}
    </div>
  )
}
```

## Server-Side Auth

Server-side auth utilities are available in `src/lib/auth.ts`:

```tsx
import { getCurrentUser, isAuthenticated, getAuthToken } from "@/lib/auth"

// In a Server Component or Server Action
export default async function ProfilePage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect("/signin")
  }

  const user = await getCurrentUser()

  return <div>Welcome, {user?.name}!</div>
}
```

## Migration Guide

### Before (Duplicated Code)

```tsx
// Old way - duplicated across multiple files
function MyComponent() {
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()

  return (
    <div>
      {isAuthenticated ? (
        <UserInfo />
      ) : (
        <Button onClick={() => signIn("github")}>
          Sign In
        </Button>
      )}
    </div>
  )
}
```

### After (Modular)

```tsx
// New way - using modular components
import { SignInButton, UserDropdown, Authenticated, Unauthenticated } from "@/components/auth"

function MyComponent() {
  return (
    <div>
      <Authenticated>
        <UserDropdown />
      </Authenticated>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
    </div>
  )
}
```

## Best Practices

1. **Use the appropriate hook**:
   - `useAuth()` for full auth functionality
   - `useCurrentUser()` when you only need user data
   - `useAuthState()` when you only need auth status

2. **Leverage components**: Use the pre-built components instead of recreating auth UI

3. **Server-side auth**: Use `src/lib/auth.ts` utilities for server-side operations

4. **Error handling**: Always wrap auth operations in try-catch blocks

5. **Loading states**: Use the loading states provided by hooks and components

6. **Consistent styling**: Pass className and variant props to match your design system

## File Structure

```
src/
├── components/
│   └── auth/
│       ├── index.ts              # Barrel exports
│       ├── SignInButton.tsx      # Sign in component
│       ├── SignOutButton.tsx     # Sign out component
│       ├── UserDropdown.tsx      # User dropdown
│       └── AuthWrapper.tsx       # Auth wrapper components
├── hooks/
│   └── useAuth.ts               # Auth hooks
└── lib/
    └── auth.ts                  # Server-side auth utilities
```

This modular system eliminates code duplication, provides type safety, and makes auth functionality easily reusable across the entire application.
