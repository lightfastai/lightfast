#!/bin/bash

# Generate type declarations
npx tsc --emitDeclarationOnly

# Move declarations to the correct locations
copy_dts() {
  # Server adapters
  cp dist/src/core/server/adapters/fetch.d.ts dist/server/adapters/fetch.d.ts 2>/dev/null
  cp dist/src/core/server/adapters/fetch.d.ts.map dist/server/adapters/fetch.d.ts.map 2>/dev/null
  cp dist/src/core/server/adapters/types.d.ts dist/server/adapters/types.d.ts 2>/dev/null
  cp dist/src/core/server/adapters/types.d.ts.map dist/server/adapters/types.d.ts.map 2>/dev/null
  
  # Core primitives
  cp dist/src/core/primitives/agent.d.ts dist/agent.d.ts 2>/dev/null
  cp dist/src/core/primitives/agent.d.ts.map dist/agent.d.ts.map 2>/dev/null
  cp dist/src/core/primitives/tool.d.ts dist/tool.d.ts 2>/dev/null
  cp dist/src/core/primitives/tool.d.ts.map dist/tool.d.ts.map 2>/dev/null
  
  # Memory
  cp dist/src/core/memory/index.d.ts dist/memory.d.ts 2>/dev/null
  cp dist/src/core/memory/index.d.ts.map dist/memory.d.ts.map 2>/dev/null
  cp dist/src/core/memory/adapters/in-memory.d.ts dist/memory/adapters/in-memory.d.ts 2>/dev/null
  cp dist/src/core/memory/adapters/in-memory.d.ts.map dist/memory/adapters/in-memory.d.ts.map 2>/dev/null
  cp dist/src/core/memory/adapters/redis.d.ts dist/memory/adapters/redis.d.ts 2>/dev/null
  cp dist/src/core/memory/adapters/redis.d.ts.map dist/memory/adapters/redis.d.ts.map 2>/dev/null
  
  # Cache
  cp dist/src/core/primitives/cache/index.d.ts dist/cache.d.ts 2>/dev/null
  cp dist/src/core/primitives/cache/index.d.ts.map dist/cache.d.ts.map 2>/dev/null
  
  # Providers
  cp dist/src/utils/providers.d.ts dist/providers.d.ts 2>/dev/null
  cp dist/src/utils/providers.d.ts.map dist/providers.d.ts.map 2>/dev/null
  
  # V2 exports
  cp dist/src/core/v2/agent.d.ts dist/v2/agent.d.ts 2>/dev/null
  cp dist/src/core/v2/agent.d.ts.map dist/v2/agent.d.ts.map 2>/dev/null
  cp dist/src/v2/server.d.ts dist/v2/server.d.ts 2>/dev/null
  cp dist/src/v2/server.d.ts.map dist/v2/server.d.ts.map 2>/dev/null
  cp dist/src/v2/react.d.ts dist/v2/react.d.ts 2>/dev/null
  cp dist/src/v2/react.d.ts.map dist/v2/react.d.ts.map 2>/dev/null
  cp dist/src/core/v2/core.d.ts dist/v2/core.d.ts 2>/dev/null
  cp dist/src/core/v2/core.d.ts.map dist/v2/core.d.ts.map 2>/dev/null
  cp dist/src/core/v2/index.d.ts dist/v2/index.d.ts 2>/dev/null
  cp dist/src/core/v2/index.d.ts.map dist/v2/index.d.ts.map 2>/dev/null
  cp dist/src/core/v2/utils/index.d.ts dist/v2/utils.d.ts 2>/dev/null
  cp dist/src/core/v2/utils/index.d.ts.map dist/v2/utils.d.ts.map 2>/dev/null
  cp dist/src/core/v2/server/events/types.d.ts dist/v2/events.d.ts 2>/dev/null
  cp dist/src/core/v2/server/events/types.d.ts.map dist/v2/events.d.ts.map 2>/dev/null
  cp dist/src/core/v2/env.d.ts dist/v2/env.d.ts 2>/dev/null
  cp dist/src/core/v2/env.d.ts.map dist/v2/env.d.ts.map 2>/dev/null
  cp dist/src/core/v2/braintrust-env.d.ts dist/v2/braintrust-env.d.ts 2>/dev/null
  cp dist/src/core/v2/braintrust-env.d.ts.map dist/v2/braintrust-env.d.ts.map 2>/dev/null
}

# Execute the copy
copy_dts

# Clean up nested source directories (but keep v2 for JS files)
rm -rf dist/src

echo "Type declarations generated successfully"