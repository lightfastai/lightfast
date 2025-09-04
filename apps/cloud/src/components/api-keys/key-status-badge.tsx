import { Badge } from "@repo/ui/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";

export type KeyStatus = "active" | "expired" | "revoked" | "expires-soon";

interface KeyStatusBadgeProps {
  isActive: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  className?: string;
}

function getStatus(isActive: boolean, isExpired: boolean, expiresAt: string | null): KeyStatus {
  if (!isActive) return "revoked";
  if (isExpired) return "expired";
  
  // Check if expires within 7 days
  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
      return "expires-soon";
    }
  }
  
  return "active";
}

const statusConfig = {
  active: {
    label: "Active",
    variant: "default" as const,
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  },
  expired: {
    label: "Expired",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  revoked: {
    label: "Revoked",
    variant: "secondary" as const,
    icon: XCircle,
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700",
  },
  "expires-soon": {
    label: "Expires Soon",
    variant: "default" as const,
    icon: AlertTriangle,
    className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
  },
} as const;

export function KeyStatusBadge({ isActive, isExpired, expiresAt, className }: KeyStatusBadgeProps) {
  const status = getStatus(isActive, isExpired, expiresAt);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className} flex items-center gap-1 text-xs font-medium`}
      aria-label={`Status: ${config.label}`}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

export function getStatusText(isActive: boolean, isExpired: boolean, expiresAt: string | null): string {
  const status = getStatus(isActive, isExpired, expiresAt);
  return statusConfig[status].label;
}