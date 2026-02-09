# lightfast

## 0.1.0-alpha.4

### Patch Changes

- Fix MCP external installation by exporting Zod schemas from SDK. The MCP package previously depended on unpublished workspace packages, causing npm installation failures. This release moves Zod schema exports to the published SDK.

## 0.1.0-alpha.3

### Patch Changes

- Fix API key format validation to accept `sk-lf-` prefix instead of incorrect `sk_` prefix. Updated all documentation and examples to use correct format.

## 0.1.0-alpha.2

### Patch Changes

- Package dependency updates and workspace protocol fixes

## 0.1.0-alpha.1

### Patch Changes

- Initial alpha release of the Lightfast Neural Memory SDK
