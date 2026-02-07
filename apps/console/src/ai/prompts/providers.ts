import type { SectionProvider } from "@repo/prompt-engine";
import { answerIdentitySection } from "./sections/identity";
import { answerCoreBehaviorSection } from "./sections/core-behavior";
import { answerSecuritySection } from "./sections/security";
import { answerToolGuidanceSection } from "./sections/tool-guidance";
import { answerWorkspaceContextSection } from "./sections/workspace-context";
import { answerTemporalContextSection } from "./sections/temporal-context";
import { answerStyleSection } from "./sections/style";
import { answerCitationSection } from "./sections/citation";

/**
 * Answer agent provider set.
 *
 * Order determines render order when priorities are equal.
 * Feature flags in PromptContext control which optional sections are active.
 */
export const ANSWER_PROVIDERS: SectionProvider[] = [
  answerIdentitySection,
  answerCoreBehaviorSection,
  answerSecuritySection,
  answerToolGuidanceSection,
  answerWorkspaceContextSection,
  answerTemporalContextSection,
  answerStyleSection,
  answerCitationSection,
];
