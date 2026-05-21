interface FinalizeNavigateParams {
  decorateUrl: (u: string) => string;
  session?: { currentTask?: unknown } | null;
}

interface FinalizeNavigateOptions {
  onBlockedTask?: (taskKey: string) => void;
}

function currentTaskKey(task: unknown): string | null {
  return typeof task === "object" &&
    task !== null &&
    "key" in task &&
    typeof task.key === "string"
    ? task.key
    : null;
}

export function makeFinalizeNavigate(
  target: string,
  options?: FinalizeNavigateOptions
) {
  return (params: FinalizeNavigateParams) => {
    const taskKey = currentTaskKey(params.session?.currentTask);
    if (taskKey && taskKey !== "choose-organization") {
      options?.onBlockedTask?.(taskKey);
      return;
    }
    window.location.href = params.decorateUrl(target);
  };
}
