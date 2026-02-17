/**
 * Workflow Visual Component
 *
 * Showcases AI agent workflow for CRM automation.
 * Displays chat interface with agent steps and CRM context panel.
 * Designed to be used inside landing page sections.
 */

import {
  Search,
  Mail,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  StickyNote,
  Users,
  Target,
} from "lucide-react";

export function WorkflowVisual() {
  return (
    <div className="relative w-full h-full bg-muted/30 rounded-lg overflow-hidden">
      {/* Main Layout - Split View */}
      <div className="flex h-full">
        {/* Left: Chat Interface */}
        <div className="flex-1 p-4 space-y-4">
          {/* User Query Card */}
          <div className="bg-background/80 backdrop-blur-sm rounded-lg p-3 border border-border">
            <p className="text-sm text-foreground">
              write follow-up emails to prospects who went dark after demos and
              asked about HIPAA compliance
            </p>
          </div>

          {/* AI Agent Response Card */}
          <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border space-y-3">
            {/* Agent Header */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded-sm" />
              <span className="text-sm font-medium text-foreground">
                Lightfield
              </span>
            </div>

            {/* Agent Message */}
            <p className="text-sm text-foreground">
              I&apos;ll help you write follow-up emails to prospects who went
              dark after demos and asked about HIPAA compliance. Let me first
              find these accounts.
            </p>

            {/* Workflow Steps */}
            <div className="space-y-2">
              {/* Retrieved Step */}
              <div className="flex items-start gap-2 bg-secondary/50 rounded-md p-2">
                <Search className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    Retrieved
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    all accounts sorted by last interaction date an...
                  </p>
                </div>
              </div>

              {/* Analyzed Step */}
              <div className="flex items-start gap-2 bg-secondary/50 rounded-md p-2">
                <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    Analyzed
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    17 accounts answered – what are the key deta...
                  </p>
                </div>
              </div>

              {/* Emails Drafted Step */}
              <div className="flex items-start gap-2 bg-secondary/50 rounded-md p-2">
                <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    Emails drafted
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    17 emails drafted to customer who have...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: CRM Context Panel */}
        <div className="w-[300px] border-l border-border bg-background/60 backdrop-blur-sm flex flex-col">
          {/* Top Tabs */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border text-xs">
            <button className="text-foreground font-medium">Overview</button>
            <button className="text-muted-foreground flex items-center gap-1">
              Contacts
              <span className="text-[10px] bg-secondary px-1 rounded">3</span>
            </button>
            <button className="text-muted-foreground flex items-center gap-1">
              Meetings
              <span className="text-[10px] bg-secondary px-1 rounded">5</span>
            </button>
          </div>

          {/* Company Card */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">
                  R
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Relay Labs
              </h3>
            </div>

            {/* Account Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Account summary
              </h4>
              <p className="text-xs text-foreground leading-relaxed line-clamp-3">
                One opportunity is in mid-stage discussions, Zhang (Vertex
                Systems) exploring edge infra observability platform. The most
                recent me...
              </p>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <div className="flex-1 overflow-y-auto">
            {/* Notifications */}
            <div className="px-4 py-2 flex items-center justify-between text-xs hover:bg-secondary/30 cursor-pointer">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground">Notifications</span>
              </div>
              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                9
              </span>
            </div>

            {/* Records Section */}
            <div className="px-4 py-2 space-y-1">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Records
              </h4>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                Accounts
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <Target className="w-3.5 h-3.5 text-muted-foreground" />
                Opportunities
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                Contacts
              </button>
            </div>

            {/* Resources Section */}
            <div className="px-4 py-2 space-y-1">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Resources
              </h4>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                Tasks
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Meetings
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                Notes
              </button>
            </div>

            {/* Recent Section */}
            <div className="px-4 py-2 space-y-1">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Recent
              </h4>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <div className="w-3.5 h-3.5 bg-yellow-500 rounded-sm" />
                Echo
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <div className="w-3.5 h-3.5 bg-purple-500 rounded-sm" />
                Flux
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <div className="w-3.5 h-3.5 bg-blue-500 rounded-sm" />
                Cascade
              </button>
              <button className="w-full flex items-center gap-2 text-xs text-foreground hover:bg-secondary/30 px-2 py-1.5 rounded">
                <div className="w-3.5 h-3.5 bg-pink-500 rounded-sm" />
                Bolt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
