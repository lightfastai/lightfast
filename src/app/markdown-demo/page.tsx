"use client"

import { Markdown } from "@/components/ui/markdown"

const markdownContent = `
# Markdown Demo

This is a demonstration of the **Next.js Markdown** component with proper TypeScript typing.

## Features

- **Bold text** and *italic text*
- \`inline code\` with syntax highlighting
- [Links](https://nextjs.org) with external link handling
- Lists (both ordered and unordered)

### Code Blocks

\`\`\`typescript
interface User {
  id: string
  name: string
  email: string
}

const getUser = async (id: string): Promise<User> => {
  const response = await fetch(\`/api/users/\${id}\`)
  return response.json()
}
\`\`\`

### Lists

#### Unordered List
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

#### Ordered List
1. First step
2. Second step
3. Third step

### Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Markdown | ✅ | Fully supported |
| GFM | ✅ | GitHub Flavored Markdown |
| Syntax Highlighting | 🚧 | Coming soon |

### Blockquotes

> This is a blockquote. It can contain multiple lines
> and even **formatted text**.

### Horizontal Rule

---

### Task Lists (GFM)

- [x] Install react-markdown
- [x] Create custom components
- [x] Add TypeScript types
- [ ] Add syntax highlighting for code blocks

### Math Support

Inline math: $E = mc^2$

Block math:
$$
\\frac{1}{\\sqrt{2\\pi\\sigma^2}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}
$$
`

export default function MarkdownDemoPage() {
  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Markdown Component Demo</h1>
      <div className="bg-background border rounded-lg p-6">
        <Markdown>{markdownContent}</Markdown>
      </div>
    </div>
  )
}
