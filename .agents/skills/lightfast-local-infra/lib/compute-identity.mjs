#!/usr/bin/env node
// Emit shell-eval lines naming the per-worktree pscale branch + upstash
// database for this checkout. Output:
//   database_name=lightfast
//   base_branch=main
//   pscale_branch=wt-<prefix>-<rootHash>
//   pscale_credential_name=lightfast-<user>-<rootHash>-<stamp>
//   redis_name=lightfast-<prefix>-<rootHash>
// Prefix is "local" on primary worktree / main / master; otherwise sanitized
// last branch segment.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const realRoot = realpathSync(root);
const rootHash = createHash("sha1").update(realRoot).digest("hex").slice(0, 8);
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const worktreeOutput = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" });
const worktrees = worktreeOutput
	.split(/\n(?=worktree )/)
	.map((chunk) => chunk.match(/^worktree (.+)$/m)?.[1])
	.filter(Boolean)
	.map((path) => realpathSync(path));
const primary = worktrees[0] ?? realRoot;
const isPrimary = realRoot === primary;
const lastSegment = branch.split("/").filter(Boolean).at(-1) ?? "";
const sanitize = (s) =>
	s.toLowerCase().replace(/\./g, "-").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const sanitized = sanitize(lastSegment);
const prefix = !branch || branch === "main" || branch === "master" || isPrimary ? "local" : sanitized || "local";
const pscaleBranch = sanitize(`wt-${prefix}-${rootHash}`).slice(0, 63);
const redisName = sanitize(`lightfast-${prefix}-${rootHash}`);
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
const credentialName = `lightfast-${process.env.USER ?? "local"}-${rootHash}-${stamp}`;

process.stdout.write(
	[
		`database_name=lightfast`,
		`base_branch=main`,
		`pscale_branch=${pscaleBranch}`,
		`pscale_credential_name=${credentialName}`,
		`redis_name=${redisName}`,
		"",
	].join("\n"),
);
