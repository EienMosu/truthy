"use client";

// The animation and gesture features of Motion for the m components inside (domAnimation: animate, exit,
// variants, hover, tap, focus and in view). Each component that renders m elements, itself or through the
// helpers in its file, wraps its output in it, so it animates the same in the app and on its own in a test.
// The features load with this module, not later from an async import: nothing animates late, and the service
// worker's shell keeps every chunk a page needs.
// strict makes a full motion component under it throw, so none can bring the whole of Motion back.
import { LazyMotion, domAnimation } from "motion/react";
import type { ReactNode } from "react";

export function MotionFeatures({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
