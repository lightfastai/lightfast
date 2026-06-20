import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("skills refresh controller source", () => {
  it("keeps the Skills page wired to refresh stale indexes", () => {
    const clientSource = source("src/skills/skills-client.tsx");
    const controllerSource = source(
      "src/skills/use-skill-index-refresh-controller.ts"
    );

    expect(clientSource).toContain("useSkillIndexRefreshController(data)");
    expect(controllerSource).toMatch(
      /from\s+["']@api\/app\/tanstack\/skills["']/
    );
    expect(controllerSource).toContain("requestSkillRefresh");
    expect(controllerSource).toContain("Skill index refresh was not enqueued");
    expect(controllerSource).toContain('queryKey: ["skills"] as const');
    expect(controllerSource).not.toContain("skillsListQueryKey");
    expect(controllerSource).not.toContain("skills-queries");
    expect(controllerSource).toContain(
      'new EventSource("/api/skills/index/events")'
    );
    expect(controllerSource).toContain('source.addEventListener("skill-index"');
    expect(controllerSource).toContain("REFRESHABLE_STATUSES");
    expect(controllerSource).toContain("POLLABLE_STATUSES");
    expect(controllerSource).toContain("REFRESH_POLL_INTERVAL_MS = 5000");
    expect(controllerSource).toContain("clearTimeout(timer)");
    expect(controllerSource).toContain("clearInterval(interval)");
  });
});
