/**
 * IdleScene — Ambient 3D preview for the InputScreen.
 *
 * Renders 4 glowing white spheres rotating in a circle on the XY plane
 * (parallel to the screen), each oscillating in depth (Z) with phase offsets.
 * Aurora floor below and ceiling above frame the scene.
 *
 * This component must be rendered inside an R3F <Canvas>.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import AgentSphere from "./AgentSphere";
import AuroraFloor from "./AuroraFloor";

const NUM_SPHERES = 4;
const ORBIT_RADIUS = 2.8;       // radius of the circle on screen
const ORBIT_SPEED = 0.25;       // rotations per ~6.28s
const DEPTH_AMPLITUDE = 1.8;    // how far they oscillate in Z
const DEPTH_SPEED = 0.6;        // Z oscillation frequency
const SPHERE_COLOR = "#E2E8F0"; // white/silver — all identical

/**
 * A group of spheres that rotate in a circle (XY plane) and bob in Z.
 * Fades in after a delay with an ease-out curve.
 */
function OrbitingSpheres({ delay = 0.6, fadeDuration = 1.8 }) {
  const groupRef = useRef();
  const sphereRefs = useRef([]);
  const fadeStarted = useRef(false);
  const fadeStartTime = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // — Fade-in logic —
    if (!fadeStarted.current) {
      if (t >= delay) {
        fadeStarted.current = true;
        fadeStartTime.current = t;
      }
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (!groupRef.current) return;
    groupRef.current.visible = true;

    const fadeProgress = Math.min((t - fadeStartTime.current) / fadeDuration, 1);
    const fadeAlpha = 1 - Math.pow(1 - fadeProgress, 3); // ease-out cubic

    // — Position each sphere on a rotating circle + depth oscillation —
    for (let i = 0; i < NUM_SPHERES; i++) {
      const ref = sphereRefs.current[i];
      if (!ref) continue;

      // Even angular spacing + rotation over time
      const angle = (i / NUM_SPHERES) * Math.PI * 2 + t * ORBIT_SPEED;
      const x = Math.cos(angle) * ORBIT_RADIUS;
      const y = Math.sin(angle) * ORBIT_RADIUS;

      // Each sphere oscillates in Z with a phase offset
      const zPhase = (i / NUM_SPHERES) * Math.PI * 2;
      const z = Math.sin(t * DEPTH_SPEED + zPhase) * DEPTH_AMPLITUDE;

      ref.position.set(x, y, z);

      // Apply fade to all materials in this sphere group
      ref.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = fadeAlpha;
          if (child.material.uniforms?.baseOpacity) {
            const base = child.material.userData?.targetOpacity ?? 0.18;
            child.material.uniforms.baseOpacity.value = base * fadeAlpha;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: NUM_SPHERES }, (_, i) => (
        <group
          key={i}
          ref={(el) => { sphereRefs.current[i] = el; }}
        >
          <AgentSphere
            position={[0, 0, 0]}
            color={SPHERE_COLOR}
            score={22}
            isDominant={true}
            isDebating={false}
            isSpeaking={false}
            agentName={`idle_${i}`}
          />
        </group>
      ))}
    </group>
  );
}

export default function IdleScene() {
  return (
    <>
      {/* Background color matching InputScreen */}
      <color attach="background" args={["#0A0A0F"]} />

      {/* Minimal lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[-8, -8, -6]} intensity={0.3} color="#A855F7" />
      <pointLight position={[8, 6, 4]} intensity={0.2} color="#E2E8F0" />

      {/* Aurora ground plane */}
      <AuroraFloor y={-4.5} />

      {/* Subtle ceiling aurora reflection */}
      <AuroraFloor y={6.5} />

      {/* Glowing white spheres — circular orbit + depth oscillation */}
      <OrbitingSpheres delay={0.6} fadeDuration={1.8} />
    </>
  );
}
