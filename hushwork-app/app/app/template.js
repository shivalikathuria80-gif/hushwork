"use client";

import { motion } from "motion/react";

// Each app page slides up a little as it opens, so moving between pages feels like one app rather than a reload.
// (A template is mounted afresh on every navigation, unlike the layout. Reduce motion leaves only the fade: MotionProvider.)
export default function AppTemplate({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
