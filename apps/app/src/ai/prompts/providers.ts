import type { SectionProvider } from "@repo/prompt-engine";
import { answerCitationSection } from "./sections/citation";
import { answerCoreBehaviorSection } from "./sections/core-behavior";
import { answerIdentitySection } from "./sections/identity";
import { answerOrgContextSection } from "./sections/org-context";
import { answerRepoIndexSection } from "./sections/repo-index-context";
import { answerSecuritySection } from "./sections/security";
import { answerStyleSection } from "./sections/style";
import { answerTemporalContextSection } from "./sections/temporal-context";
import { answerToolGuidanceSection } from "./sections/tool-guidance";

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
  answerOrgContextSection,
  answerRepoIndexSection,
  answerTemporalContextSection,
  answerStyleSection,
  answerCitationSection,
];
