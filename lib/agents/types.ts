/**
 * Types for AgentKit bug reporter system
 */

export interface BugReport {
  id: string;
  title: string;
  description: string;
  repository: string;
  filePath?: string;
  lineNumber?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'logic' | 'type-safety' | 'memory' | 'other';
  language?: string;
  codeSnippet?: string;
  stackTrace?: string;
  environment?: {
    os?: string;
    nodeVersion?: string;
    dependencies?: Record<string, string>;
  };
}

export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  cweId?: string;
  owasp?: string;
}

export interface BugAnalysis {
  bugReport: BugReport;
  rootCause?: string;
  affectedFiles?: string[];
  relatedIssues?: string[];
  securityIssues?: SecurityIssue[];
  suggestedFixes?: CodeFix[];
  estimatedImpact?: {
    users: 'all' | 'some' | 'few';
    performance: 'high' | 'medium' | 'low' | 'none';
    security: 'critical' | 'high' | 'medium' | 'low' | 'none';
  };
}

export interface CodeFix {
  description: string;
  filePath: string;
  changes: Array<{
    type: 'replace' | 'add' | 'remove';
    startLine: number;
    endLine?: number;
    oldCode?: string;
    newCode?: string;
  }>;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  testSuggestions?: string[];
}

export interface BugReporterNetworkState {
  bugReport?: BugReport;
  analysis?: BugAnalysis;
  securityAnalysis?: SecurityIssue[];
  suggestedFixes?: CodeFix[];
  sandboxId?: string;
  chatId: string;
  status: 'analyzing' | 'security-check' | 'generating-fixes' | 'complete' | 'error';
  error?: string;
}

export interface AgentToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
