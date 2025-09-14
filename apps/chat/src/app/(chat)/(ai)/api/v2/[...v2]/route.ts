import { createPolicyHandler } from "~/lib/policies/handlers";
import { userProfilePolicies } from "~/lib/policies/definitions";

// Create the policy-driven handler
const handler = createPolicyHandler(userProfilePolicies);

// Export for both GET and POST methods
export { handler as GET, handler as POST };