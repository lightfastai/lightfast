# Lightfast Licensing

Lightfast is licensed under the Functional Source License, Version 1.1, with Apache 2.0 as the future open-source license (FSL-1.1-ALv2).

## Quick Summary

- **Source Available (FSL-1.1-ALv2)**: Platform, console, and console-specific packages
- **Open Source (MIT)**: SDKs, CLI, chat app, vendor integrations, and shared utilities
- **Future Open Source**: FSL components automatically convert to Apache 2.0 after 2 years

## What is FSL?

The [Functional Source License](https://fsl.software) (FSL) is a source-available license that:

1. Lets you **read, use, and modify** the code for any non-competing purpose
2. Allows **internal business use** freely
3. **Automatically converts** to Apache License 2.0 after 2 years
4. Prevents competitors from offering the same product as a hosted service

This model is used by [Sentry](https://sentry.io), [GitButler](https://gitbutler.com), and other established open-source companies.

## License Details

### FSL-1.1-ALv2

The following components are licensed under **Functional Source License 1.1, Apache 2.0 Future License** ([view full text](LICENSE)):

#### Core Platform
- `deus` - Advanced AI orchestration and automation framework

#### Applications
- `apps/console` - Console application
- `apps/www` - Marketing website
- `apps/docs` - Documentation site
- `apps/auth` - Authentication service

#### Console Packages
- `packages/console-*` - All console-specific packages (ai, billing, chunking, config, embed, openapi, pinecone, rerank, reserved-names, types)

#### Internal Services
- `api/console` - Console API
- `api/chat` - Chat API
- `db/console` - Console database
- `db/chat` - Chat database
- `internal/typescript` - Internal TypeScript config

### MIT License

The following components are licensed under the **MIT License**:

#### Client SDKs & Tools
- `core/lightfast` - TypeScript SDK
- `core/mcp` - MCP server
- `core/ai-sdk` - AI SDK integration
- `core/cli` - CLI tool

#### Applications
- `apps/chat` - Chat interface

#### Shared Packages
- `packages/ai` - AI utilities
- `packages/ai-tools` - AI tool definitions
- `packages/app-urls` - URL utilities
- `packages/chat-ai` - Chat AI utilities
- `packages/chat-ai-types` - Chat AI type definitions
- `packages/chat-billing` - Chat billing
- `packages/cms-workflows` - CMS workflows
- `packages/email` - Email utilities
- `packages/lib` - Shared library
- `packages/prompt-engine` - Prompt engine
- `packages/url-utils` - URL utilities

#### Vendor Integrations
- All packages in `vendor/` (analytics, clerk, db, email, embed, forms, inngest, knock, mastra, observability, pinecone, security, storage, upstash, upstash-workflow)

## Permitted Uses

### Allowed

- Using Lightfast for your internal business purposes
- Building AI agent applications using Lightfast runtime for internal use
- Creating custom tools and workflows for your own use
- Non-commercial education and research
- Forking and modifying Lightfast for non-competing purposes
- Redistributing with proper license attribution
- Professional services and consulting using Lightfast

### Not Allowed

- Offering a hosted product or service that competes with Lightfast
- Offering substantially similar functionality as a commercial service
- Removing or obscuring license and copyright notices

### Automatic Open Source Conversion

Each version of Lightfast automatically converts to **Apache License 2.0** two years after its release. Once converted, all Apache 2.0 permissions apply without restriction.

## For Contributors

By contributing to Lightfast, you agree to license your contributions under the same license as the component you are contributing to (FSL-1.1-ALv2 or MIT).

We may ask you to sign a Contributor License Agreement (CLA) for significant contributions.

## File Structure

```
/LICENSE                           # FSL-1.1-ALv2 (repository default, recognized by GitHub)
/LICENSING.md                      # This file

apps/console/LICENSE               # FSL-1.1-ALv2
apps/www/LICENSE                   # FSL-1.1-ALv2
apps/docs/LICENSE                  # FSL-1.1-ALv2
apps/auth/LICENSE                  # FSL-1.1-ALv2
apps/chat/LICENSE                  # MIT

core/lightfast/LICENSE              # MIT
core/mcp/LICENSE                   # MIT
core/ai-sdk/LICENSE                # MIT
core/cli/LICENSE                   # MIT
```

## Third-Party Dependencies

All third-party dependencies retain their original licenses. See individual `package.json` files and `node_modules` directories for details.

## Questions?

If you have questions about licensing:

- **General inquiries**: hello@lightfast.ai
- **Commercial licensing**: hello@lightfast.ai
- **Legal questions**: legal@lightfast.ai

## Additional Resources

- [Functional Source License FAQ](https://fsl.software)
- [Apache License 2.0 FAQ](https://www.apache.org/foundation/license-faq.html)
- [Open Source Initiative](https://opensource.org/)

---

**Last Updated**: 2026-02-23

**Copyright**: 2025 Lightfast Pty Ltd. All rights reserved.
