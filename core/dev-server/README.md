# @lightfastai/dev-server

Modern React-based development server UI for Lightfast agents. Built with TanStack Start, React 19, and Vite for a blazing-fast development experience.

## Overview

The dev-server provides:

- 🎨 **Beautiful UI**: Modern interface for agent management
- ⚡ **Fast Refresh**: Instant updates with Vite HMR
- 🚀 **SSR Support**: Server-side rendering with TanStack Start
- 📊 **Agent Dashboard**: View and manage all agents
- 🔄 **Hot Reload**: Automatic UI updates on config changes
- 📱 **Responsive**: Works on desktop and mobile

## Tech Stack

- **Framework**: TanStack Start (full-stack React)
- **UI Library**: React 19
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4
- **Server**: Nitro (production server)
- **Components**: Shadcn/ui inspired components

## Architecture

```
dev-server/
├── src/
│   ├── routes/              # TanStack Router pages
│   │   ├── index.tsx       # Home page
│   │   ├── agents.tsx      # Agents list
│   │   └── api/            # API routes
│   │       ├── agents.ts   # Agents API
│   │       └── hot-reload.ts # Hot reload API
│   ├── components/          # React components
│   │   ├── ui/             # Base UI components
│   │   └── agents/         # Agent-specific components
│   ├── server/             # Server-side utilities
│   │   └── agent-discovery.ts # Agent introspection
│   ├── styles/             # Global styles
│   │   └── globals.css     # Tailwind imports
│   └── app.tsx             # App root
├── .output/                # Production build
│   ├── public/             # Client assets
│   └── server/             # SSR server
├── vite.config.ts          # Vite configuration
└── package.json
```

## Pages & Routes

### Home Page (`/`)

Landing page with:
- Lightfast branding
- Quick stats
- Navigation to agents

### Agents Page (`/agents`)

Agent management interface:
- List all configured agents
- Agent details and metadata
- Quick actions

### API Routes

#### `GET /api/agents`

Returns all configured agents:

```typescript
interface AgentsResponse {
  success: boolean
  data: {
    agents: Agent[]
    metadata: {
      name: string
      version: string
    }
  }
}
```

#### `GET /api/agents/:agentId`

Returns specific agent details:

```typescript
interface AgentResponse {
  success: boolean
  data: Agent
}
```

#### `GET /api/hot-reload`

SSE endpoint for hot reload notifications:

```typescript
// Server-sent events
event: reload
data: { timestamp: number }
```

## Components

### UI Components

Base components in `src/components/ui/`:

- `Button` - Styled button component
- `Card` - Content card container
- `Badge` - Status badges
- `Alert` - Alert messages
- `Skeleton` - Loading placeholders

### Agent Components

Specialized components in `src/components/agents/`:

- `AgentCard` - Agent display card
- `AgentList` - Agent grid/list view
- `AgentDetails` - Detailed agent view
- `AgentStatus` - Status indicators

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm start
```

### Environment Variables

```bash
# .env
PORT=3000                    # Server port
HOST=localhost              # Server host
LIGHTFAST_PROJECT_ROOT=/path # Project root for config discovery
```

## Build Process

### Development Build

```bash
pnpm dev
# Starts Vite dev server with HMR
# Available at http://localhost:3000
```

### Production Build

```bash
pnpm build

# 1. Vite builds client bundle → .tanstack/start/build/client-dist/
# 2. Vite builds SSR bundle → .tanstack/start/build/server/
# 3. Nitro packages everything → .output/
```

### Build Output

```
.output/
├── public/                  # Static assets
│   ├── assets/
│   │   ├── main-[hash].js  # Client bundle (~300KB)
│   │   └── globals-[hash].css # Styles (~22KB)
│   └── .vite/
│       └── manifest.json    # Asset manifest
└── server/                  # SSR server
    ├── index.mjs           # Server entry
    ├── chunks/             # Server chunks
    └── node_modules/       # Bundled deps
```

## Styling

### Tailwind Configuration

Using Tailwind CSS v4 with CSS variables:

```css
/* src/styles/globals.css */
@import "tailwindcss/base";
@import "tailwindcss/components";
@import "tailwindcss/utilities";

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... more variables */
}
```

### Component Styling

Using `cn` utility for conditional classes:

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  "rounded-lg border p-4",
  isActive && "bg-primary text-white"
)} />
```

## Server Integration

### Agent Discovery

The server discovers agents from the compiled config:

```typescript
// src/server/agent-discovery.ts
export async function discoverAgents() {
  const configPath = path.join(
    process.env.LIGHTFAST_PROJECT_ROOT,
    '.lightfast/config.js'
  )
  
  const config = await import(configPath)
  return config.default.agents
}
```

### Hot Reload Integration

Watches for config changes and notifies UI:

```typescript
// Watch config file
watcher.on('change', () => {
  // Send SSE to connected clients
  clients.forEach(client => {
    client.write('event: reload\ndata: {}\n\n')
  })
})
```

## Performance

### Optimization Techniques

1. **Code Splitting**: Automatic route-based splitting
2. **Tree Shaking**: Removes unused code
3. **Compression**: Gzip/Brotli for assets
4. **Caching**: Immutable asset caching
5. **SSR**: Fast initial page loads

### Bundle Sizes

- Client bundle: ~300KB (gzipped: ~97KB)
- CSS bundle: ~22KB (gzipped: ~5KB)
- Total transfer: ~102KB gzipped

## Deployment

The dev-server is not deployed independently. It's:

1. Built during CLI build process
2. Output copied to CLI package
3. Served by CLI dev command

## API Integration

### Fetching Agents

```typescript
// Using TanStack Query
import { useQuery } from '@tanstack/react-query'

function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => fetch('/api/agents').then(r => r.json())
  })
}
```

### Hot Reload Hook

```typescript
// Custom hook for hot reload
function useHotReload() {
  useEffect(() => {
    const sse = new EventSource('/api/hot-reload')
    
    sse.onmessage = () => {
      window.location.reload()
    }
    
    return () => sse.close()
  }, [])
}
```

## File Structure Details

```
dev-server/
├── src/
│   ├── routes/
│   │   ├── index.tsx        # ~100 lines - Home page
│   │   ├── agents.tsx       # ~150 lines - Agents list
│   │   └── api/
│   │       ├── agents.ts    # ~80 lines - Agents API
│   │       └── hot-reload.ts # ~50 lines - SSE endpoint
│   ├── components/
│   │   ├── ui/              # ~500 lines total - Base components
│   │   └── agents/          # ~300 lines total - Agent components
│   ├── server/
│   │   └── agent-discovery.ts # ~60 lines - Config loading
│   └── app.tsx              # ~50 lines - App setup
├── .output/                 # ~3MB production build
├── vite.config.ts           # ~20 lines - Vite config
└── package.json
```

## Testing

```bash
# Run tests (when implemented)
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Troubleshooting

### Common Issues

**Vite HMR not working**
```bash
# Check Vite is running
ps aux | grep vite

# Restart dev server
pnpm dev
```

**Build fails**
```bash
# Clean and rebuild
rm -rf .output .tanstack node_modules
pnpm install
pnpm build
```

**Fonts not loading**
```bash
# Fonts are referenced but not bundled
# This is expected - they load at runtime
```

## Contributing

When modifying the dev-server:

1. Make changes in `src/`
2. Test with `pnpm dev`
3. Build with `pnpm build`
4. Test production with `pnpm start`
5. Run full CLI build to integrate

## Future Enhancements

- [ ] Agent testing interface
- [ ] Real-time agent execution
- [ ] Configuration editor
- [ ] Performance monitoring
- [ ] Dark mode support

## License

MIT © Lightfast

---

Part of the [Lightfast](https://github.com/lightfastai/lightfast) monorepo