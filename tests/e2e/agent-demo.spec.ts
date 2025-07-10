import { test, expect } from "@playwright/test";

test.describe("Agent Demo", () => {
	test("should load agent demo page", async ({ page }) => {
		await page.goto("/");

		// Check if the agent demo component is visible
		await expect(page.getByTestId("agent-demo")).toBeVisible();
	});

	test("should be able to interact with chat interface", async ({ page }) => {
		await page.goto("/");

		// Find the chat input
		const chatInput = page.getByPlaceholder("Type your message...");
		await expect(chatInput).toBeVisible();

		// Type a test message
		await chatInput.fill("Hello, can you help me with a simple task?");

		// Find and click the send button
		const sendButton = page.getByRole("button", { name: "Send" });
		await sendButton.click();

		// Wait for response (this might take a while with real API calls)
		await expect(page.getByText("Hello, can you help me with a simple task?")).toBeVisible();
	});

	test("should handle task execution workflow", async ({ page }) => {
		await page.goto("/");

		const chatInput = page.getByPlaceholder("Type your message...");
		
		// Test a task execution request
		await chatInput.fill("Create a simple Python script that prints hello world");
		await page.getByRole("button", { name: "Send" }).click();

		// Wait for the message to appear
		await expect(page.getByText("Create a simple Python script that prints hello world")).toBeVisible();

		// Check if there's a response (might be streaming)
		await page.waitForSelector("[data-testid='chat-message']", { timeout: 30000 });
	});

	test("should display task planning agent responses", async ({ page }) => {
		await page.goto("/");

		const chatInput = page.getByPlaceholder("Type your message...");
		
		// Test task planning
		await chatInput.fill("Plan a workflow to analyze data from a CSV file");
		await page.getByRole("button", { name: "Send" }).click();

		// Wait for response
		await expect(page.getByText("Plan a workflow to analyze data from a CSV file")).toBeVisible();

		// Check for streaming response or completed response
		await page.waitForSelector("[data-testid='agent-response']", { timeout: 30000 });
	});
});