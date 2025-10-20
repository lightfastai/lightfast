"use client";

import { motion } from "framer-motion";

const paragraphs = [
  {
    id: 0,
    className: "font-semibold text-foreground",
    text: "Built for dev founders shipping products",
  },
  {
    id: 1,
    className: "text-foreground",
    text: "Connect AI to any tool via natural language. Automate complex workflows without code. From GitHub to APIs, databases to CLIs—make every tool AI-orchestrable.",
  },
  {
    id: 2,
    className: "text-foreground",
    text: "AI-native workflows that understand intent, not just trigger-action. Describe what you want, we figure out how. Context-aware orchestration that learns from production.",
  },
  {
    id: 3,
    className: "text-foreground",
    text: "Ship products faster. Focus on building, not configuring integrations.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.4,
    },
  },
};

const paragraphVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export function WaitlistDescription() {
  // Reverse order for animation (bottom to top)
  const animatedParagraphs = [...paragraphs].reverse();

  return (
    <motion.div
      className="space-y-4 text-md"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {animatedParagraphs.map((para) => (
        <motion.p
          key={para.id}
          className={para.className}
          variants={paragraphVariants}
        >
          {para.text}
        </motion.p>
      ))}
    </motion.div>
  );
}
