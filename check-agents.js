// Quick script to check deployed agents in the database
import { db } from "./db/cloud/src/client.js";
import { CloudAgent } from "./db/cloud/src/schema/index.js";

async function checkAgents() {
  try {
    console.log("Querying deployed agents...");
    
    const agents = await db
      .select()
      .from(CloudAgent)
      .orderBy(CloudAgent.createdAt);
    
    console.log(`Found ${agents.length} agents:`);
    
    agents.forEach((agent, index) => {
      console.log(`\n${index + 1}. Agent: ${agent.name}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Organization: ${agent.clerkOrgId}`);
      console.log(`   Bundle URL: ${agent.bundleUrl}`);
      console.log(`   Created: ${agent.createdAt}`);
      console.log(`   Created by: ${agent.createdByUserId}`);
    });
    
    if (agents.length === 0) {
      console.log("No agents found in database.");
    }
    
  } catch (error) {
    console.error("Error querying agents:", error);
  } finally {
    process.exit(0);
  }
}

checkAgents();