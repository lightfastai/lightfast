# Lightfast Examples

This directory contains example projects demonstrating Lightfast usage.

## ⚠️ Important: Opt-In Installation

Examples are **excluded from the root workspace** to keep core development fast. You must install dependencies manually for each example you want to use.

### Why?

- **Faster root `pnpm install`** - No CLI builds or example deps
- **Cleaner development** - No warning noise from examples
- **Opt-in approach** - Only install examples you need

## 🚀 Getting Started

### First Time Setup

```bash
# 1. Choose an example
cd examples/1-agent-chat

# 2. Install dependencies (this will build the CLI)
pnpm install

# 3. Run the example
pnpm dev
```

### Available Examples

#### 1. **1-agent-chat**
Basic agent chat example showing core Lightfast concepts.

```bash
cd 1-agent-chat
pnpm install
pnpm dev
```

#### 2. **nextjs-ai-chatbot**
Full Next.js application with Lightfast integration.

```bash
cd nextjs-ai-chatbot
pnpm install
pnpm dev
```

## 🔧 How It Works

Each example uses `file:` references to local packages:

```json
{
  "dependencies": {
    "@lightfastai/cli": "file:../../core/cli",
    "lightfast": "file:../../core/lightfast"
  }
}
```

When you run `pnpm install` in an example:
1. Installs dependencies from npm
2. Links to local core packages
3. Ready to use!

## 🛠️ Development Workflow

### Testing Changes to Core

If you modify core packages, rebuild them:

```bash
# Build CLI
cd core/cli
pnpm build

# Build lightfast runtime
cd core/lightfast
pnpm build

# Update example dependencies
cd examples/1-agent-chat
pnpm install --force  # Force update file: references
```

### Cleaning Example Dependencies

```bash
# Clean single example
cd examples/1-agent-chat
rm -rf node_modules
pnpm install

# Clean all examples
rm -rf examples/*/node_modules
```

## 📝 Creating New Examples

1. Create new directory in `examples/`
2. Add `package.json` with `file:` references to core packages
3. Configure Lightfast with `lightfast.config.ts`
4. Add README with setup instructions

Example package.json:

```json
{
  "name": "my-example",
  "private": true,
  "dependencies": {
    "@lightfastai/cli": "file:../../core/cli",
    "lightfast": "file:../../core/lightfast"
  },
  "scripts": {
    "dev": "cli dev"
  }
}
```

## 🤔 FAQ

**Q: Why not use workspace for examples?**
A: Examples require CLI builds which slow down root `pnpm install`. Opt-in keeps core development fast.

**Q: Do I need to install all examples?**
A: No! Only install the examples you want to use.

**Q: How do I update example dependencies?**
A: Run `pnpm install --force` in the example directory after rebuilding core packages.

**Q: Can I still use turbo commands with examples?**
A: No, examples are outside the workspace. Use direct commands in each example directory.

## 🔗 Related Documentation

- [Core CLI Documentation](../core/cli/README.md)
- [Lightfast Runtime](../core/lightfast/README.md)
- [Main Repository README](../README.md)
