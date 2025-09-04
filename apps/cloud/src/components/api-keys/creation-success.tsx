"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Separator } from "@repo/ui/components/ui/separator";
import { 
  CheckCircle2, 
  Shield, 
  Book, 
  Terminal, 
  ExternalLink, 
  ArrowRight,
  Lock,
  Eye,
  FileText,
  AlertCircle
} from "lucide-react";

interface CreationSuccessProps {
  keyName: string;
  keyId: string;
  wasKeyCopied?: boolean;
  onComplete: () => void;
  onViewDocumentation?: () => void;
  onSetupCLI?: () => void;
}

export function CreationSuccess({ 
  keyName, 
  keyId, 
  wasKeyCopied = false,
  onComplete,
  onViewDocumentation,
  onSetupCLI 
}: CreationSuccessProps) {
  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-green-900 dark:text-green-100">
            API Key Created Successfully!
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            Your API key "{keyName}" is ready to use.
          </p>
        </div>
      </div>

      {/* Status Check */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {wasKeyCopied ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {wasKeyCopied ? "Key Secured ✓" : "Action Required"}
              </p>
              <p className="text-xs text-muted-foreground">
                {wasKeyCopied 
                  ? "Your API key has been copied to your clipboard and is ready to use."
                  : "Make sure you've copied your API key. You won't be able to see it again."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Reminders */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Security Checklist</h3>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                  wasKeyCopied 
                    ? "bg-green-100 border-green-600 dark:bg-green-900/20 dark:border-green-400" 
                    : "border-muted-foreground"
                }`}>
                  {wasKeyCopied && (
                    <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Store your API key securely</p>
                  <p className="text-muted-foreground text-xs">
                    Save it in your environment variables or password manager
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Never commit keys to version control</p>
                  <p className="text-muted-foreground text-xs">
                    Use .env files and add them to your .gitignore
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Monitor your key usage</p>
                  <p className="text-muted-foreground text-xs">
                    Regularly check your API usage dashboard for any unexpected activity
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Next Steps */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Next Steps
        </h3>

        <div className="grid gap-3">
          {/* CLI Setup */}
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Terminal className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">Set up the Lightfast CLI</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure your local development environment with your new API key
                  </p>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={onSetupCLI}
                    >
                      CLI Setup Guide
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentation */}
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Book className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">Read the API Documentation</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Learn how to integrate Lightfast Cloud APIs into your applications
                  </p>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={onViewDocumentation}
                    >
                      View Docs
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Example Code */}
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">Try Example Code</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get started quickly with code examples in your preferred language
                  </p>
                  <div className="mt-2 font-mono text-xs bg-muted/50 p-2 rounded">
                    <div className="text-muted-foreground">// Set your API key</div>
                    <div>LIGHTFAST_API_KEY="{keyId.slice(0, 12)}..."</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Final Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <Button 
          onClick={onComplete}
          className="w-full"
          size="lg"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Continue to API Keys
        </Button>
        
        {!wasKeyCopied && (
          <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
              <strong>Remember:</strong> Make sure you've saved your API key securely before continuing. 
              You won't be able to retrieve it again.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}