# Lightfast Hot Reload System

The Lightfast CLI includes a comprehensive hot-reload system that automatically watches and recompiles configuration files during development, providing real-time feedback and seamless developer experience.

## Components

### 1. ConfigWatcher (`src/compiler/watcher.ts`)

File watching service that monitors Lightfast configuration files for changes.

**Features:**
- Monitors TypeScript, JavaScript, and JSX configuration files
- Debounced recompilation (500ms default) to avoid excessive rebuilds
- Support for multiple configuration file patterns
- EventEmitter-based architecture for real-time notifications
- Automatic detection of new/removed configuration files
- Built-in error handling and recovery

**Basic Usage:**
```typescript
import { createConfigWatcher } from '@lightfastai/cli/compiler';

const watcher = createConfigWatcher({
  baseDir: process.cwd(),
  debounceDelay: 500,
  debug: true
});

watcher.on('compile-success', (result) => {
  console.log('Configuration recompiled successfully!');
});

await watcher.start();
```

**Events:**
- `watcher-ready`: Watcher is ready and monitoring files
- `compile-start`: Compilation has started
- `compile-success`: Compilation completed successfully
- `compile-error`: Compilation failed with errors
- `config-added`: New configuration file detected
- `config-removed`: Configuration file was deleted
- `watcher-error`: Watcher encountered an error

### 2. HotReloadService (`src/server/hot-reload.ts`)

Server-Sent Events (SSE) service that provides real-time hot-reload notifications to connected clients.

**Features:**
- WebSocket-like real-time communication via SSE
- Multiple client connection management
- Automatic connection cleanup and ping/pong heartbeat
- Integration with ConfigWatcher events
- Structured event messaging with timestamps

**Basic Usage:**
```typescript
import { createSSEHandler } from '@lightfastai/cli/compiler';

const watcher = createConfigWatcher();
const handler = createSSEHandler(watcher, { debug: true });

// In your server route:
return handler.handleRequest(request);
```

### 3. API Endpoint (`src/routes/api/hot-reload.ts`)

TanStack Start server route that provides the hot-reload SSE endpoint and control API.

**Endpoints:**
- `GET /api/hot-reload`: Server-Sent Events endpoint for real-time updates
- `POST /api/hot-reload`: Control API for force compilation and status

**Control Actions:**
```typescript
// Force recompilation
await fetch('/api/hot-reload', {
  method: 'POST',
  body: JSON.stringify({ action: 'force-compile' })
});

// Get service information
await fetch('/api/hot-reload', {
  method: 'POST', 
  body: JSON.stringify({ action: 'get-info' })
});
```

### 4. React Hook (`src/hooks/useHotReload.ts`)

React hook that consumes hot-reload events and manages connection state.

**Features:**
- Real-time connection status
- Compilation state tracking
- Automatic reconnection on connection loss
- Event callbacks for custom handling
- TypeScript-first API

**Usage:**
```tsx
import { useHotReload } from '../hooks/useHotReload';

function ConfigStatus() {
  const [state, actions] = useHotReload({
    debug: true,
    onCompileSuccess: () => console.log('Config updated!'),
    onCompileError: (error) => console.error('Compile error:', error)
  });
  
  return (
    <div>
      <p>Status: {state.connected ? 'Connected' : 'Disconnected'}</p>
      <p>Compiling: {state.isCompiling ? 'Yes' : 'No'}</p>
      <p>Watched files: {state.watchedPaths.length}</p>
      
      <button onClick={actions.forceCompile}>
        Force Recompile
      </button>
    </div>
  );
}
```

### 5. HotReloadStatus Component (`src/components/HotReloadStatus.tsx`)

Pre-built React component that displays hot-reload status and controls.

**Features:**
- Visual status indicators with icons
- Compilation progress and results
- File watching information
- Manual controls (force compile, reconnect)
- Detailed mode for development debugging

**Usage:**
```tsx
import HotReloadStatus from '../components/HotReloadStatus';

function DevTools() {
  return (
    <div>
      <h2>Development Tools</h2>
      <HotReloadStatus detailed={true} />
    </div>
  );
}
```

## Integration

The hot-reload system is automatically integrated into the Lightfast CLI development server. When you run:

```bash
lightfast dev
```

The system will:
1. Start the ConfigWatcher to monitor your configuration files
2. Expose the SSE endpoint at `/api/hot-reload`
3. Display the HotReloadStatus component in the development UI
4. Automatically recompile and reload when you save changes to your `lightfast.config.ts`

## Configuration Files Supported

The system automatically watches for these configuration file patterns:
- `lightfast.config.ts`
- `lightfast.config.tsx`
- `lightfast.config.js`
- `lightfast.config.jsx`
- `lightfast.config.mjs`

## Development Benefits

**Instant Feedback:** See compilation errors and warnings immediately as you edit configuration files.

**Zero-Config:** Works out of the box with sensible defaults - no setup required.

**Type Safety:** Full TypeScript integration with proper type definitions for all APIs.

**Performance:** Debounced compilation prevents excessive rebuilds while maintaining responsiveness.

**Reliability:** Robust error handling and automatic recovery from connection issues.

**Extensibility:** EventEmitter-based architecture makes it easy to extend with custom functionality.

## Example: Standalone Usage

You can also use the hot-reload system outside of the CLI for custom tooling:

```javascript
#!/usr/bin/env node
import { createConfigWatcher } from '@lightfastai/cli/compiler';

const watcher = createConfigWatcher({
  baseDir: process.cwd(),
  debug: true
});

watcher.on('compile-success', (result) => {
  console.log(`✅ Compiled in ${result.compilationTime}ms`);
});

watcher.on('compile-error', (error) => {
  console.error(`❌ Error: ${error.message}`);
});

await watcher.start();
console.log('🔥 Hot reload active - edit your config files!');
```

## Architecture

```
Configuration File Changes
           ↓
    ConfigWatcher (chokidar)
           ↓
    Debounced Compilation
           ↓
    EventEmitter Events
           ↓
    HotReloadService (SSE)
           ↓
    WebSocket-like Clients
           ↓
    React Components
```

The system is designed with separation of concerns:
- **File watching** is handled by chokidar through ConfigWatcher
- **Compilation** is handled by the existing LightfastCompiler
- **Real-time communication** is handled by HotReloadService
- **UI integration** is handled by React hooks and components

This modular approach makes each component testable and reusable independently.