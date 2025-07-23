import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { planner } from "../agents/standalone/planner";
import { searcher } from "../agents/standalone/searcher";

// Define shared schemas
const planSchema = z.object({
	overview: z.string(),
	steps: z.array(
		z.object({
			id: z.string(),
			action: z.string(),
			description: z.string(),
		}),
	),
	requirements: z.array(z.string()),
});

const researchSchema = z.object({
	summary: z.string(),
	keyFindings: z.array(z.string()),
});

// Create a combined step that handles both planning and optional searching
const planAndSearchStep = createStep({
	id: "plan-and-search",
	description: "Create a plan and optionally search for information",
	inputSchema: z.object({
		task: z.string(),
		context: z.string().optional(),
		enableSearch: z.boolean().default(true),
	}),
	outputSchema: z.object({
		plan: planSchema,
		research: researchSchema.optional(),
	}),
	execute: async ({ inputData }) => {
		const { task, context, enableSearch } = inputData;

		// Step 1: Create a plan using the planner agent
		const planPrompt = `Task: ${task}${context ? `\nContext: ${context}` : ""}
    
Please create a detailed plan for this task with:
1. An overview describing the main goal
2. 3-5 actionable steps with clear descriptions
3. Any requirements or prerequisites

Format the response as JSON with the following structure:
{
  "overview": "Brief overview of the task",
  "steps": [
    {
      "id": "1",
      "action": "Action name",
      "description": "What this step does"
    }
  ],
  "requirements": ["requirement1", "requirement2"]
}`;

		const planMessages = [{ role: "user" as const, content: planPrompt }];
		const { text: planText } = await planner.generate(planMessages);

		let plan: z.infer<typeof planSchema>;

		try {
			// Try to parse JSON from the response
			const jsonMatch = planText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsedPlan = JSON.parse(jsonMatch[0]);
				plan = {
					overview: parsedPlan.overview || "Execute the task",
					steps: parsedPlan.steps || [
						{ id: "1", action: "Analyze", description: "Analyze requirements" },
						{ id: "2", action: "Execute", description: "Execute the task" },
						{ id: "3", action: "Verify", description: "Verify results" },
					],
					requirements: parsedPlan.requirements || [],
				};
			} else {
				throw new Error("No JSON found in response");
			}
		} catch (error) {
			console.error("Failed to parse plan:", error);
			// Fallback plan
			plan = {
				overview: "Execute the requested task",
				steps: [
					{ id: "1", action: "Analyze", description: "Analyze the task requirements" },
					{ id: "2", action: "Execute", description: "Execute the main task" },
					{ id: "3", action: "Verify", description: "Verify the results" },
				],
				requirements: [],
			};
		}

		// Step 2: Optionally search for information
		if (!enableSearch) {
			return {
				plan,
				research: undefined,
			};
		}

		const searchPrompt = `Search for information about: ${task}
Context: ${plan.overview}

Please search for relevant and current information that would help with this task. Focus on:
- Best practices
- Recent developments
- Key resources
- Important considerations

Provide a summary of your findings with bullet points for key insights.`;

		const searchMessages = [{ role: "user" as const, content: searchPrompt }];
		const { text: searchText } = await searcher.generate(searchMessages);

		// Extract key findings from the search results
		const keyFindings = searchText
			.split("\n")
			.filter((line: string) => line.trim().startsWith("•") || line.trim().startsWith("-"))
			.map((line: string) => line.replace(/^[•-]\s*/, "").trim())
			.filter((line: string) => line.length > 0)
			.slice(0, 5);

		const research: z.infer<typeof researchSchema> = {
			summary: searchText,
			keyFindings:
				keyFindings.length > 0
					? keyFindings
					: ["Relevant information found", "Consider best practices", "Review recent updates"],
		};

		return {
			plan,
			research,
		};
	},
});

// Create the main workflow
export const taskPlannerWorkflow = createWorkflow({
	id: "task-planner-workflow",
	description: "Plan and research tasks using AI agents",
	inputSchema: z.object({
		task: z.string().describe("The task to plan and research"),
		context: z.string().optional().describe("Additional context for the task"),
		enableSearch: z.boolean().default(true).describe("Whether to search for additional information"),
	}),
	outputSchema: z.object({
		plan: planSchema,
		research: researchSchema.optional(),
	}),
})
	// Execute the combined step
	.then(planAndSearchStep)
	.commit();
