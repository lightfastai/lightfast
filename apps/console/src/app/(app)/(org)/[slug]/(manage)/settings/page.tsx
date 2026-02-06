import { TeamGeneralSettingsClient } from "./_components/team-general-settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Settings layout already verified admin role; no additional checks needed here
  const { slug } = await params;

  console.log("[Settings Page] Rendering for slug:", slug);

  // Note: We rely on listUserOrganizations cache from (app)/layout.tsx
  // No separate prefetch needed - avoids Clerk propagation timing issues
  // The client component will find the org from the cached list by slug

  return <TeamGeneralSettingsClient slug={slug} />;
}

// Unused for now but may be needed if we add Suspense boundaries
// function GeneralSettingsSkeleton() {
//   return (
//     <div className="space-y-8">
//       <div className="space-y-4">
//         <div>
//           <Skeleton className="h-7 w-48" />
//           <Skeleton className="h-4 w-72 mt-2" />
//         </div>
//         <div className="w-full space-y-4">
//           <Skeleton className="h-10 w-full" />
//           <Skeleton className="h-4 w-56" />
//           <div className="flex justify-end">
//             <Skeleton className="h-9 w-16" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
