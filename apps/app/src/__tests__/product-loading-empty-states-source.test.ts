import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("product loading and empty states", () => {
  it("keeps initial pending states separate from empty states", () => {
    const peopleClientSource = source("src/people/people-client.tsx");
    const signalsClientSource = source("src/signals/signals-client.tsx");
    const signalsDataSource = source(
      "src/signals/use-signals-workspace-data.ts"
    );

    expect(peopleClientSource).toContain("PeopleLoading");
    expect(peopleClientSource).toContain(
      "peopleQuery.isPending && rows.length === 0"
    );

    expect(signalsDataSource).toContain("isInitialPending");
    expect(signalsClientSource).toContain("SignalsLoading");
    expect(signalsClientSource).toContain("isInitialPending");
  });
});
