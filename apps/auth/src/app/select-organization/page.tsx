import { TaskChooseOrganization } from "@clerk/nextjs";

/**
 * Organization Selection Task Page
 * 
 * This page uses Clerk's TaskChooseOrganization component 
 * to handle the organization selection flow for authenticated users.
 * Users will be redirected here when they need to select an organization.
 */
export default function SelectOrganizationPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <TaskChooseOrganization 
          redirectUrlComplete="http://localhost:4103/dashboard"
        />
      </div>
    </div>
  );
}