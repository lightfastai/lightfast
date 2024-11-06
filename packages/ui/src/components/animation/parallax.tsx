import type { MotionStyle, MotionValue } from "framer-motion";
import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// Types
interface ParallaxContextType {
  scrollYProgress: MotionValue<number>;
  useCreateTransform: (config: TransformConfig) => MotionValue<string | number>;
}

interface TransformConfig {
  property: string;
  inputRange: number[];
  outputRange: (string | number)[];
}

// Context
const ParallaxContext = createContext<ParallaxContextType | null>(null);

// Hook
const useParallaxContext = () => {
  const context = useContext(ParallaxContext);
  if (!context) {
    throw new Error("Parallax components must be used within Parallax.Root");
  }
  return context;
};

interface ParallaxRootProps {
  children: ReactNode;
  className?: string;
  springConfig?: {
    stiffness: number;
    damping: number;
    restDelta: number;
  };
}

// Root Component and Namespace
const Root: React.FC<ParallaxRootProps> = ({
  children,
  className = "",
  springConfig,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ container: scrollRef });
  const springScrollYProgress = useSpring(scrollYProgress, {
    stiffness: 300,
    damping: 30,
    restDelta: 0.001,
    ...springConfig,
  });

  const useCreateTransform = ({
    property,
    inputRange,
    outputRange,
  }: TransformConfig) => {
    return useTransform(springScrollYProgress, inputRange, outputRange);
  };

  return (
    <ParallaxContext.Provider
      value={{ scrollYProgress: springScrollYProgress, useCreateTransform }}
    >
      <div
        ref={scrollRef}
        className={`relative h-screen overflow-y-auto overscroll-none no-scrollbar ${className}`}
      >
        {children}
      </div>
    </ParallaxContext.Provider>
  );
};

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  translateY?: TransformConfig;
  opacity?: TransformConfig;
  fixed?: boolean;
}

// Section Component
const Section: React.FC<ParallaxSectionProps> = ({
  children,
  className = "",
  translateY,
  opacity,
  fixed = false,
}) => {
  const { useCreateTransform } = useParallaxContext();
  const style: MotionStyle = {};

  const translateYTransform = useCreateTransform({
    property: "translateY",
    inputRange: translateY?.inputRange ?? [0, 1],
    outputRange: translateY?.outputRange ?? [0, 0],
  });

  const opacityTransform = useCreateTransform({
    property: "opacity",
    inputRange: opacity?.inputRange ?? [0, 1],
    outputRange: opacity?.outputRange ?? [0, 0],
  });

  if (translateY) {
    style.translateY = translateYTransform;
  }

  if (opacity) {
    style.opacity = opacityTransform;
  }

  return (
    <motion.section
      className={`${fixed ? "fixed bottom-0 left-0 right-0 top-0" : ""} ${className}`}
      style={style}
    >
      {children}
    </motion.section>
  );
};

interface ParallaxPercentageProps {
  className?: string;
}

// Percentage Component
const Percentage: React.FC<ParallaxPercentageProps> = ({ className = "" }) => {
  const { scrollYProgress } = useParallaxContext();
  const formattedPercentage = useTransform(scrollYProgress, (value) =>
    (value * 100).toFixed(2),
  );

  return (
    <motion.div
      className={`fixed bottom-8 right-16 z-50 mix-blend-difference ${className}`}
    >
      <div className="font-mono text-xs font-bold uppercase tracking-wider">
        <span className="text-muted-foreground">Scroll</span>
        <span className="text-muted-foreground">(</span>
        <motion.span className="inline-block min-w-[2ch] text-right text-primary">
          {formattedPercentage}
        </motion.span>
        <span className="text-primary">%</span>
        <span className="text-muted-foreground">)</span>
      </div>
    </motion.div>
  );
};

// Scroll Extension Component
// @todo only supports vertical scrolling for 200vh for now
const ScrollExtension: React.FC = () => {
  return <div className="h-[200vh]"></div>;
};

const ScrollHelperIcon: React.FC = () => {
  const { scrollYProgress } = useParallaxContext();
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.01], // Very small scroll threshold
    [1, 0],
  );

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center justify-center"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className="pointer-events-auto cursor-pointer"
              whileHover={{
                y: [0, 4, 0],
                transition: { repeat: Infinity, duration: 1.5 },
              }}
            >
              <ArrowDown className="h-4 w-4 text-muted-foreground/80" />
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Scroll to explore</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
};

// Export as namespace
export const Parallax = {
  Root,
  Section,
  Percentage,
  ScrollExtension,
  ScrollHelperIcon,
};
