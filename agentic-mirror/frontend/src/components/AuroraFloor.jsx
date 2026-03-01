/**
 * AuroraFloor — A stationary ground plane with a blurred, colorful aurora effect.
 * Uses a custom fragment shader to blend soft color blobs.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function AuroraFloor({ y = -4.5 }) {
  const matRef = useRef();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;

    // Pure sine-based smooth blobs — no grid noise, no pixelation
    float blob(vec2 uv, vec2 center, float radius) {
      float d = length(uv - center);
      return smoothstep(radius, 0.0, d);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;

      // Distance from center for edge fade
      float dist = length(center) * 2.0;

      // Slow time
      float t = uTime * 0.06;

      // Smoothly drifting blob centers using sine waves
      vec2 c1 = vec2(0.5 + sin(t * 0.7) * 0.25, 0.5 + cos(t * 0.5) * 0.2);
      vec2 c2 = vec2(0.5 + cos(t * 0.6 + 1.0) * 0.3, 0.5 + sin(t * 0.8 + 2.0) * 0.25);
      vec2 c3 = vec2(0.5 + sin(t * 0.4 + 3.0) * 0.28, 0.5 + cos(t * 0.9 + 1.5) * 0.22);
      vec2 c4 = vec2(0.5 + cos(t * 0.5 + 4.0) * 0.2, 0.5 + sin(t * 0.7 + 3.0) * 0.3);
      vec2 c5 = vec2(0.5 + sin(t * 0.8 + 5.0) * 0.22, 0.5 + cos(t * 0.6 + 4.5) * 0.18);

      // Generate smooth blobs with wide radii
      float b1 = blob(uv, c1, 0.55);
      float b2 = blob(uv, c2, 0.50);
      float b3 = blob(uv, c3, 0.45);
      float b4 = blob(uv, c4, 0.48);
      float b5 = blob(uv, c5, 0.42);

      // Aurora colors — teals, purples, magentas, greens
      vec3 col1 = vec3(0.14, 0.85, 0.75);  // teal / cyan
      vec3 col2 = vec3(0.55, 0.20, 0.90);  // purple
      vec3 col3 = vec3(0.90, 0.25, 0.55);  // magenta / pink
      vec3 col4 = vec3(0.20, 0.75, 0.40);  // green
      vec3 col5 = vec3(0.30, 0.45, 0.95);  // blue

      // Blend colors based on blobs
      vec3 color = vec3(0.0);
      color += col1 * b1 * 0.6;
      color += col2 * b2 * 0.55;
      color += col3 * b3 * 0.5;
      color += col4 * b4 * 0.5;
      color += col5 * b5 * 0.45;

      // Circular edge fade — soft falloff from center
      float edgeFade = 1.0 - smoothstep(0.3, 1.0, dist);

      // Overall opacity — keep it subtle
      float alpha = edgeFade * 0.55;

      // Brighten slightly so colors pop
      color = color * 1.2;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[24, 24, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
