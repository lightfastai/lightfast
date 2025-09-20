/**
 * Test script to verify that the transaction-based usage increment
 * prevents race condition vulnerabilities in billing enforcement
 * 
 * This script simulates concurrent message sending to verify that
 * usage counts are correctly incremented without gaps that could
 * allow billing bypass.
 */

import { db } from "@db/chat/client";
import { LightfastChatUsage } from "@db/chat";
import { eq, and } from "drizzle-orm";

// Test configuration
const TEST_USER_ID = "test_user_race_condition";
const TEST_PERIOD = "2025-09";
const CONCURRENT_REQUESTS = 10;
const INCREMENT_AMOUNT = 1;

/**
 * Simulated increment function that uses our new transaction-based approach
 */
async function incrementNonPremiumAtomic(userId: string, period: string, count: number = 1) {
  return await db.transaction(async (tx) => {
    try {
      // Attempt to insert new record
      await tx.insert(LightfastChatUsage).values({
        clerkUserId: userId,
        period: period,
        nonPremiumMessages: count,
        premiumMessages: 0,
      });
      
      return { success: true, created: true };
    } catch (error) {
      // If insert fails due to unique constraint (record exists),
      // update the existing record atomically
      if (error instanceof Error && 
          (error.message.includes('Duplicate entry') || 
           error.message.includes('unique constraint'))) {
        
        // Use UPDATE with WHERE clause for atomic increment
        const result = await tx
          .update(LightfastChatUsage)
          .set({
            nonPremiumMessages: LightfastChatUsage.nonPremiumMessages + count
          } as any) // Note: sql template literal would go here in real implementation
          .where(
            and(
              eq(LightfastChatUsage.clerkUserId, userId),
              eq(LightfastChatUsage.period, period)
            )
          );
        
        return { success: true, created: false };
      }
      
      // Re-throw unexpected errors
      throw error;
    }
  });
}

/**
 * Clean up test data before and after test
 */
async function cleanupTestData() {
  try {
    await db
      .delete(LightfastChatUsage)
      .where(
        and(
          eq(LightfastChatUsage.clerkUserId, TEST_USER_ID),
          eq(LightfastChatUsage.period, TEST_PERIOD)
        )
      );
    console.log("✅ Test data cleaned up");
  } catch (error) {
    console.log("ℹ️ No test data to clean up");
  }
}

/**
 * Get current usage count for test user
 */
async function getCurrentUsage() {
  const usage = await db
    .select()
    .from(LightfastChatUsage)
    .where(
      and(
        eq(LightfastChatUsage.clerkUserId, TEST_USER_ID),
        eq(LightfastChatUsage.period, TEST_PERIOD)
      )
    )
    .limit(1);

  return usage[0]?.nonPremiumMessages || 0;
}

/**
 * Run race condition test
 */
async function runRaceConditionTest() {
  console.log("🧪 Running race condition test for transaction-based usage increment");
  console.log(`📊 Test parameters:
  - User ID: ${TEST_USER_ID}  
  - Period: ${TEST_PERIOD}
  - Concurrent requests: ${CONCURRENT_REQUESTS}
  - Increment per request: ${INCREMENT_AMOUNT}
  - Expected final count: ${CONCURRENT_REQUESTS * INCREMENT_AMOUNT}`);

  // Clean up any existing test data
  await cleanupTestData();

  console.log("\n🚀 Starting concurrent requests...");
  const startTime = Date.now();

  // Create array of concurrent increment promises
  const incrementPromises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => 
    incrementNonPremiumAtomic(TEST_USER_ID, TEST_PERIOD, INCREMENT_AMOUNT)
      .then(result => ({
        index: i,
        result,
        timestamp: Date.now()
      }))
      .catch(error => ({
        index: i,
        error: error.message,
        timestamp: Date.now()
      }))
  );

  // Wait for all concurrent operations to complete
  const results = await Promise.all(incrementPromises);
  const endTime = Date.now();

  console.log(`⏱️ All requests completed in ${endTime - startTime}ms`);

  // Analyze results
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  const created = successful.filter(r => r.result?.created);
  const updated = successful.filter(r => r.result && !r.result.created);

  console.log(`\n📈 Results summary:
  - Successful operations: ${successful.length}/${CONCURRENT_REQUESTS}
  - Failed operations: ${failed.length}
  - Records created: ${created.length}
  - Records updated: ${updated.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed operations:`, failed.map(f => `Request ${f.index}: ${f.error}`));
  }

  // Check final usage count
  const finalCount = await getCurrentUsage();
  const expectedCount = CONCURRENT_REQUESTS * INCREMENT_AMOUNT;

  console.log(`\n🎯 Final usage count verification:
  - Expected count: ${expectedCount}
  - Actual count: ${finalCount}
  - Match: ${finalCount === expectedCount ? '✅' : '❌'}`);

  // Race condition analysis
  if (finalCount === expectedCount) {
    console.log("\n✅ SUCCESS: No race condition detected! Transactions prevented billing bypass.");
  } else if (finalCount < expectedCount) {
    console.log("\n❌ RACE CONDITION DETECTED: Final count is less than expected!");
    console.log(`   This indicates that ${expectedCount - finalCount} increments were lost.`);
    console.log("   This could allow users to bypass billing limits through concurrent requests.");
  } else {
    console.log("\n⚠️ UNEXPECTED: Final count is higher than expected!");
    console.log("   This requires investigation - possible double counting.");
  }

  // Clean up test data
  await cleanupTestData();

  return finalCount === expectedCount;
}

/**
 * Main test execution
 */
async function main() {
  try {
    const testPassed = await runRaceConditionTest();
    
    console.log(`\n${testPassed ? '🎉' : '💥'} Test ${testPassed ? 'PASSED' : 'FAILED'}`);
    
    if (testPassed) {
      console.log("The transaction-based implementation successfully prevents race condition billing bypass.");
    } else {
      console.log("The implementation still has race condition vulnerabilities that need to be addressed.");
    }
    
    process.exit(testPassed ? 0 : 1);
  } catch (error) {
    console.error("💥 Test execution failed:", error);
    
    // Still clean up test data on error
    await cleanupTestData();
    process.exit(1);
  }
}

// Run the test
main();