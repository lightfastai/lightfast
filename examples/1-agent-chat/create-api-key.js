import { chromium } from 'playwright';

async function createApiKey() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Step 1: Navigating to signup page...');
    await page.goto('http://localhost:4104/sign-up');
    await page.waitForLoadState('networkidle');
    
    console.log('Step 2: Filling signup form...');
    // Fill email
    await page.fill('input[name="emailAddress"], input[type="email"]', 'test+clerk_test@lightfast.ai');
    
    // Fill password
    await page.fill('input[name="password"], input[type="password"]', 'TestPassword123!');
    
    // Submit form
    await page.click('button[type="submit"], button:text("Sign up"), button:text("Continue")');
    
    console.log('Step 3: Handling verification...');
    await page.waitForTimeout(2000);
    
    // Look for verification code input
    const verificationInput = await page.locator('input[name="code"], input[placeholder*="code"], input[placeholder*="verification"]').first();
    if (await verificationInput.isVisible()) {
      await verificationInput.fill('424242');
      await page.click('button[type="submit"], button:text("Verify"), button:text("Continue")');
    }
    
    console.log('Step 4: Creating organization...');
    await page.waitForTimeout(3000);
    
    // Look for organization creation form
    const orgNameInput = await page.locator('input[name="name"], input[placeholder*="organization"], input[placeholder*="name"]').first();
    if (await orgNameInput.isVisible()) {
      await orgNameInput.fill('deploy-test-org');
      await page.click('button[type="submit"], button:text("Create"), button:text("Continue")');
    }
    
    console.log('Step 5: Waiting for org creation to complete...');
    await page.waitForTimeout(5000);
    
    // First try to navigate to the cloud app directly
    console.log('Step 5a: Navigating to cloud app...');
    await page.goto('http://localhost:4103/');
    await page.waitForLoadState('networkidle');
    
    // If we're on sign-in page, sign in with same credentials
    if (page.url().includes('/sign-in') || await page.locator('input[name="identifier"]').isVisible()) {
      console.log('Step 5b: Signing into cloud app...');
      await page.fill('input[name="identifier"], input[type="email"]', 'test+clerk_test@lightfast.ai');
      await page.click('button[type="submit"], button:text("Continue")');
      await page.waitForTimeout(1000);
      
      if (await page.locator('input[name="password"]').isVisible()) {
        await page.fill('input[name="password"]', 'TestPassword123!');
        await page.click('button[type="submit"], button:text("Continue"), button:text("Sign in")');
        await page.waitForTimeout(3000);
      }
    }
    
    console.log('Step 6: Navigating to API keys page...');
    await page.goto('http://localhost:4103/orgs/deploy-test-org/settings/api-keys');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'debug-before-create.png' });
    
    console.log('Step 7: Creating API key...');
    // Try multiple selectors for create button
    const createButtonSelectors = [
      'button:has-text("Create API key")',
      'button:has-text("Create")',
      'button:has-text("New")',
      'button:has-text("Add")',
      'button[data-testid*="create"]',
      'button[id*="create"]',
      '[role="button"]:has-text("Create")'
    ];
    
    let createKeyButton = null;
    for (const selector of createButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          createKeyButton = button;
          console.log(`Found create button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (createKeyButton) {
      await createKeyButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No create button found, trying alternative approach...');
      // Maybe the API keys page has a different structure
      await page.screenshot({ path: 'debug-no-create-button.png' });
    }
    
    console.log('Step 8: Filling API key form...');
    // Fill API key name
    const nameInputSelectors = [
      'input[name="name"]',
      'input[placeholder*="name"]',
      'input[placeholder*="key"]',
      'input[type="text"]'
    ];
    
    let nameInput = null;
    for (const selector of nameInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.isVisible()) {
          nameInput = input;
          console.log(`Found name input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (nameInput) {
      await nameInput.fill('deploy-test-key');
      await page.waitForTimeout(1000);
    }
    
    console.log('Step 9: Submitting API key creation...');
    // Submit API key creation
    const submitButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Create")',
      'button:has-text("Save")',
      'button:has-text("Submit")'
    ];
    
    let submitButton = null;
    for (const selector of submitButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible()) {
          submitButton = button;
          console.log(`Found submit button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(3000);
    }
    
    console.log('Step 10: Extracting API key...');
    await page.screenshot({ path: 'debug-after-create.png' });
    
    // Look for the API key value (usually starts with lf_)
    const apiKeyElements = await page.locator('code, span, div, input, textarea, pre').all();
    let apiKey = null;
    
    for (const element of apiKeyElements) {
      try {
        const text = await element.textContent();
        if (text && text.trim().startsWith('lf_')) {
          apiKey = text.trim();
          console.log('Found API key via textContent:', apiKey);
          break;
        }
        
        const value = await element.getAttribute('value');
        if (value && value.trim().startsWith('lf_')) {
          apiKey = value.trim();
          console.log('Found API key via value attribute:', apiKey);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (apiKey) {
      console.log('SUCCESS: API key created:', apiKey);
      return apiKey;
    } else {
      console.log('ERROR: Could not find API key in the page');
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-no-api-key.png' });
      return null;
    }
    
  } catch (error) {
    console.error('Error during automation:', error);
    await page.screenshot({ path: 'debug-error.png' });
    return null;
  } finally {
    await browser.close();
  }
}

createApiKey().then(apiKey => {
  if (apiKey) {
    console.log('\n🎉 API Key successfully created:', apiKey);
  } else {
    console.log('\n❌ Failed to create API key');
    process.exit(1);
  }
}).catch(console.error);