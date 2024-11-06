import type { MotionStyle, MotionValue } from "framer-motion";
import type { ReactNode, RefObject } from "react";
import { createContext, useContext, useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

interface ParallaxScrollConfig {
  container: RefObject<HTMLElement>;
  springConfig?: {
    stiffness: number;
    damping: number;
    restDelta: number;
  };
}

interface ParallaxTransformConfig {
  property: string;
  inputRange: number[];
  outputRange: (string | number)[];
}

export const useParallaxScroll = ({
  container,
  springConfig = {
    stiffness: 300,
    damping: 30,
    restDelta: 0.001,
  },
}: ParallaxScrollConfig) => {
  const { scrollYProgress } = useScroll({ container });
  const springScrollYProgress = useSpring(scrollYProgress, springConfig);

  const useCreateTransform = ({
    property,
    inputRange,
    outputRange,
  }: ParallaxTransformConfig) => {
    return useTransform(springScrollYProgress, inputRange, outputRange);
  };

  return {
    scrollYProgress: springScrollYProgress,
    useCreateTransform,
  };
};

interface ParallaxContainerProps {
  children: ReactNode;
  className?: string;
  springConfig?: {
    stiffness: number;
    damping: number;
    restDelta: number;
  };
}

export const ParallaxContainer: React.FC<ParallaxContainerProps> = ({
  children,
  className = "",
  springConfig,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress, useCreateTransform } = useParallaxScroll({
    container: scrollRef,
    springConfig,
  });

  return (
    <ParallaxContext.Provider value={{ scrollYProgress, useCreateTransform }}>
      <div
        ref={scrollRef}
        className={`relative h-screen overflow-y-auto overscroll-none no-scrollbar ${className}`}
      >
        {children}
      </div>
    </ParallaxContext.Provider>
  );
};

interface ParallaxContextType {
  scrollYProgress: MotionValue<number>;
  useCreateTransform: (config: {
    property: string;
    inputRange: number[];
    outputRange: (string | number)[];
  }) => MotionValue<string | number>;
}

export const ParallaxContext = createContext<ParallaxContextType | null>(null);

export const useParallaxContext = () => {
  const context = useContext(ParallaxContext);
  if (!context) {
    throw new Error("useParallaxContext must be used within ParallaxContainer");
  }
  return context;
};

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  translateY?: {
    inputRange: number[];
    outputRange: string[];
  };
  opacity?: {
    inputRange: number[];
    outputRange: number[];
  };
  fixed?: boolean;
}

export const ParallaxSection: React.FC<ParallaxSectionProps> = ({
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
