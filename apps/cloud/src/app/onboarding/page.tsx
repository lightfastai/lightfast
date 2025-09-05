import { CustomOrganizationOnboarding } from "~/components/organization/custom-organization-onboarding";

/**
 * Organization Onboarding Page
 * 
 * This page handles the organization-first onboarding flow where users
 * must create or join an organization before accessing the main application.
 */
export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <CustomOrganizationOnboarding />
      </div>
    </div>
  );
}