# Next.js 15 Best Practices Guide

Best practices for Next.js 15 App Router in the lightfast-experimental web application (`apps/www/`), focusing on Server-Side Rendering (SSR), Suspense, loading states, and error handling.

## Core Principles

### 1. Server Components by Default
- **Always start with Server Components** - they're the default in App Router
- **Use Client Components only when necessary**:
  - User interactions (onClick, onChange)
  - Browser-only APIs (window, localStorage)
  - React hooks (useState, useEffect)
  - Third-party libraries requiring browser environment

```typescript
// Server Component (default)
// app/components/UserList.tsx
async function UserList() {
  const users = await fetchUsers(); // Direct async/await
  return <ul>{users.map(user => <li key={user.id}>{user.name}</li>)}</ul>;
}

// Client Component (when needed)
// app/components/SearchBar.tsx
'use client';

import { useState } from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

## Loading States & Suspense

### Route-Level Loading with `loading.js`

Create a `loading.js` file in any route segment to show loading UI:

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}
```

### Component-Level Suspense

Wrap async components or dynamic imports with Suspense:

```typescript
// app/page.tsx
import { Suspense } from 'react';
import { UserList } from './components/UserList';
import { LoadingSkeleton } from './components/LoadingSkeleton';

export default function Page() {
  return (
    <main>
      <h1>Users</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <UserList />
      </Suspense>
    </main>
  );
}
```

### Critical: `useSearchParams` Requires Suspense

```typescript
// ❌ Bad - Causes entire page to render client-side
'use client';
import { useSearchParams } from 'next/navigation';

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  return <div>Results for: {query}</div>;
}

// ✅ Good - Wrapped in Suspense
'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  return <div>Results for: {query}</div>;
}

export function SearchResults() {
  return (
    <Suspense fallback={<div>Loading search results...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
```

## Error Handling

### Route-Level Error Boundaries with `error.js`

Create an `error.js` file to catch errors in a route segment:

```typescript
// app/dashboard/error.tsx
'use client'; // Error boundaries must be Client Components

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button
        onClick={() => reset()}
        className="retry-button"
      >
        Try again
      </button>
    </div>
  );
}
```

### Global Error Handling

For app-wide error catching, create `app/global-error.js`:

```typescript
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="global-error">
          <h1>Application Error</h1>
          <p>{error.message}</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

### Not Found Handling

Use `not-found.js` for custom 404 pages:

```typescript
// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <h2>Page Not Found</h2>
      <p>Could not find the requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  );
}

// Trigger programmatically
import { notFound } from 'next/navigation';

async function UserPage({ params }: { params: { id: string } }) {
  const user = await getUser(params.id);
  
  if (!user) {
    notFound(); // Renders the closest not-found.js
  }
  
  return <UserProfile user={user} />;
}
```

## Data Fetching Patterns

### Avoid Sequential Waterfalls

```typescript
// ❌ Bad - Sequential fetching
async function Page() {
  const user = await fetchUser();
  const posts = await fetchUserPosts(user.id); // Waits for user
  const comments = await fetchPostComments(posts[0].id); // Waits for posts
  
  return <div>...</div>;
}

// ✅ Good - Parallel fetching
async function Page() {
  const userData = fetchUser();
  const postsData = fetchUserPosts();
  const commentsData = fetchComments();
  
  // Parallel resolution
  const [user, posts, comments] = await Promise.all([
    userData,
    postsData,
    commentsData
  ]);
  
  return <div>...</div>;
}
```

### Preload Pattern

```typescript
// utils/data.ts
import { cache } from 'react';

// Preload function
export const preloadUser = (id: string) => {
  void getUser(id);
};

// Cached data fetching
export const getUser = cache(async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// app/users/[id]/page.tsx
import { preloadUser, getUser } from '@/utils/data';

export default async function UserPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Start loading immediately
  preloadUser(params.id);
  
  // Other operations...
  
  // Use the data (already loading)
  const user = await getUser(params.id);
  
  return <UserProfile user={user} />;
}
```

## Streaming Patterns

### Progressive Page Rendering

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react';

// Fast static shell
export default function DashboardPage() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {/* Immediate render */}
      <nav>
        <Link href="/dashboard/analytics">Analytics</Link>
        <Link href="/dashboard/reports">Reports</Link>
      </nav>
      
      {/* Stream in when ready */}
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats />
      </Suspense>
      
      <Suspense fallback={<ChartsLoading />}>
        <DashboardCharts />
      </Suspense>
    </div>
  );
}
```

## File Structure Best Practices

```
app/
├── (auth)/                 # Route group (no URL impact)
│   ├── login/
│   │   ├── page.tsx
│   │   └── loading.tsx
│   └── register/
│       ├── page.tsx
│       └── error.tsx
├── dashboard/
│   ├── layout.tsx         # Shared layout
│   ├── page.tsx           # /dashboard
│   ├── loading.tsx        # Loading UI
│   ├── error.tsx          # Error boundary
│   └── analytics/
│       └── page.tsx       # /dashboard/analytics
├── api/                   # API routes
│   └── users/
│       └── route.ts       # /api/users
├── components/            # Shared components
│   ├── ui/               # UI components
│   └── providers/        # Context providers
├── lib/                  # Utilities
├── layout.tsx            # Root layout
├── page.tsx              # Home page
├── error.tsx             # Root error boundary
├── not-found.tsx         # 404 page
└── global-error.tsx      # Global error boundary
```

## Performance Optimization

### 1. Partial Prerendering (PPR)
```typescript
// Enable in next.config.js
export default {
  experimental: {
    ppr: 'incremental',
  },
};
```

### 2. Static Generation with Dynamic Boundaries
```typescript
// Mostly static page with dynamic user section
export default async function Page() {
  return (
    <article>
      {/* Static content */}
      <h1>Welcome to our site</h1>
      <p>This content is statically generated...</p>
      
      {/* Dynamic boundary */}
      <Suspense fallback={<UserSkeleton />}>
        <CurrentUser />
      </Suspense>
    </article>
  );
}
```

### 3. Optimize Client Component Bundles
```typescript
// Use dynamic imports for heavy client components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(
  () => import('./components/HeavyChart'),
  { 
    loading: () => <ChartSkeleton />,
    ssr: false // Only load on client
  }
);
```

## Common Pitfalls & Solutions

### 1. Hydration Mismatches
```typescript
// ❌ Bad - Causes hydration mismatch
function TimeDisplay() {
  return <div>{new Date().toLocaleTimeString()}</div>;
}

// ✅ Good - Consistent between server and client
'use client';
function TimeDisplay() {
  const [time, setTime] = useState<string>();
  
  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []);
  
  return <div>{time || 'Loading...'}</div>;
}
```

### 2. Mixing Server and Client Data
```typescript
// ❌ Bad - Can't pass functions from Server to Client
async function ServerComponent() {
  const handleClick = () => { /* ... */ };
  return <ClientComponent onClick={handleClick} />;
}

// ✅ Good - Keep interactions in Client Components
async function ServerComponent() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}
```

### 3. Over-using Client Components
```typescript
// ❌ Bad - Entire page is client-side
'use client';
export default function Page() {
  return (
    <div>
      <Header />      {/* Could be server */}
      <StaticContent /> {/* Could be server */}
      <InteractiveForm /> {/* Needs to be client */}
    </div>
  );
}

// ✅ Good - Only interactive parts are client
export default function Page() {
  return (
    <div>
      <Header />        {/* Server Component */}
      <StaticContent /> {/* Server Component */}
      <InteractiveForm /> {/* Client Component */}
    </div>
  );
}
```

## Testing Checklist

Before deploying, ensure:

- [ ] All async components are wrapped in Suspense
- [ ] Error boundaries are in place for critical paths
- [ ] Loading states provide meaningful feedback
- [ ] `useSearchParams` is properly wrapped
- [ ] Data fetching avoids waterfalls
- [ ] Client Components are used only when necessary
- [ ] No hydration warnings in development
- [ ] Proper 404 and error handling
- [ ] Metadata is set for SEO
- [ ] Environment variables are properly configured

## Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [Patterns for Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching/patterns)
- [Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)