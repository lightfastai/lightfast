import { describe, expect, it } from "vitest";

import { apiContract } from "../contract";
import {
  createSignalInput,
  createSignalOutput,
  listSignalsInput,
  listSignalsOutput,
} from "../schemas/signals";
import { systemHealthOutput } from "../schemas/system";

describe("apiContract", () => {
  it("keeps public API route metadata as plain contract data", () => {
    expect(apiContract.system.health.route).toMatchObject({
      method: "GET",
      path: "/system/health",
    });
    expect(apiContract.system.health.outputSchema).toBe(systemHealthOutput);

    expect(apiContract.signals.list.route).toMatchObject({
      method: "GET",
      path: "/signals",
    });
    expect(apiContract.signals.list.inputSchema).toBe(listSignalsInput);
    expect(apiContract.signals.list.outputSchema).toBe(listSignalsOutput);

    expect(apiContract.signals.create.route).toMatchObject({
      method: "POST",
      path: "/signals",
      successStatus: 202,
    });
    expect(apiContract.signals.create.inputSchema).toBe(createSignalInput);
    expect(apiContract.signals.create.outputSchema).toBe(createSignalOutput);

    expect(apiContract.signals.get.route).toMatchObject({
      method: "GET",
      path: "/signals/{id}",
    });
  });
});
