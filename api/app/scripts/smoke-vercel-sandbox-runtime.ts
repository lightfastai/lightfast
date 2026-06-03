import { createVercelSandboxRuntime } from "@repo/sandbox-runtime";

async function main() {
  if (!process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      "VERCEL_OIDC_TOKEN is missing. Run `vercel link && vercel env pull` for apps/app, then run `pnpm smoke:sandbox-runtime` from api/app.",
    );
  }

  const runtime = createVercelSandboxRuntime();
  const sandbox = await runtime.create({
    name: `lightfast-smoke-${Date.now()}`,
    runtime: "node24",
    timeoutMs: 5 * 60 * 1000,
  });

  try {
    const node = await sandbox.exec({
      cmd: "node",
      args: ["--version"],
      timeoutMs: 30_000,
    });
    const env = await sandbox.exec({
      cmd: "node",
      args: [
        "-e",
        "console.log(process.env.LIGHTFAST_SANDBOX_SMOKE ?? 'missing')",
      ],
      env: { LIGHTFAST_SANDBOX_SMOKE: "ok" },
      timeoutMs: 30_000,
    });
    await sandbox.writeFiles([
      {
        path: "/vercel/sandbox/lightfast-smoke.txt",
        content: "file-ok",
        mode: 0o600,
      },
    ]);
    const file = await sandbox.readFileToBuffer(
      "/vercel/sandbox/lightfast-smoke.txt",
    );

    console.log(
      JSON.stringify(
        {
          env: (await env.stdout()).trim(),
          file: file?.toString("utf8"),
          node: (await node.stdout()).trim(),
          sandboxId: sandbox.id,
        },
        null,
        2,
      ),
    );
  } finally {
    await sandbox.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
