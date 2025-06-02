"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Slider } from "@repo/ui/components/ui/slider";
import { Switch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";

import type {
  LandingPhaseConfig,
  LandingPhaseReturn,
} from "../../hooks/use-landing-phases";
import { testConfigs } from "../../hooks/use-landing-phases";

interface DebugPanelProps {
  phaseData: LandingPhaseReturn;
  onConfigChange: (config: Partial<LandingPhaseConfig>) => void;
}

export function DebugPanel({ phaseData, onConfigChange }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"phases" | "controls" | "presets">(
    "controls",
  );

  const { phaseStates, currentPhase, globalProgress, controls, config } =
    phaseData;

  const handlePhaseToggle = (
    phaseName: keyof LandingPhaseConfig["phases"],
    enabled: boolean,
  ) => {
    const currentPhaseConfig = config.phases[phaseName];
    if (!currentPhaseConfig) return;

    onConfigChange({
      phases: {
        ...config.phases,
        [phaseName]: {
          ...currentPhaseConfig,
          enabled,
        },
      },
    });
  };

  const handleProgressChange = (value: number[]) => {
    if (value.length > 0 && value[0] !== undefined) {
      controls.setManualProgress(value[0] / 100);
    }
  };

  const jumpToPhase = (phaseName: keyof LandingPhaseConfig["phases"]) => {
    controls.jumpToPhase(phaseName);
  };

  const loadPreset = (presetName: keyof typeof testConfigs) => {
    const preset = testConfigs[presetName];
    onConfigChange(preset);
  };

  const toggleDebugMode = (enabled: boolean) => {
    onConfigChange({
      debug: {
        ...config.debug,
        enabled,
      },
    });
  };

  const toggleWheelInput = (enabled: boolean) => {
    if (enabled) {
      controls.enableWheel();
    } else {
      controls.disableWheel();
    }

    onConfigChange({
      testing: {
        ...config.testing,
        disableWheel: !enabled,
      },
    });
  };

  if (!config.debug.enabled) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          onClick={() => toggleDebugMode(true)}
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm"
        >
          Debug Mode
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80">
      <Card className="bg-background/95 shadow-lg backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Landing Debug Panel
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleDebugMode(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="flex space-x-1">
              {(["controls", "phases", "presets"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className="h-6 px-2 text-xs capitalize"
                >
                  {tab}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-3 pt-0">
            {/* Status Display */}
            <div className="rounded border p-2 text-xs">
              <div className="flex justify-between">
                <span>Current Phase:</span>
                <span className="text-primary font-mono">
                  {currentPhase || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Progress:</span>
                <span className="font-mono">
                  {(globalProgress * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === "controls" && (
              <div className="space-y-3">
                {/* Manual Progress Control */}
                <div className="space-y-2">
                  <Label className="text-xs">Manual Progress</Label>
                  <Slider
                    value={[globalProgress * 100]}
                    onValueChange={handleProgressChange}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Quick Jump Buttons */}
                <div className="space-y-1">
                  <Label className="text-xs">Quick Jump</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.keys(config.phases).map((phaseName) => {
                      const key =
                        phaseName as keyof LandingPhaseConfig["phases"];
                      const phase = config.phases[key];
                      if (!phase) return null;

                      return (
                        <Button
                          key={phaseName}
                          variant="outline"
                          size="sm"
                          onClick={() => jumpToPhase(key)}
                          disabled={!phase.enabled}
                          className="h-6 px-1 text-xs"
                        >
                          {phaseName.replace(/([A-Z])/g, " $1").trim()}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Wheel Input</Label>
                    <Switch
                      checked={!config.testing.disableWheel}
                      onCheckedChange={toggleWheelInput}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={controls.reset}
                    className="w-full text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "phases" && (
              <div className="space-y-2">
                <Label className="text-xs">Phase Status</Label>
                <div className="space-y-1">
                  {Object.entries(phaseStates).map(([phaseName, state]) => {
                    const key = phaseName as keyof LandingPhaseConfig["phases"];
                    return (
                      <div
                        key={phaseName}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={state.enabled}
                            onCheckedChange={(checked) =>
                              handlePhaseToggle(key, checked as boolean)
                            }
                          />
                          <span
                            className={cn(
                              state.active && "text-primary font-medium",
                              !state.enabled &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {phaseName.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {state.active && (
                            <div className="h-1 w-1 rounded-full bg-green-500" />
                          )}
                          <span className="font-mono text-xs">
                            {(state.progress * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "presets" && (
              <div className="space-y-2">
                <Label className="text-xs">Test Configurations</Label>
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPreset("earlyAccessOnly")}
                    className="w-full justify-start text-xs"
                  >
                    Early Access Only
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPreset("categoriesOnly")}
                    className="w-full justify-start text-xs"
                  >
                    Categories Only
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPreset("debugAll")}
                    className="w-full justify-start text-xs"
                  >
                    All Phases (Debug)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
