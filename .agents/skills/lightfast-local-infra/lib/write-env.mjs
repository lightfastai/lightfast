#!/usr/bin/env node
// Safely upsert env vars into one or more .env files. Preserves unrelated
// lines; replaces only listed keys. Reads values from process.env so secrets
// never enter argv (and never reach shell history).
//
// Usage:
//   FOO=bar BAZ=qux node lib/write-env.mjs \
//     --file apps/app/.vercel/.env.development.local \
//     --file apps/platform/.vercel/.env.development.local \
//     --set FOO --set BAZ
//
// Each --set NAME pulls process.env[NAME] and writes NAME=<value>.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const files = [];
const keys = [];
for (let i = 2; i < process.argv.length; i += 2) {
	const flag = process.argv[i];
	const value = process.argv[i + 1];
	if (flag === "--file") files.push(value);
	else if (flag === "--set") keys.push(value);
	else throw new Error(`Unknown flag: ${flag}`);
}

if (files.length === 0) throw new Error("at least one --file required");
if (keys.length === 0) throw new Error("at least one --set required");

const updates = {};
for (const key of keys) {
	const value = process.env[key];
	if (value === undefined || value === "") throw new Error(`${key} missing from process.env`);
	updates[key] = value;
}

function setEnv(filePath) {
	let lines = [];
	try {
		lines = readFileSync(filePath, "utf8").split(/\r?\n/);
	} catch {
		lines = [];
	}
	const seen = new Set();
	const out = lines
		.filter((line) => line.length > 0)
		.map((line) => {
			const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
			if (!match || !(match[1] in updates)) return line;
			seen.add(match[1]);
			return `${match[1]}=${JSON.stringify(updates[match[1]])}`;
		});
	for (const [key, value] of Object.entries(updates)) {
		if (!seen.has(key)) out.push(`${key}=${JSON.stringify(value)}`);
	}
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${out.join("\n")}\n`, { mode: 0o600 });
}

for (const file of files) setEnv(file);
