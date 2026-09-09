# Official agent skill provenance

Lightfast selects and places the upstream material below; the named vendors retain authorship. The canonical skill directories are byte-identical snapshots. Lightfast-owned material is limited to placement, pins, provenance, verification, symlinks, and the TanStack context pointer.

The deterministic content hash is SHA-256 over sorted records of each file's Git mode, POSIX-relative path, and SHA-256 byte hash, using the algorithm recorded in `skills-lock.json`.

| Skill | Official source | Exact upstream revision | Local placement | Deterministic local content hash | License coverage |
| --- | --- | --- | --- | --- | --- |
| Turborepo | <https://github.com/vercel/turborepo> | commit `3125eb1a49f0c1b98f460eb3616036ce03837387`; `skills/turborepo`; tree `34eaa69f05167f1e1a809c131547a80b83bf8208` | canonical `.agents/skills/turborepo` | `sha256:b7cd97fdbf0102c46e0d5d63dc6d07f9596cdc07469ae3c74933c5b47a8812ca` | MIT; `provenance/licenses/turborepo-MIT.txt` |
| oRPC core | <https://github.com/unnoq/orpc> | commit `0cd296a95c33f8871306ab38e16e63a450cca4d1`; `skills/orpc`; tree `47d8f19d0a1147e1b879e4ef719f9c1bca3af65b` | canonical `api/app/.agents/skills/orpc` | `sha256:c06fd88367387a8b565b508789eb23416a4b200044eefc34578cfe56522fa2ac` | MIT; `provenance/licenses/orpc-MIT.txt` |
| oRPC contract | <https://github.com/unnoq/orpc> | commit `0cd296a95c33f8871306ab38e16e63a450cca4d1`; `skills/orpc-contract`; tree `7e854bb13ecefca583d1cfbe0b0f617adbc3f544` | canonical `packages/api-contract/.agents/skills/orpc-contract` | `sha256:db42079394b2e189fb724a3720cf7930325969ec95518353d89a1575ded370fb` | MIT; shared copy `provenance/licenses/orpc-MIT.txt` |
| PlanetScale MySQL | <https://github.com/planetscale/database-skills> | commit `73b20b7eb64716d8c7100c054f0677c0c6e77e30`; `skills/mysql`; tree `a2d3f6d189cb2847d659da7108b399df9ac08875` | canonical `vendor/db/.agents/skills/mysql`; alias `db/app/.agents/skills/mysql` | `sha256:8524849f9887d261bc7e16d73524b73542c754d1bd24e23ada52389d057d48cf` | MIT; `provenance/licenses/planetscale-database-skills-MIT.txt` |
| React Email | <https://github.com/resend/react-email> | commit `0f0cb94e1f15581131a2d50b80f8daa13dd1c9fc`; `skills/react-email`; tree `e6e198406ce5d1b14eb43e7a94f16b8bd2739461` | canonical `packages/email/.agents/skills/react-email`; alias `apps/email/.agents/skills/react-email` | `sha256:ca811fa039f2ddf1d1993e0e4b7a951f0fde4c9289f73c0fb29ac23d9e0c4ffc` | MIT; `provenance/licenses/react-email-MIT.txt` |
| Anthropic MCP builder | <https://github.com/anthropics/skills> | commit `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`; `skills/mcp-builder`; tree `b866bcfb57b780c10b587c7b543e871a91661ce0` | canonical `vendor/mcp/.agents/skills/mcp-builder`; aliases in `apps/mcp` and `core/mcp` | `sha256:5e1b6737d8f2def79afcdb8b3f8aa8e274b6a34361a3a3487ce71777a0b9d8cb` | Apache-2.0; upstream-local `vendor/mcp/.agents/skills/mcp-builder/LICENSE.txt` |

## TanStack version-coupled guidance

`apps/example/AGENTS.md` points agents to `pnpm dlx @tanstack/intent@0.3.8 load @tanstack/react-start#react-start`. The command was validated from the package scope and resolves the installed `@tanstack/react-start` version `1.168.49` at `node_modules/@tanstack/react-start/skills/react-start/SKILL.md`; the package uses `@tanstack/react-router` version `1.170.32`. Intent `0.3.8` matches the reviewed source manifest; its published integrity is recorded in `skills-lock.json`. No dependency or lockfile change is required.

- Intent source: <https://github.com/TanStack/intent>, commit `206e987a253aee4a26825e419eeda27d53832e49`, `packages/intent`, tree `5f3a5fd1281806677b4790ad66709ea84a39a685`, MIT copy at `provenance/licenses/tanstack-intent-MIT.txt`.
- React Start source: <https://github.com/TanStack/router>, commit `650acb4a894f7bf36bd3591de65d10bca9594254`, `packages/react-start/skills`, tree `cce8714768b4deaad9557c74da33e65284149cee`, MIT copy at `provenance/licenses/tanstack-router-MIT.txt`.
- The installed published skill subset omits upstream maintenance `_artifacts` as declared by the package and hashes to `sha256:634bc4ff296b0230f6aa14bfc2a75f74bb879494940fb93bb8422a6782c469b0`.

No TanStack skill is copied into `.agents/skills`, and `@tanstack/intent` is not a repository dependency.

## Discovery scope

Codex scans `.agents/skills` from its current working directory to the repository root and follows skill-directory symlinks. The resulting repository profile is:

| Working scope | Repository skills discovered |
| --- | --- |
| Repository root and unrelated packages | `turborepo` |
| `api/app` | `turborepo`, `orpc` |
| `packages/api-contract` | `turborepo`, `orpc-contract` |
| `db/app`, `vendor/db` | `turborepo`, `mysql` |
| `apps/email`, `packages/email` | `turborepo`, `react-email` |
| `apps/mcp`, `core/mcp`, `vendor/mcp` | `turborepo`, `mcp-builder` |
| `apps/example` | `turborepo` plus the TanStack Intent pointer above |

## Review and update policy

Before updating a snapshot, review the official repository's exact commit, license, complete referenced files, tool requirements, commands, network calls, destructive behavior, and version claims. Replace the whole canonical tree without edits, retain one canonical copy for shared scopes, refresh `skills-lock.json` and this record, and run the full verification suite. Do not accept floating or community snapshots.

The MCP snapshot includes its upstream evaluation scripts and their public `anthropic` and `mcp` Python requirements. They are inert unless a maintainer explicitly runs them; the evaluator can launch a supplied stdio command or connect to a supplied HTTP endpoint and can call the Anthropic API. For this repository, the current MCP specification and installed TypeScript SDK are authoritative when the snapshot differs.

The reviewed upstream material also has three runtime trust boundaries that its
content hashes do not remove:

- The TanStack pointer invokes the pinned Intent release through `pnpm dlx`;
  that release still resolves its declared transitive dependency ranges. Review
  executable updates separately from the installed package's guidance updates.
- The MySQL `SKILL.md` links to reference files on the upstream `main` branch.
  Use the byte-identified local `references/*.md` copies for repository work;
  treat the floating remote links as new external input requiring review.
- The MCP evaluation guide asks for read-only questions, but the harness passes
  every advertised server tool to the model and does not enforce annotations or
  an allowlist. Run it only with explicit maintainer intent against an approved
  server/tool set where model-selected calls cannot mutate protected data.

The oRPC files mention separate `orpc-openapi` and `orpc-migrate` skills, and React Email links to a separate accessibility reference. Those are optional external follow-up sources, not local file or tool dependencies, and are not part of this deliberately small profile. All relative references required by the selected snapshots are present.

Remotion is deliberately omitted. The reviewed `remotion-dev/skills` commit `54e9b19a612897171e0b3b242e01c2badba4a272` does not provide sufficient explicit redistribution and license evidence, so no Remotion content is vendored, transformed, recreated, or summarized here.
