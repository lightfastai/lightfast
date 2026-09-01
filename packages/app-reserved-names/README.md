# @repo/app-reserved-names

Reserved organization names for stable Lightfast route namespaces.

## Overview

This package provides case-insensitive organization/team slug checks with O(1)
lookup. `workspace-names.json` is legacy data and is not wired into runtime
validation.

The reserved list protects stable namespaces such as:

- `/api`
- `/sign-in`
- `/pricing`
- `/docs`
- `/pitch-deck`
- `/llms.txt`

The public website is owned by the separate
[`lightfastai/www`](https://github.com/lightfastai/www) repository. This package
keeps the names it must preserve as a local data contract and does not read
another application or repository.

## Usage

```typescript
import { organization } from "@repo/app-reserved-names";

organization.check("admin"); // true
organization.check("pricing"); // true
organization.check("my-company"); // false
organization.check("Admin"); // true
```

The default export exposes the same organization utilities:

```typescript
import reservedNames from "@repo/app-reserved-names";

reservedNames.organization.check("settings"); // true
```

## API

### `organization.check(slug: string): boolean`

Returns `true` when the organization slug is reserved. Checks are
case-insensitive.

### `organization.all: ReadonlyArray<string>`

Contains every reserved organization slug.

## Reserved names

The data set covers HTTP and protocol names, metadata files, authentication and
API paths, stable public website names, product surfaces, and common SaaS or
developer-platform namespaces that may become top-level routes.

When a stable namespace is added, update `data/organization-names.json` and the
focused coverage test when the name is part of the public contract.

## Current runtime usage

`@repo/app-validation` imports `organization.check()` for
`clerkOrgSlugSchema`, which is used by team and organization creation and rename
flows.
