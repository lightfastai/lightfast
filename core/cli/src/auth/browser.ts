import { spawn } from "node:child_process";

export function openBrowser(
  url: string,
  spawnImpl: typeof spawn = spawn
): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "darwin"
      ? [url]
      : process.platform === "win32"
        ? ["/c", "start", "", url]
        : [url];

  const child = spawnImpl(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
