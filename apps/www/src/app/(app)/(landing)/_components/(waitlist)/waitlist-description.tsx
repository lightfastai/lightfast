"use client";

import { motion } from "framer-motion";

const paragraphs = [
  {
    id: 0,
    className: "font-semibold text-foreground",
    text: "Built for technical founders and devs",
  },
  {
    id: 1,
    className: "text-foreground",
    text: "Lightfast is a cloud-native agent execution engine designed for developers who want to build production-grade AI applications without infrastructure complexity. Deploy agents in minutes, not days.",
  },
  {
    id: 2,
    className: "text-foreground",
    text: "Building AI agents shouldn't require infrastructure expertise. Focus on your logic while we handle the orchestration.",
  },
  {
    id: 3,
    className: "text-foreground",
    text: "So you don't just deploy faster, you build something you're proud of",
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
