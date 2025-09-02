interface PackageInfo {
  name: string
  version: string
  description?: string
}

export function getPackageInfo(): PackageInfo {
  // Static values to avoid file system reads at runtime
  return {
    name: "@lightfastai/cli",
    version: "0.2.1",
    description: "CLI for Lightfast agent execution engine",
  };
}
