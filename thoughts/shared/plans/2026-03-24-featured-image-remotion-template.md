# Featured Image Base Composition

## Overview

Add a blank `BlogFeaturedBase` still composition to `packages/app-remotion/` at the standard OG image size. Each blog/changelog post gets its own composition duplicated from this base and designed individually in Remotion Studio.

**Size: 1200 × 630 px @ scale 2 (2400 × 1260 physical)**

## Implementation

### 1. `compositions/blog-featured-base/blog-featured-base.tsx`

```tsx
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

export const BlogFeaturedBase: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return <AbsoluteFill className="bg-background" />;
};
```

### 2. `compositions/blog-featured-base/index.tsx`

```tsx
export { BlogFeaturedBase } from "./blog-featured-base";
```

### 3. `Root.tsx` — register component

```tsx
import { BlogFeaturedBase } from "./compositions/blog-featured-base";

const COMPONENTS = {
  // ...existing
  BlogFeaturedBase,
};
```

### 4. `manifest.ts` — add entry

```ts
"blog-featured-base": {
  type: "still",
  component: "BlogFeaturedBase",
  width: 1200,
  height: 630,
  props: {},
  outputs: [
    { format: "png",  dest: "packages/app-remotion/out/featured", filename: "blog-featured-base.png",  scale: 2 },
    { format: "webp", dest: "packages/app-remotion/out/featured", filename: "blog-featured-base.webp", scale: 2 },
  ],
},
```

## Adding a New Post

1. Duplicate `compositions/blog-featured-base/` → `compositions/blog-<slug>/`
2. Design in Remotion Studio
3. Add manifest entry: same `width: 1200, height: 630, scale: 2`
4. `pnpm render:all --id blog-<slug>`

## Success Criteria

- [ ] Composition visible in Remotion Studio at 1200×630
- [x] `pnpm typecheck` passes
- [ ] `pnpm render:all --id blog-featured-base` produces `out/featured/blog-featured-base.png` at 2400×1260
