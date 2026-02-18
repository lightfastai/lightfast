import * as React from "react";
import { cva  } from "class-variance-authority";
import type {VariantProps} from "class-variance-authority";
import { cn } from "@repo/ui/lib/utils";

const gridRootVariants = cva(
  "relative overflow-hidden",
  {
    variants: {
      mode: {
        viewport: "min-h-screen bg-background",
        flex: "min-h-[600px] bg-background",
      },
      density: {
        sparse: "",
        normal: "",
        dense: "",
      },
      emphasis: {
        subtle: "",
        normal: "",
        strong: "",
      },
    },
    defaultVariants: {
      mode: "viewport",
      density: "normal",
      emphasis: "normal",
    },
  }
);

const gridLineStyles = cva(
  "",
  {
    variants: {
      emphasis: {
        subtle: "bg-border/20",
        normal: "bg-border/30",
        strong: "bg-border/50",
      },
      type: {
        primary: "",
        secondary: "",
      },
    },
    compoundVariants: [
      {
        emphasis: "subtle",
        type: "secondary",
        className: "bg-border/10",
      },
      {
        emphasis: "normal",
        type: "secondary",
        className: "bg-border/20",
      },
      {
        emphasis: "strong",
        type: "secondary",
        className: "bg-border/30",
      },
    ],
    defaultVariants: {
      emphasis: "normal",
      type: "primary",
    },
  }
);

const containerVariants = cva(
  "border border-border/50 bg-background z-20",
  {
    variants: {
      mode: {
        viewport: "absolute inset-[var(--margin-vertical-mobile)_var(--margin-horizontal-mobile)] lg:inset-[var(--margin-vertical)_var(--margin-horizontal)] bg-background",
        flex: "relative w-full h-full p-8 lg:p-16 bg-background",
      },
    },
    defaultVariants: {
      mode: "viewport",
    },
  }
);

interface LightfastCustomGridBackgroundProps extends VariantProps<typeof gridRootVariants> {
  children: React.ReactNode;
  className?: string;
  marginVertical?: string;
  marginHorizontal?: string;
  marginVerticalMobile?: string;
  marginHorizontalMobile?: string;
}

function Root({ 
  children, 
  className = "",
  mode = "viewport",
  density = "normal",
  emphasis = "normal",
  marginVertical = "15vh",
  marginHorizontal = "15vw",
  marginVerticalMobile = "5vh",
  marginHorizontalMobile = "5vw"
}: LightfastCustomGridBackgroundProps) {
  const gridLinePositions = React.useMemo(() => {
    if (mode === "viewport") {
      return {
        "--margin-vertical": marginVertical,
        "--margin-horizontal": marginHorizontal,
        "--margin-vertical-mobile": marginVerticalMobile,
        "--margin-horizontal-mobile": marginHorizontalMobile,
      } as React.CSSProperties;
    } else {
      // For flex mode, use fixed pixel values or percentages
      return {
        "--margin-vertical": "64px",
        "--margin-horizontal": "64px",
        "--margin-vertical-mobile": "32px",
        "--margin-horizontal-mobile": "32px",
      } as React.CSSProperties;
    }
  }, [mode, marginVertical, marginHorizontal, marginVerticalMobile, marginHorizontalMobile]);

  const getGridSpacing = React.useCallback(() => {
    switch (density) {
      case "sparse":
        return { divisions: 2, opacity: "20" };
      case "dense":
        return { divisions: 5, opacity: "15" };
      default:
        return { divisions: 3, opacity: "20" };
    }
  }, [density]);

  const { divisions } = getGridSpacing();

  if (mode === "flex") {
    // Flex mode: Grid adapts to container content
    return (
      <div 
        className={cn(gridRootVariants({ mode, density, emphasis }), "relative", className)} 
        style={gridLinePositions}
      >
        {/* Grid wrapper that sizes to content */}
        <div className="relative w-full min-h-[400px]">
          {/* Grid lines - Desktop */}
          <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
            {/* Outer border lines - using fixed positioning */}
            <div className={cn("absolute top-0 bottom-0 w-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ left: "var(--margin-horizontal)" }} />
            <div className={cn("absolute top-0 bottom-0 w-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ right: "var(--margin-horizontal)" }} />
            <div className={cn("absolute left-0 right-0 h-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ top: "var(--margin-vertical)" }} />
            <div className={cn("absolute left-0 right-0 h-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ bottom: "var(--margin-vertical)" }} />
            
            {/* Inner grid divisions */}
            {Array.from({ length: divisions - 1 }).map((_, i) => {
              const position = ((i + 1) / divisions) * 100;
              return (
                <React.Fragment key={i}>
                  <div
                    className={cn("absolute h-full w-px", gridLineStyles({ emphasis, type: "secondary" }))}
                    style={{ 
                      left: `calc(var(--margin-horizontal) + (100% - 2 * var(--margin-horizontal)) * ${position / 100})` 
                    }}
                  />
                  <div
                    className={cn("absolute w-full h-px", gridLineStyles({ emphasis, type: "secondary" }))}
                    style={{ 
                      top: `calc(var(--margin-vertical) + (100% - 2 * var(--margin-vertical)) * ${position / 100})` 
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>

          {/* Grid lines - Mobile */}
          <div className="pointer-events-none absolute inset-0 z-10 lg:hidden">
            {/* Outer border lines - using fixed positioning */}
            <div className={cn("absolute top-0 bottom-0 w-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ left: "var(--margin-horizontal-mobile)" }} />
            <div className={cn("absolute top-0 bottom-0 w-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ right: "var(--margin-horizontal-mobile)" }} />
            <div className={cn("absolute left-0 right-0 h-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ top: "var(--margin-vertical-mobile)" }} />
            <div className={cn("absolute left-0 right-0 h-px", gridLineStyles({ emphasis, type: "primary" }))} 
                 style={{ bottom: "var(--margin-vertical-mobile)" }} />
            
            {/* Inner grid divisions - fewer on mobile */}
            {Array.from({ length: Math.max(1, divisions - 2) }).map((_, i) => {
              const position = ((i + 1) / Math.max(2, divisions - 1)) * 100;
              return (
                <React.Fragment key={i}>
                  <div
                    className={cn("absolute h-full w-px", gridLineStyles({ emphasis, type: "secondary" }))}
                    style={{ 
                      left: `calc(var(--margin-horizontal-mobile) + (100% - 2 * var(--margin-horizontal-mobile)) * ${position / 100})` 
                    }}
                  />
                  <div
                    className={cn("absolute w-full h-px", gridLineStyles({ emphasis, type: "secondary" }))}
                    style={{ 
                      top: `calc(var(--margin-vertical-mobile) + (100% - 2 * var(--margin-vertical-mobile)) * ${position / 100})` 
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    );
  }

  // Viewport mode: Original implementation
  return (
    <div 
      className={cn(gridRootVariants({ mode, density, emphasis }), className)} 
      style={gridLinePositions}
    >
      {/* Grid lines - Desktop */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
        {/* Horizontal lines through corners */}
        <div
          className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ top: "var(--margin-vertical)" }}
        />
        <div
          className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ bottom: "var(--margin-vertical)" }}
        />
        
        {/* Vertical lines through corners */}
        <div
          className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ left: "var(--margin-horizontal)" }}
        />
        <div
          className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ right: "var(--margin-horizontal)" }}
        />
        
        {/* Inner grid lines */}
        {Array.from({ length: divisions - 1 }).map((_, i) => {
          const position = (i + 1) / divisions;
          return (
            <React.Fragment key={i}>
              <div
                className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "secondary" }))}
                style={{ top: `calc(var(--margin-vertical) + (100vh - 2 * var(--margin-vertical)) * ${position})` }}
              />
              <div
                className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "secondary" }))}
                style={{ left: `calc(var(--margin-horizontal) + (100vw - 2 * var(--margin-horizontal)) * ${position})` }}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Grid lines - Mobile */}
      <div className="pointer-events-none absolute inset-0 z-10 lg:hidden">
        {/* Horizontal lines through corners */}
        <div
          className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ top: "var(--margin-vertical-mobile)" }}
        />
        <div
          className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ bottom: "var(--margin-vertical-mobile)" }}
        />
        
        {/* Vertical lines through corners */}
        <div
          className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ left: "var(--margin-horizontal-mobile)" }}
        />
        <div
          className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "primary" }))}
          style={{ right: "var(--margin-horizontal-mobile)" }}
        />
        
        {/* Inner grid lines - fewer on mobile */}
        {Array.from({ length: Math.max(1, divisions - 2) }).map((_, i) => {
          const position = (i + 1) / Math.max(2, divisions - 1);
          return (
            <React.Fragment key={i}>
              <div
                className={cn("absolute h-px w-full", gridLineStyles({ emphasis, type: "secondary" }))}
                style={{ top: `calc(var(--margin-vertical-mobile) + (100vh - 2 * var(--margin-vertical-mobile)) * ${position})` }}
              />
              <div
                className={cn("absolute top-0 h-full w-px", gridLineStyles({ emphasis, type: "secondary" }))}
                style={{ left: `calc(var(--margin-horizontal-mobile) + (100vw - 2 * var(--margin-horizontal-mobile)) * ${position})` }}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

interface ContainerProps extends VariantProps<typeof containerVariants> {
  children: React.ReactNode;
  className?: string;
}

function Container({ 
  children, 
  className = "",
  mode = "viewport" 
}: ContainerProps) {
  return (
    <div className={cn(containerVariants({ mode }), className)}>
      {children}
    </div>
  );
}

interface ItemProps {
  children: React.ReactNode;
  className?: string;
  noBorder?: boolean;
  borderStyle?: "solid" | "dashed" | "dotted";
  emphasis?: "subtle" | "normal" | "strong";
}

function Item({ 
  children, 
  className = "",
  noBorder = false,
  borderStyle = "solid",
  emphasis = "normal"
}: ItemProps) {
  const borderClass = React.useMemo(() => {
    if (noBorder) return "";
    
    const emphasisClasses = {
      subtle: "border-border/20",
      normal: "border-border/30",
      strong: "border-border/50",
    };
    
    const styleClasses = {
      solid: "border-solid",
      dashed: "border-dashed",
      dotted: "border-dotted",
    };
    
    return cn(
      "border-b",
      emphasisClasses[emphasis],
      styleClasses[borderStyle]
    );
  }, [noBorder, borderStyle, emphasis]);

  return (
    <div className={cn("relative", className)}>
      {/* Full-width border that extends to viewport edges */}
      {!noBorder && (
        <div 
          className={cn(
            "absolute bottom-0 left-1/2 -translate-x-1/2 w-screen h-px",
            borderClass
          )}
          style={{
            width: "100vw",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      )}
      
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

export const LightfastCustomGridBackground = {
  Root,
  Container,
  Item,
};

// Export types for external use
export type { LightfastCustomGridBackgroundProps, ContainerProps, ItemProps };
export { gridRootVariants, containerVariants };