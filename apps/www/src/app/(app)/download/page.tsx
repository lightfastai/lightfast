import type { Metadata } from "next";
import { DownloadIcon, MonitorIcon, AppleIcon, WindowsIcon, LinuxIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Download Lightfast Desktop",
  description: "Download Lightfast Desktop app for macOS, Windows, and Linux",
};

interface Platform {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  primary: string;
  secondary?: string;
  downloadUrl: string;
  version: string;
  requirements: string[];
}

const platforms: Platform[] = [
  {
    name: "macOS",
    icon: AppleIcon,
    primary: "Download for macOS",
    secondary: "Universal (Intel + Apple Silicon)",
    downloadUrl: "https://github.com/lightfastai/lightfast/releases/latest/download/Lightfast.dmg",
    version: "0.1.0",
    requirements: ["macOS 10.15 or later", "64-bit processor"],
  },
  {
    name: "Windows",
    icon: WindowsIcon,
    primary: "Download for Windows",
    secondary: "64-bit",
    downloadUrl: "https://github.com/lightfastai/lightfast/releases/latest/download/Lightfast-Setup.exe",
    version: "0.1.0",
    requirements: ["Windows 10 or later", "64-bit processor"],
  },
  {
    name: "Linux",
    icon: LinuxIcon,
    primary: "Download for Linux",
    secondary: "AppImage",
    downloadUrl: "https://github.com/lightfastai/lightfast/releases/latest/download/Lightfast.AppImage",
    version: "0.1.0",
    requirements: ["64-bit Linux distribution", "GLIBC 2.29 or later"],
  },
];

export default function DownloadPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
          <MonitorIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4">Download Lightfast Desktop</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Experience the power of Lightfast with our native desktop application.
          Available for macOS, Windows, and Linux.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-12">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          return (
            <div
              key={platform.name}
              className="relative group rounded-2xl border bg-card p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <Icon className="w-12 h-12 text-muted-foreground" />
                <div>
                  <h2 className="text-xl font-semibold mb-1">{platform.name}</h2>
                  <p className="text-sm text-muted-foreground">Version {platform.version}</p>
                </div>
                
                <a
                  href={platform.downloadUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <DownloadIcon className="w-4 h-4" />
                  {platform.primary}
                </a>
                
                {platform.secondary && (
                  <p className="text-xs text-muted-foreground">{platform.secondary}</p>
                )}
                
                <div className="pt-4 border-t w-full">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Requirements:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {platform.requirements.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-4">Features</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Native Performance</h3>
              <p className="text-sm text-muted-foreground">
                Built with Electron for optimal performance on your desktop
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Type-Safe Architecture</h3>
              <p className="text-sm text-muted-foreground">
                Fully typed with TypeScript for reliability and maintainability
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Auto Updates</h3>
              <p className="text-sm text-muted-foreground">
                Automatic updates ensure you always have the latest features
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-pink-500 mt-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Cross-Platform</h3>
              <p className="text-sm text-muted-foreground">
                Consistent experience across macOS, Windows, and Linux
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>
          Need help? Check out our{" "}
          <a href="/docs/desktop" className="underline hover:text-foreground">
            desktop documentation
          </a>{" "}
          or{" "}
          <a href="https://github.com/lightfastai/lightfast/issues" className="underline hover:text-foreground">
            report an issue
          </a>
          .
        </p>
      </div>
    </div>
  );
}