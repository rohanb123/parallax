/**
 * PyramidScene — Symmetric tetrahedron, solid translucent marbles, directional lighting.
 * Center = milky white marble. Speaking pulse (scale + halo). OrbitControls.
 * Hover: aesthetic glow only (no tooltip).
 */

import { useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BIAS_AGENT_KEYS, AGENT_COLORS as AGENT_MARBLE_COLORS } from "../utils/agentColors";

const INV_SQ3 = 1 / Math.sqrt(3);
const TETRA_SCALE = 2.4;
const TETRA_POSITIONS = {
  loss_aversion: [1, 1, 1].map((c) => c * INV_SQ3 * TETRA_SCALE),
  sunk_cost: [-1, -1, 1].map((c) => c * INV_SQ3 * TETRA_SCALE),
  optimism_bias: [-1, 1, -1].map((c) => c * INV_SQ3 * TETRA_SCALE),
  status_quo: [1, -1, -1].map((c) => c * INV_SQ3 * TETRA_SCALE),
};

function BiasNode({ agentKey, score, isHovered, isSpeaking, pulse, onPointerOver, onPointerOut }) {
  const meshRef = useRef();
  const haloRef = useRef();
  const baseScale = 0.3 + (score / 100) * 0.18;
  const targetScale = isHovered ? baseScale * 1.06 : baseScale * (1 + pulse * 0.05);
  const color = AGENT_MARBLE_COLORS[agentKey] || "#888";

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.045
    );
    if (haloRef.current?.material) {
      const base = 0.06 + pulse * 0.1;
      haloRef.current.material.opacity = isHovered ? base + 0.025 : base;
    }
  });

  return (
    <Float speed={0.5} rotationIntensity={0.08} floatIntensity={0.2}>
      <mesh
        ref={meshRef}
        position={TETRA_POSITIONS[agentKey]}
        scale={baseScale}
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerOver();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onPointerOut();
        }}
        onPointerMove={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.82}
          transmission={0.35}
          thickness={0.5}
          roughness={0.12}
          metalness={0.02}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
          envMapIntensity={0.6}
        />
      </mesh>
      <mesh
        ref={haloRef}
        position={TETRA_POSITIONS[agentKey]}
        scale={baseScale * 1.4}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>
    </Float>
  );
}

function DecisionNode({ position }) {
  const meshRef = useRef();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const noiseOffset = useRef(Math.random() * 100);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * 0.15 + noiseOffset.current;
    const drift = 0.04 * (Math.sin(t) * 0.5 + Math.sin(t * 1.3) * 0.5);
    const driftX = drift * Math.cos(t * 0.7);
    const driftY = drift * Math.sin(t * 0.5);
    const driftZ = drift * Math.cos(t * 0.3);
    if (position) {
      target.current.set(
        position[0] + driftX,
        position[1] + driftY,
        position[2] + driftZ
      );
      meshRef.current.position.lerp(target.current, 0.028);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[0.52, 64, 64]} />
      <meshPhysicalMaterial
        color="#F8F5FF"
        transparent
        opacity={0.9}
        transmission={0.25}
        thickness={0.4}
        roughness={0.08}
        metalness={0}
        clearcoat={0.5}
        clearcoatRoughness={0.05}
        envMapIntensity={0.5}
        sheen={0.15}
        sheenColor="#C4B5FD"
        sheenRoughness={0.5}
      />
    </mesh>
  );
}

export default function PyramidScene({
  scores = {},
  dominantAgent,
  speakingAgent,
  pulse,
}) {
  const [hoveredNode, setHoveredNode] = useState(null);

  const decisionPos = useMemo(() => {
    const total = BIAS_AGENT_KEYS.reduce((s, k) => s + (scores[k] || 0), 0) || 100;
    let x = 0, y = 0, z = 0;
    BIAS_AGENT_KEYS.forEach((key) => {
      const w = (scores[key] || 0) / total;
      const p = TETRA_POSITIONS[key];
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
    });
    return [x, y, z];
  }, [scores]);

  return (
    <>
      <fog attach="fog" args={["#0B0F14", 24, 65]} />

      <ambientLight intensity={0.06} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow={false} />
      <directionalLight position={[-5, 6, -4]} intensity={0.4} />
      <pointLight position={[0, 4, 4]} intensity={0.15} color="#C4B5FD" />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        minDistance={3}
        maxDistance={14}
        enablePan
      />

      <Stars radius={90} depth={50} count={1000} factor={1.5} fade speed={0.3} />

      {BIAS_AGENT_KEYS.map((key) => (
        <BiasNode
          key={key}
          agentKey={key}
          score={scores[key] || 25}
          isHovered={hoveredNode === key}
          isSpeaking={speakingAgent === key}
          pulse={speakingAgent === key ? pulse : 0}
          onPointerOver={() => setHoveredNode(key)}
          onPointerOut={() => setHoveredNode(null)}
        />
      ))}

      <DecisionNode position={decisionPos} />
    </>
  );
}
