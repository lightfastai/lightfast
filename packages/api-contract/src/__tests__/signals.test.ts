import { describe, expect, it } from "vitest";

import {
  createMcpSignalCommandInput,
  createSignalInput,
  createSignalOutput,
  getMcpSignalCommandInput,
  getSignalOutput,
  listSignalsOutput,
  normalizeSignalClassification,
  SIGNAL_ID_PREFIX,
  signalClassificationBaseSchema,
  signalClassificationModelOutputSchema,
  signalClassificationSchema,
  signalIdSchema,
} from "../schemas/signals";

const baseClassification = {
  schemaVersion: "signal.classification.v2",
  disposition: "actionable",
  title: "Review X profile",
  summary: "The signal mentions an X profile worth engaging.",
  kind: "engage",
  nextAction: "Review the profile and decide whether to reply.",
  priority: "normal",
  rationale: "The input contains a durable social identity.",
  confidence: 0.86,
} as const;

const teamPeopleRouting = {
  visibility: {
    scope: "team",
    rationale: "The profile is relevant to the team's shared workflow.",
  },
  review: {
    required: false,
    reason: null,
    rationale: null,
  },
  routes: {
    people: {
      shouldRun: true,
      confidence: 0.92,
      rationale: "The input includes a durable social identity.",
    },
  },
} as const;

const userRouting = {
  visibility: {
    scope: "user",
    rationale: "The signal is only visible to the creator.",
  },
  review: {
    required: false,
    reason: null,
    rationale: null,
  },
  routes: {
    people: {
      shouldRun: false,
      confidence: 0.2,
      rationale: "The signal should not enter team people routing.",
    },
  },
} as const;

describe("signal schemas", () => {
  it("trims and accepts non-empty signal input", () => {
    expect(
      createSignalInput.parse({ input: "  Run the PR test plan  " })
    ).toEqual({ input: "Run the PR test plan" });
  });

  it("rejects empty signal input", () => {
    expect(() => createSignalInput.parse({ input: "   " })).toThrow();
  });

  it("rejects signal input over 4000 characters", () => {
    expect(() =>
      createSignalInput.parse({ input: "a".repeat(4001) })
    ).toThrow();
  });

  it("accepts generated signal ids", () => {
    expect(
      signalIdSchema.parse("signal_123e4567-e89b-12d3-a456-426614174000")
    ).toBe("signal_123e4567-e89b-12d3-a456-426614174000");
    expect(SIGNAL_ID_PREFIX).toBe("signal_");
  });

  it("rejects legacy sig-prefixed ids", () => {
    expect(() =>
      signalIdSchema.parse("sig_123e4567-e89b-12d3-a456-426614174000")
    ).toThrow("Invalid signal id");
  });

  it("validates create signal output with creator visibility", () => {
    expect(
      createSignalOutput.parse({
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        status: "queued",
        visibilityScope: "user",
      })
    ).toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
  });

  it("requires MCP signal commands to carry granted signal scopes", () => {
    expect(
      createMcpSignalCommandInput.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: "Signal from MCP",
        scopes: ["mcp:signals:write"],
      })
    ).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Signal from MCP",
      scopes: ["mcp:signals:write"],
    });

    expect(() =>
      createMcpSignalCommandInput.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: "Signal from MCP",
      })
    ).toThrow();

    expect(
      getMcpSignalCommandInput.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        scopes: ["mcp:signals:read"],
      })
    ).toMatchObject({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      scopes: ["mcp:signals:read"],
    });

    expect(() =>
      getMcpSignalCommandInput.parse({
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        scopes: ["mcp:provider_routines:read"],
      })
    ).toThrow();
  });

  it("validates get signal output with nullable v2 classification and visibility", () => {
    expect(
      getSignalOutput.parse({
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        input: "Review this profile",
        status: "queued",
        classification: null,
        entityLinks: [],
        visibilityScope: "user",
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T00:00:00.000Z",
      })
    ).toMatchObject({
      classification: null,
      entityLinks: [],
      visibilityScope: "user",
    });
  });

  it("validates public signal list output with an opaque cursor", () => {
    expect(
      listSignalsOutput.parse({
        items: [
          {
            id: "signal_123e4567-e89b-12d3-a456-426614174000",
            input: "Review this profile",
            status: "queued",
            classification: null,
            visibilityScope: "team",
            createdAt: "2026-05-30T00:00:00.000Z",
            updatedAt: "2026-05-30T00:00:00.000Z",
          },
        ],
        nextCursor: "opaque_cursor",
      })
    ).toMatchObject({
      items: [{ id: "signal_123e4567-e89b-12d3-a456-426614174000" }],
      nextCursor: "opaque_cursor",
    });
  });

  it("accepts an actionable team signal with people routing", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: teamPeopleRouting,
      })
    ).toMatchObject({
      schemaVersion: "signal.classification.v2",
      routing: {
        visibility: { scope: "team" },
        routes: { people: { shouldRun: true } },
      },
    });
  });

  it("accepts an actionable user signal without people routing", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: userRouting,
      })
    ).toMatchObject({
      routing: {
        visibility: { scope: "user" },
        routes: { people: { shouldRun: false } },
      },
    });
  });

  it("accepts needs_review as a hard route stop", () => {
    expect(
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "needs_review",
            rationale: "The signal needs a human scope decision.",
          },
          review: {
            required: true,
            reason: "ambiguous_scope",
            rationale: "The signal could be personal or shared.",
          },
          routes: {
            people: {
              shouldRun: false,
              confidence: 0,
              rationale: "Human review must happen before routing.",
            },
          },
        },
      })
    ).toMatchObject({
      routing: {
        visibility: { scope: "needs_review" },
        review: { required: true },
        routes: { people: { shouldRun: false } },
      },
    });
  });

  it("rejects legacy v1 classifications", () => {
    expect(() =>
      signalClassificationSchema.parse({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: teamPeopleRouting,
      })
    ).toThrow();
  });

  it("normalizes persisted v1 classifications to the v2 workspace contract", () => {
    expect(
      normalizeSignalClassification({
        schemaVersion: "signal.classification.v1",
        disposition: "actionable",
        title: "Talk to Jeevan",
        summary: "The signal mentions an X profile worth engaging.",
        kind: "engage",
        nextAction: "Review the profile and decide whether to reply.",
        priority: "normal",
        rationale: "The input contains a durable social identity.",
        confidence: 0.86,
        routing: {
          classifyPeople: {
            shouldRun: true,
            rationale: "The input includes a durable social identity.",
          },
        },
      })
    ).toMatchObject({
      schemaVersion: "signal.classification.v2",
      routing: {
        visibility: { scope: "team" },
        review: { required: false, reason: null, rationale: null },
        routes: {
          people: {
            shouldRun: true,
            confidence: 0.86,
            rationale: "The input includes a durable social identity.",
          },
        },
      },
    });
  });

  it("rejects people routing for needs_review", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "needs_review",
            rationale: "The signal needs a human scope decision.",
          },
          review: {
            required: true,
            reason: "ambiguous_scope",
            rationale: "The signal could be personal or shared.",
          },
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "The route must not run before review.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects people routing for user visibility", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          ...userRouting,
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "People routing requires team visibility.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects extra route keys under routing routes", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          ...teamPeopleRouting,
          routes: {
            ...teamPeopleRouting.routes,
            projects: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "Only people routing is part of the v2 contract.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects team visibility for needs_context and not_actionable dispositions", () => {
    for (const disposition of ["needs_context", "not_actionable"] as const) {
      expect(() =>
        signalClassificationSchema.parse({
          ...baseClassification,
          disposition,
          routing: {
            ...teamPeopleRouting,
            routes: {
              people: {
                shouldRun: false,
                confidence: 0.1,
                rationale: "Non-actionable signals cannot route.",
              },
            },
          },
        })
      ).toThrow();
    }
  });

  it("rejects invalid v2 states through the exported base schema", () => {
    expect(() =>
      signalClassificationBaseSchema.parse({
        ...baseClassification,
        disposition: "not_actionable",
        routing: {
          ...teamPeopleRouting,
          routes: {
            people: {
              shouldRun: false,
              confidence: 0.1,
              rationale: "Non-actionable signals cannot use team visibility.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects user and team visibility when review is required", () => {
    for (const scope of ["user", "team"] as const) {
      expect(() =>
        signalClassificationSchema.parse({
          ...baseClassification,
          routing: {
            visibility: {
              scope,
              rationale: "This visible scope cannot require review.",
            },
            review: {
              required: true,
              reason: "privacy",
              rationale: "Review was requested.",
            },
            routes: {
              people: {
                shouldRun: false,
                confidence: 0.1,
                rationale: "Routing is stopped while review is required.",
              },
            },
          },
        })
      ).toThrow();
    }
  });

  it("validates model output with v2 invariants and no schema version", () => {
    const { schemaVersion: _schemaVersion, ...modelOutput } = {
      ...baseClassification,
      routing: teamPeopleRouting,
    };

    expect(signalClassificationModelOutputSchema.parse(modelOutput)).toEqual(
      modelOutput
    );

    expect(() =>
      signalClassificationModelOutputSchema.parse({
        ...modelOutput,
        routing: {
          ...teamPeopleRouting,
          review: {
            required: true,
            reason: "privacy",
            rationale: "Review was requested.",
          },
        },
      })
    ).toThrow();
  });

  it("rejects empty people routing rationale", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          ...teamPeopleRouting,
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "   ",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects invalid people routing confidence", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          ...teamPeopleRouting,
          routes: {
            people: {
              shouldRun: true,
              confidence: 1.1,
              rationale: "Confidence must stay in range.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects a needs_review route without review metadata", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          visibility: {
            scope: "needs_review",
            rationale: "The signal needs a human scope decision.",
          },
          review: {
            required: true,
            reason: null,
            rationale: null,
          },
          routes: {
            people: {
              shouldRun: false,
              confidence: 0,
              rationale: "Human review must happen before routing.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects visible routes with review metadata", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        routing: {
          ...userRouting,
          review: {
            required: false,
            reason: "other",
            rationale: null,
          },
        },
      })
    ).toThrow();
  });

  it("rejects non-actionable people routing", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
        disposition: "needs_context",
        routing: {
          ...userRouting,
          routes: {
            people: {
              shouldRun: true,
              confidence: 0.8,
              rationale: "Non-actionable signals cannot route.",
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects missing v2 routing", () => {
    expect(() =>
      signalClassificationSchema.parse({
        ...baseClassification,
      })
    ).toThrow();
  });

  it("rejects a model output that includes schema version", () => {
    expect(() =>
      signalClassificationModelOutputSchema.parse({
        ...baseClassification,
        routing: userRouting,
      })
    ).toThrow();
  });

  it("validates classified get signal output with visibility and v2 classification", () => {
    expect(
      getSignalOutput.parse({
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        input: "Review this profile",
        status: "classified",
        classification: {
          ...baseClassification,
          routing: teamPeopleRouting,
        },
        entityLinks: [
          {
            targetType: "person",
            localEntityKey: "person_1",
            label: "Jordi",
            mentionKind: "name",
            anchorText: "Jordi",
            anchorOccurrence: 1,
            extractionMethod: "ai",
            rationale: "Jordi is explicitly named.",
            confidence: 0.73,
            resolvedPerson: {
              id: "person_123e4567-e89b-12d3-a456-426614174000",
              displayName: "Jordi",
              identityProvider: "email",
              identityType: "email",
              identityValue: "jordi@doccy.com.au",
            },
          },
        ],
        visibilityScope: "team",
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T00:00:00.000Z",
      })
    ).toMatchObject({
      classification: {
        disposition: "actionable",
        routing: { visibility: { scope: "team" } },
      },
      entityLinks: [
        expect.objectContaining({
          label: "Jordi",
          resolvedPerson: expect.objectContaining({
            id: "person_123e4567-e89b-12d3-a456-426614174000",
          }),
        }),
      ],
      visibilityScope: "team",
    });
  });
});
