#!/usr/bin/env node
// Extract Upstash Redis fields from a JSON file (from `upstash redis list
// --json`, `upstash redis create --json`, or `upstash redis get --id <id>
// --json`). Emits shell-eval lines.
//
// Usage:
//   node lib/upstash-extract.mjs --mode id   --file /tmp/lightfast-upstash-list.json --name <redis_name>
//   node lib/upstash-extract.mjs --mode id   --file /tmp/lightfast-upstash-create.json
//   node lib/upstash-extract.mjs --mode rest --file /tmp/lightfast-upstash-db.json
//
// mode=id   emits: redis_id=<id>
// mode=rest emits: kv_rest_api_url=<https-url>
//                  kv_rest_api_token=<token>

import { readFileSync } from "node:fs";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
	args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
}

if (!args.mode || !args.file) throw new Error("--mode and --file are required");

const data = JSON.parse(readFileSync(args.file, "utf8"));

if (args.mode === "id") {
	const list = Array.isArray(data) ? data : (data.databases ?? data.data ?? [data]);
	const match = args.name
		? list.find((item) => item.database_name === args.name || item.name === args.name)
		: list[0];
	process.stdout.write(`redis_id=${match?.database_id ?? match?.id ?? ""}\n`);
} else if (args.mode === "rest") {
	let url = data.rest_url ?? data.endpoint ?? "";
	if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
	const token = data.rest_token ?? data.token ?? data.password ?? "";
	process.stdout.write(`kv_rest_api_url=${url}\nkv_rest_api_token=${token}\n`);
} else {
	throw new Error(`unknown --mode ${args.mode}`);
}
