/**
 * AgentSphere — Individual 3D Sphere for a Bias Agent
 * See AGENT.md §11 — Agent Color & Visual Identity Map
 *
 * Renders a glowing sphere with a gentle pulsing animation.
 * Uses: @react-three/fiber, @react-three/drei
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Generate a procedural roughness map on an offscreen canvas.
 * Creates a subtle organic mottled texture (cloud-like noise).
 */
function createRoughnessMap(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base mid-gray (roughness ~0.35)
  ctx.fillStyle = "#595959";
  ctx.fillRect(0, 0, size, size);

  // Layer several passes of semi-transparent blurred circles
  // to build an organic, cloud-like roughness variation.
  const passes = [
    { count: 120, minR: 8,  maxR: 40, alpha: 0.07 },
    { count: 200, minR: 3,  maxR: 18, alpha: 0.06 },
    { count: 300, minR: 1,  maxR: 8,  alpha: 0.08 },
  ];

  for (const pass of passes) {
    for (let i = 0; i < pass.count; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = pass.minR + Math.random() * (pass.maxR - pass.minR);
      const bright = Math.floor(Math.random() * 255);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${bright},${bright},${bright},${pass.alpha})`);
      grad.addColorStop(1, `rgba(${bright},${bright},${bright},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Shared roughness texture — created once, reused by all spheres */
let _roughnessMap = null;
function getRoughnessMap() {
  if (!_roughnessMap) _roughnessMap = createRoughnessMap(256);
  return _roughnessMap;
}

/**
 * Custom haze glow material — opacity falls off smoothly
 * from center to edge using the view-normal angle (fresnel).
 */
function GlowMaterial({ color, opacity = 0.18 }) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(color) },
      baseOpacity: { value: opacity },
    }),
    [color, opacity]
  );

  return (
    <shaderMaterial
      uniforms={uniforms}
      transparent
      depthWrite={false}
      side={THREE.FrontSide}
      vertexShader={/* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `}
      fragmentShader={/* glsl */ `
        uniform vec3 glowColor;
        uniform float baseOpacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = dot(vNormal, vViewDir);
          // Soft power curve: bright at center, fading at edges
          float glow = pow(max(rim, 0.0), 1.5);
          // Extra soft outer haze
          float haze = pow(max(rim, 0.0), 0.6) * 0.3;
          float alpha = (glow * 0.7 + haze) * baseOpacity;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `}
    />
  );
}

/**
 * @param {Object} props
 * @param {[number, number, number]} props.position — 3D position in the scene
 * @param {string} props.color — Hex color from AGENT.md §11
 * @param {number} props.score — Agent's current dominance score (0-100)
 * @param {boolean} props.isDominant — Whether this is the highest-scoring agent
 * @param {boolean} props.isDebating — Whether the debate is running
 * @param {boolean} props.isSpeaking — Whether this agent is currently speaking
 * @param {string} props.agentName — Agent identifier string
 * @param {number} [props.radius] — Optional fixed radius; overrides score-based scale when set
 */
export default function AgentSphere({
  position = [0, 0, 0],
  color = "#E2E8F0",
  score = 25,
  isDominant = false,
  isDebating = false,
  isSpeaking = false,
  agentName = "",
  radius,
}) {
  const meshRef = useRef();
  const glowRef = useRef();

  // Scale: use explicit radius if provided, else from score (0-100 → 0.3-1.2)
  const baseScale = radius !== undefined ? radius : 0.3 + (score / 100) * 0.9;

  // Procedural roughness texture (shared singleton)
  const roughnessMap = useMemo(() => getRoughnessMap(), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (meshRef.current) {
      // Gentle pulsing — scale oscillates ±5% (faster when speaking)
      const pulseSpeed = isSpeaking ? 4 : 2;
      const pulse = 1 + Math.sin(time * pulseSpeed + position[0] * 3 + position[1] * 5) * 0.05;
      meshRef.current.scale.setScalar(pulse);

      // Update emissive intensity — boosted when speaking
      const material = meshRef.current.material;
      if (material) {
        const baseIntensity = isSpeaking ? 1.2 : isDominant ? 0.8 : 0.4;
        material.emissiveIntensity =
          baseIntensity + Math.sin(time * 1.5 + position[0]) * 0.15;
      }
    }

    // Animate outer glow — brighter when speaking
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(time * 1.3 + position[1]) * 0.08;
      glowRef.current.scale.setScalar(glowPulse);
      const glowMat = glowRef.current.material;
      if (glowMat && glowMat.uniforms) {
        const baseOp = isSpeaking ? 0.4 : isDominant ? 0.28 : 0.18;
        glowMat.uniforms.baseOpacity.value =
          baseOp + Math.sin(time * 1.8 + position[0]) * 0.04;
      }
    }
  });

  return (
    <group position={position}>
      {/* Core sphere */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[baseScale, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isDominant ? 0.8 : 0.4}
          roughness={0.35}
          roughnessMap={roughnessMap}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>
      {/* Outer haze glow — soft falloff via custom shader */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseScale * 2.2, 32, 32]} />
        <GlowMaterial color={color} opacity={isDominant ? 0.28 : 0.18} />
      </mesh>
    </group>
  );
}
