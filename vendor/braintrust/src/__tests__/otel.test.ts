import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { braintrustExporterMock, registerOTelMock } = vi.hoisted(() => ({
  braintrustExporterMock: vi.fn(),
  registerOTelMock: vi.fn(),
}));

vi.mock("@braintrust/otel", () => ({
  BraintrustExporter: braintrustExporterMock,
}));

vi.mock("@vercel/otel", () => ({
  registerOTel: registerOTelMock,
}));

const originalBraintrustApiKey = process.env.BRAINTRUST_API_KEY;

beforeEach(() => {
  vi.resetModules();
  braintrustExporterMock.mockReset();
  braintrustExporterMock.mockImplementation(function BraintrustExporterMock() {
    return {
      kind: "braintrust-exporter",
    };
  });
  registerOTelMock.mockReset();
  process.env.BRAINTRUST_API_KEY = "bt_test_key";
});

afterAll(() => {
  if (originalBraintrustApiKey === undefined) {
    delete process.env.BRAINTRUST_API_KEY;
  } else {
    process.env.BRAINTRUST_API_KEY = originalBraintrustApiKey;
  }
});

describe("registerBraintrustOTel", () => {
  it("registers AI-only Braintrust OTel with the caller-provided parent", async () => {
    const { registerBraintrustOTel } = await import("../otel");

    expect(
      registerBraintrustOTel({
        parent: "project_name:test-ai-feature",
        serviceName: "lightfast-app",
      })
    ).toEqual({
      enabled: true,
    });

    expect(braintrustExporterMock).toHaveBeenCalledWith({
      apiKey: "bt_test_key",
      filterAISpans: true,
      parent: "project_name:test-ai-feature",
    });
    expect(registerOTelMock).toHaveBeenCalledWith({
      serviceName: "lightfast-app",
      traceExporter: { kind: "braintrust-exporter" },
    });
  });
});
