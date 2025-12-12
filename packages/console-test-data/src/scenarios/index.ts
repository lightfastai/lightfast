/**
 * Pre-built test scenarios
 */

export { day2RetrievalScenario } from "./day2-retrieval";
export {
  createStressTestScenario,
  stressTestSmall,
  stressTestMedium,
  stressTestLarge,
  stressTestXL,
} from "./stress-test";

// Convenience alias
import { day2RetrievalScenario } from "./day2-retrieval";
import { stressTestSmall, stressTestMedium, stressTestLarge, stressTestXL } from "./stress-test";

/**
 * All pre-built scenarios
 */
export const scenarios = {
  day2Retrieval: day2RetrievalScenario,
  stressSmall: stressTestSmall,
  stressMedium: stressTestMedium,
  stressLarge: stressTestLarge,
  stressXL: stressTestXL,
};
