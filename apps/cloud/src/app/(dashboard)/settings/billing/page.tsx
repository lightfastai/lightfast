import type { Metadata } from "next";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { CreditCard, Zap, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Billing & Usage",
  description: "Manage your billing information and view usage statistics.",
};

export default function BillingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Billing & Usage</h2>
        <p className="text-muted-foreground text-sm">
          Manage your subscription, billing information, and view usage statistics.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="size-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Your current subscription plan and usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
            <div>
              <h3 className="font-medium">Free Tier</h3>
              <p className="text-sm text-muted-foreground">
                Perfect for getting started with Lightfast Cloud
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">$0/month</p>
              <p className="text-xs text-muted-foreground">Current plan</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">1,000</p>
              <p className="text-xs text-muted-foreground">API calls/month</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">10</p>
              <p className="text-xs text-muted-foreground">Active agents</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">1GB</p>
              <p className="text-xs text-muted-foreground">Storage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage This Month</CardTitle>
          <CardDescription>
            Your current usage for the billing period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">API Calls</span>
              <span className="text-sm font-medium">0 / 1,000</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: "0%" }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Agents</span>
              <span className="text-sm font-medium">0 / 10</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: "0%" }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Storage Used</span>
              <span className="text-sm font-medium">0MB / 1GB</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: "0%" }}></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Notice */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertCircle className="size-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Billing Management Coming Soon
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-200 mb-3">
              Full billing management, plan upgrades, and payment method configuration will be available soon.
            </p>
            <Button variant="outline" size="sm" disabled>
              <CreditCard className="size-4" />
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Method</CardTitle>
          <CardDescription>
            Manage your payment methods and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
              <CreditCard className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm mb-2">No payment method added</p>
            <p className="text-xs">
              Payment methods will be managed here once billing is available
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}