import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("connector OAuth request boundary", () => {
  it("imports concrete connector OAuth services instead of broad service barrels", () => {
    const adapterSource = source("adapters/internal/connector-oauth.ts");

    expect(adapterSource).toContain("../../services/connectors/linear-flow");
    expect(adapterSource).toContain("../../services/connectors/x-flow");
    expect(adapterSource).toContain(
      "../../services/user-connectors/granola-flow"
    );
    expect(adapterSource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/connectors["']/
    );
    expect(adapterSource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/user-connectors["']/
    );
  });

  it("does not expose OAuth callback completion helpers from broad service barrels", () => {
    const connectorIndexSource = source("services/connectors/index.ts");
    const userConnectorIndexSource = source(
      "services/user-connectors/index.ts"
    );

    expect(connectorIndexSource).not.toContain("completeLinearConnectorOAuth");
    expect(connectorIndexSource).not.toContain("completeXConnectorOAuth");
    expect(connectorIndexSource).toContain("startConnectorOAuth");
    expect(connectorIndexSource).toContain("refreshConnectorTools");

    expect(userConnectorIndexSource).not.toContain(
      "completeGranolaUserConnectorOAuth"
    );
    expect(userConnectorIndexSource).not.toContain(
      "startGranolaUserConnectorOAuth"
    );
    expect(userConnectorIndexSource).not.toContain(
      "disconnectGranolaUserConnector"
    );
    expect(userConnectorIndexSource).toContain("listUserConnectorsForViewer");
  });
});
