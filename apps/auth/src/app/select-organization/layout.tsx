import { ReactNode } from "react";

interface OnboardingLayoutProps {
  children: ReactNode;
}

/**
 * Onboarding Layout
 * 
 * Minimal layout for the organization onboarding flow.
 * Removes navigation and other app chrome to focus on the onboarding process.
 */
export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}