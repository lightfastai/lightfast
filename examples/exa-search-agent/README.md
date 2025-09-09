# ExaJS Search Agent - Node.js Runtime Example

This example demonstrates how Lightfast's **Node.js runtime bundling** handles complex npm dependencies like ExaJS (~45MB) for Vercel deployment.

## 🎯 What This Demonstrates

- ✅ **Complex Dependencies**: ExaJS includes many Node.js-specific dependencies
- ✅ **Large Bundle Size**: ~45MB+ when bundled with all dependencies  
- ✅ **Node.js APIs**: Full access to Node.js runtime for complex packages
- ✅ **Vercel Deployment**: Production-ready bundles for Vercel Node.js Functions
- ✅ **Real-World Use Case**: Actual AI-powered web search functionality

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Environment Variables

```bash
cp .env.example .env
# Edit .env and add your EXA_API_KEY (get it from https://dashboard.exa.ai/)
```

### 3. Test Node.js Bundling

```bash
npm run compile-nodejs
```

This will:
- Compile the Lightfast config
- Bundle ExaJS and all dependencies using esbuild
- Generate a Node.js runtime bundle (~45MB)
- Test bundle loading and structure

### 4. Expected Output

```
🧪 Testing Node.js Runtime Bundling with ExaJS
================================================

✅ Successfully imported bundler and transpiler
📝 Transpiling lightfast.config.ts...
✅ Transpilation successful
   Code size: 12.3KB
✅ ExaJS dependency detected in transpiled code

🔧 Generating Node.js runtime bundle...
✅ Node.js bundle generation completed!
📊 Bundle Statistics:
   Bundle ID: researcher
   File: researcher.nodejs.a1b2c3d4.js
   Size: 45.67MB
   Runtime: nodejs20.x
   Dependencies: exa-js, zod
   Hash: a1b2c3d4

✅ Bundle size is acceptable for Node.js runtime
📁 Bundle location: /path/to/.lightfast/dist/nodejs-bundles/researcher.nodejs.a1b2c3d4.js

🔍 Testing bundle loading...
✅ Bundle loaded successfully
✅ Bundle exports a POST handler (Vercel format)

🎉 Node.js runtime bundling test completed!
```

## 📦 What's Inside the Bundle

The generated Node.js bundle contains:
- **Your agent code** with search capabilities
- **ExaJS library** (~45MB with all its dependencies)
- **Zod validation** for type safety
- **Vercel function wrapper** for deployment
- **Runtime context injection** for Node.js APIs

## 🌐 Deployment to Vercel

### Option A: Using CLI (Future)
```bash
lightfast deploy --runtime nodejs
```

### Option B: Manual Deployment
1. Copy the bundle to your Vercel project
2. Create API route that loads and executes the bundle
3. Configure `vercel.json` for Node.js runtime

## 🧪 Testing the Agent

Once deployed, test via HTTP:

```bash
curl -X POST https://your-app.vercel.app/api/agents/execute/researcher \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "message": "Research recent developments in AI agent frameworks"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "result": {
    "message": "Based on my search using Exa's neural search...",
    "sources": [
      {
        "title": "Latest AI Agent Frameworks 2024",
        "url": "https://example.com/article",
        "summary": "Recent developments in..."
      }
    ]
  },
  "executionTime": 1234,
  "runtime": "nodejs"
}
```

## 🔍 Bundle Analysis

| Metric | Value | Status |
|--------|-------|--------|
| Bundle Size | ~45MB | ✅ Under Vercel 250MB limit |
| Cold Start | ~800ms | ✅ Acceptable for complex agents |
| Dependencies | exa-js, zod | ✅ Fully bundled |
| Runtime | Node.js 20.x | ✅ Full API access |

## 🆚 vs Edge Runtime

| Feature | Edge Runtime | Node.js Runtime |
|---------|-------------|-----------------|
| Bundle Size Limit | ~4MB practical | 250MB |
| Cold Start | ~100ms | ~800ms |
| APIs Available | Web APIs only | Full Node.js |
| Complex Dependencies | ❌ | ✅ |
| ExaJS Support | ❌ | ✅ |

## 🐛 Troubleshooting

### "Bundle not found" Error
```bash
# Make sure the CLI is built first
cd ../../core/cli
npm run build
cd ../examples/exa-search-agent
npm run compile-nodejs
```

### "ExaJS import failed" Error
- Check that `exa-js` is in `package.json` dependencies
- Run `npm install` to ensure it's installed
- Verify the import statement in `lightfast.config.ts`

### "Bundle too large" Warning  
- This is expected for ExaJS (~45MB is normal)
- Node.js runtime supports up to 250MB
- Consider using Edge runtime for lighter agents

## 📖 Related Documentation

- [Issue #127: Vercel-based Agent Execution Platform](https://github.com/lightfastai/lightfast/issues/127)
- [ExaJS Documentation](https://docs.exa.ai/)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/serverless-functions)

## 🎯 Key Takeaways

1. **Complex dependencies work** with Node.js runtime bundling
2. **45MB+ bundles are acceptable** for Vercel Node.js functions  
3. **Full Node.js APIs** enable sophisticated npm packages
4. **Production-ready bundling** with esbuild optimization
5. **Real-world agents** can use powerful libraries like ExaJS

This example proves that Lightfast can handle enterprise-grade dependencies in serverless environments! 🚀