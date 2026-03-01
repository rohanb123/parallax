/**
 * StarfieldBackground — subtle parallax starfield for full-screen pages
 * Used on homepage and optionally behind 3D scene. Slow, minimal motion.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";

export default function StarfieldBackground() {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <Stars
      ref={ref}
      radius={100}
      depth={60}
      count={2000}
      factor={1.5}
      fade
      speed={0.3}
    />
  );
}
