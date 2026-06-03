import { HydrateClient, prefetch, trpc } from "~/trpc/server";

import { TeamGeneralSettingsClient } from "./_components/team-general-settings-client";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Settings layout already verified org access; no additional checks needed here
  const { slug } = await params;

  prefetch(trpc.org.settings.identity.get.queryOptions());

  return (
    <HydrateClient>
      <TeamGeneralSettingsClient slug={slug} />
    </HydrateClient>
  );
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
