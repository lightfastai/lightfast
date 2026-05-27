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
import { realpathSync, statSync } from "node:fs";
import { join } from "node:path";

// Single git call returns "<root>\n<branch>"; branch is "HEAD" when detached.
const [rawRoot, rawBranch] = execFileSync(
	"git",
	["rev-parse", "--show-toplevel", "--abbrev-ref", "HEAD"],
	{ encoding: "utf8" },
)
	.trim()
	.split("\n");

const realRoot = realpathSync(rawRoot);
const rootHash = createHash("sha1").update(realRoot).digest("hex").slice(0, 8);
const branch = rawBranch === "HEAD" ? "" : rawBranch;
// Primary worktree has .git as a directory; secondaries have it as a file
// containing `gitdir: <path>`. Avoids spawning `git worktree list`.
const isPrimary = (() => {
	try {
		return statSync(join(realRoot, ".git")).isDirectory();
	} catch {
		return false;
	}
})();
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
