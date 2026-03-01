/**
 * ConnectionLines — Squiggly Glowing Lines Between Spheres
 *
 * Renders organic, undulating white lines connecting all bias balls
 * to each other and to the user ball using CatmullRomCurve3 splines.
 * Lines animate over time to create a living, neural-network feel.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Generate a squiggly CatmullRom curve between two 3D points.
 * @param {THREE.Vector3} start
 * @param {THREE.Vector3} end
 * @param {number} seed — unique offset for each line
 * @param {number} time — animated time value
 * @returns {THREE.CatmullRomCurve3}
 */
function makeSquigglyCurve(start, end, seed, time) {
  const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  // Create a perpendicular vector for offsets
  const up = new THREE.Vector3(0, 0, 1);
  const perp1 = new THREE.Vector3().crossVectors(direction, up).normalize();
  const perp2 = new THREE.Vector3().crossVectors(direction, perp1).normalize();

  // If direction is parallel to up, recalculate
  if (perp1.length() < 0.01) {
    perp1.set(1, 0, 0);
    perp2.crossVectors(direction, perp1).normalize();
  }

  const controlPoints = [start.clone()];

  // 4 interior control points with animated sine offsets
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const point = new THREE.Vector3().lerpVectors(start, end, t);

    const wobbleAmount = length * 0.03;
    const offset1 =
      Math.sin(time * 1.2 + seed * 7.3 + i * 2.1) * wobbleAmount;
    const offset2 =
      Math.cos(time * 0.9 + seed * 5.1 + i * 3.7) * wobbleAmount;

    point.add(perp1.clone().multiplyScalar(offset1));
    point.add(perp2.clone().multiplyScalar(offset2));

    controlPoints.push(point);
  }

  controlPoints.push(end.clone());

  return new THREE.CatmullRomCurve3(controlPoints, false, "catmullrom", 0.5);
}

/** A single animated squiggly line between two positions */
function SquigglyLine({ startPos, endPos, seed, opacity = 1 }) {
  const lineRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(0);

  const start = useMemo(
    () => new THREE.Vector3(...startPos),
    [startPos]
  );
  const end = useMemo(
    () => new THREE.Vector3(...endPos),
    [endPos]
  );

  // Create initial geometry
  const tubeSegments = 64;

  useFrame((state, delta) => {
    timeRef.current += delta;

    const curve = makeSquigglyCurve(start, end, seed, timeRef.current);
    const newGeometry = new THREE.TubeGeometry(curve, tubeSegments, 0.015, 8, false);
    const glowGeometry = new THREE.TubeGeometry(curve, tubeSegments, 0.04, 8, false);

    if (lineRef.current) {
      lineRef.current.geometry.dispose();
      lineRef.current.geometry = newGeometry;
    }
    if (glowRef.current) {
      glowRef.current.geometry.dispose();
      glowRef.current.geometry = glowGeometry;
    }
  });

  // Initial static curve for first render
  const initialCurve = useMemo(
    () => makeSquigglyCurve(start, end, seed, 0),
    [start, end, seed]
  );

  return (
    <group>
      {/* Core line */}
      <mesh ref={lineRef}>
        <tubeGeometry args={[initialCurve, tubeSegments, 0.015, 8, false]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.35 * opacity}
        />
      </mesh>
      {/* Outer glow layer */}
      <mesh ref={glowRef}>
        <tubeGeometry args={[initialCurve, tubeSegments, 0.04, 8, false]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.08 * opacity}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * ConnectionLines — renders all connections between the given positions.
 * @param {Object} props
 * @param {Array<[number,number,number]>} props.positions — array of all sphere positions (user first, then biases)
 */
export default function ConnectionLines({ positions, opacity = 1 }) {
  // Generate all unique pairs
  const pairs = useMemo(() => {
    const result = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        result.push({
          start: positions[i],
          end: positions[j],
          seed: i * 10 + j,
        });
      }
    }
    return result;
  }, [positions]);

  return (
    <group>
      {pairs.map((pair, idx) => (
        <SquigglyLine
          key={idx}
          startPos={pair.start}
          endPos={pair.end}
          seed={pair.seed}
          opacity={opacity}
        />
      ))}
    </group>
  );
}
