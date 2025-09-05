import { CustomOrganizationOnboarding } from "~/components/organization/custom-organization-onboarding";

/**
 * Organization Selection Task Page
 * 
 * This page uses our custom organization onboarding component
 * to handle the organization selection and creation flow for authenticated users.
 * Users will be redirected here when they need to select an organization.
 */
export default function SelectOrganizationPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <CustomOrganizationOnboarding />
      </div>
    </div>
  );
}