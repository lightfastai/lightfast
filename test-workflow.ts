import { mastra } from "./mastra";

async function testWorkflow() {
  console.log("Testing task planner workflow...\n");

  try {
    // Get the workflow
    const workflow = mastra.getWorkflow("taskPlannerWorkflow");
    
    // Create a run
    const run = await workflow.createRunAsync();
    
    // Test 1: With search enabled (default)
    console.log("Test 1: Planning and searching for 'Build a React todo app'");
    const result1 = await run.start({
      inputData: {
        task: "Build a React todo app with local storage",
        context: "Using TypeScript and modern React hooks",
      },
    });
    
    console.log("\n=== RESULT 1 ===");
    console.log("Plan Overview:", result1.result?.plan?.overview);
    console.log("Steps:", result1.result?.plan?.steps);
    if (result1.result?.research) {
      console.log("\nResearch Summary:", result1.result.research.summary.substring(0, 200) + "...");
      console.log("Key Findings:", result1.result.research.keyFindings);
    }
    
    // Test 2: Without search
    console.log("\n\nTest 2: Planning only (no search) for 'Deploy to Vercel'");
    const run2 = await workflow.createRunAsync();
    const result2 = await run2.start({
      inputData: {
        task: "Deploy a Next.js app to Vercel",
        enableSearch: false,
      },
    });
    
    console.log("\n=== RESULT 2 ===");
    console.log("Plan Overview:", result2.result?.plan?.overview);
    console.log("Steps:", result2.result?.plan?.steps);
    console.log("Research:", result2.result?.research || "No research (as expected)");
    
  } catch (error) {
    console.error("Error running workflow:", error);
  }
}

// Run the test
testWorkflow();