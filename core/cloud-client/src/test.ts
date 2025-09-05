#!/usr/bin/env node
/**
 * Simple test script to verify the cloud client works
 * Usage: node dist/test.js [api-key]
 */

import { createLightfastCloudClient } from './index.js';

async function testValidateEndpoint() {
  const testApiKey = process.argv[2];
  
  if (!testApiKey) {
    console.error('❌ Please provide an API key to test with:');
    console.error('   node dist/test.js lf_your_api_key_here');
    process.exit(1);
  }

  console.log('🧪 Testing Lightfast Cloud Client...\n');

  // Test with localhost first (development)
  const client = createLightfastCloudClient({
    baseUrl: 'http://localhost:3000', // Assuming cloud app runs on 3000
  });

  try {
    console.log('🔑 Testing apiKey.validate...');
    const result = await client.apiKey.validate.mutate({
      key: testApiKey,
    });

    console.log('✅ Success!');
    console.log('📄 Response:', JSON.stringify(result, null, 2));

    if (result.valid) {
      console.log(`👤 User ID: ${result.userId}`);
      console.log(`🔑 Key ID: ${result.keyId}`);
    }

  } catch (error: any) {
    console.error('❌ Error calling validate endpoint:');
    console.error(error.message || error);
    
    if (error.data) {
      console.error('📄 Error data:', JSON.stringify(error.data, null, 2));
    }
  }
}

// Run the test
testValidateEndpoint().catch(console.error);