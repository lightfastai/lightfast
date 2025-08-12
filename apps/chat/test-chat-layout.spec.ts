import { test, expect } from '@playwright/test';

test.describe('Chat Messages Layout', () => {
  test('first messages should remain visible when adding multiple messages', async ({ page }) => {
    // Navigate to the chat app
    await page.goto('http://localhost:4104/');
    
    // Wait for the page to load
    await page.waitForSelector('[placeholder="Ask anything..."]', { timeout: 10000 });
    
    // Send first message
    const input = page.locator('[placeholder="Ask anything..."]');
    await input.fill('Hello, this is my first message');
    await input.press('Enter');
    
    // Wait for the message to appear
    await page.waitForSelector('text=Hello, this is my first message', { timeout: 5000 });
    
    // Get the position of the first message
    const firstMessage = page.locator('text=Hello, this is my first message').first();
    const firstMessageBox = await firstMessage.boundingBox();
    
    // Verify first message is visible at the top
    expect(firstMessageBox).toBeTruthy();
    if (firstMessageBox) {
      console.log('First message position:', { top: firstMessageBox.y, height: firstMessageBox.height });
      expect(firstMessageBox.y).toBeGreaterThanOrEqual(0);
      expect(firstMessageBox.y).toBeLessThan(200); // Should be near the top
    }
    
    // Wait for AI response (or timeout gracefully)
    await page.waitForTimeout(2000);
    
    // Send more messages to fill the chat
    const messages = [
      'This is my second message to test the layout',
      'Adding a third message to see how scrolling works',
      'Fourth message to ensure everything stays visible',
      'Fifth message - checking if first message is still accessible',
    ];
    
    for (const msg of messages) {
      // Wait for input to be enabled
      await page.waitForSelector('[placeholder="Continue the conversation..."]:not([disabled])', { timeout: 10000 });
      
      const continueInput = page.locator('[placeholder="Continue the conversation..."]');
      await continueInput.fill(msg);
      await continueInput.press('Enter');
      
      // Wait for the message to appear
      await page.waitForSelector(`text="${msg}"`, { timeout: 5000 });
      
      // Small delay between messages
      await page.waitForTimeout(1000);
    }
    
    // After all messages, check if first message is still accessible by scrolling up
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('[role="log"]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    });
    
    // Wait a moment for scroll to complete
    await page.waitForTimeout(500);
    
    // Check if first message is visible after scrolling to top
    const firstMessageAfterScroll = await firstMessage.isVisible();
    expect(firstMessageAfterScroll).toBe(true);
    
    // Get the final position of the first message
    const firstMessageBoxAfter = await firstMessage.boundingBox();
    if (firstMessageBoxAfter) {
      console.log('First message position after scrolling to top:', { top: firstMessageBoxAfter.y });
      expect(firstMessageBoxAfter.y).toBeGreaterThanOrEqual(0);
      expect(firstMessageBoxAfter.y).toBeLessThan(200); // Should still be near the top when scrolled up
    }
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'chat-layout-test.png', fullPage: false });
    console.log('Screenshot saved as chat-layout-test.png');
  });
  
  test('messages should flow from top to bottom naturally', async ({ page }) => {
    // Navigate to the chat app
    await page.goto('http://localhost:4104/');
    
    // Wait for the page to load
    await page.waitForSelector('[placeholder="Ask anything..."]', { timeout: 10000 });
    
    // Send multiple messages quickly
    const testMessages = ['Message 1', 'Message 2', 'Message 3'];
    
    for (let i = 0; i < testMessages.length; i++) {
      const placeholder = i === 0 ? 'Ask anything...' : 'Continue the conversation...';
      await page.waitForSelector(`[placeholder="${placeholder}"]:not([disabled])`, { timeout: 10000 });
      
      const input = page.locator(`[placeholder="${placeholder}"]`);
      await input.fill(testMessages[i]);
      await input.press('Enter');
      
      await page.waitForSelector(`text="${testMessages[i]}"`, { timeout: 5000 });
      await page.waitForTimeout(500);
    }
    
    // Check that messages are in correct order from top to bottom
    const messageElements = await page.locator('div:has-text("Message ")').all();
    let previousY = -1;
    
    for (let i = 0; i < Math.min(messageElements.length, testMessages.length); i++) {
      const box = await messageElements[i].boundingBox();
      if (box) {
        console.log(`Message ${i + 1} position:`, { top: box.y });
        expect(box.y).toBeGreaterThan(previousY); // Each message should be below the previous
        previousY = box.y;
      }
    }
  });
});