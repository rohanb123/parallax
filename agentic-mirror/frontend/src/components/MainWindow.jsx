/**
 * MainWindow — Full-Screen Three.js Visualization + Chat Overlay
 *
 * Renders:
 *   - Full-screen Three.js canvas with 5 spheres (4 bias + 1 user center)
 *   - Squiggly glowing connection lines between all spheres
 *   - 3D chat bubble above the active speaker with typewriter effect
 *   - Camera glides to the speaking agent's sphere
 *   - Slide-up glassy chat overlay at bottom (full log)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import AgentSphere from "./AgentSphere";
import ConnectionLines from "./ConnectionLines";
import AuroraFloor from "./AuroraFloor";
import DebateStream from "./DebateStream";
import ChatBubble from "./ChatBubble";
import CameraController from "../hooks/useCameraControl";
import HelpPanel from "./HelpPanel";
import { useDebateStream } from "../hooks/useDebateStream";
import { AGENT_COLORS, AGENT_DISPLAY_NAMES, BIAS_AGENT_KEYS } from "../utils/agentColors";

// Tetrahedral (triangular pyramid) vertex positions — user in center
const R = 3;
const SPHERE_POSITIONS = {
  user: [0, 0, 0],
  loss_aversion: [0, R, 0],                                                // apex
  sunk_cost: [0, -R / 3, (2 * R * Math.SQRT2) / 3],                       // front
  optimism_bias: [(R * Math.sqrt(6)) / 3, -R / 3, -(R * Math.SQRT2) / 3], // back-right
  status_quo: [-(R * Math.sqrt(6)) / 3, -R / 3, -(R * Math.SQRT2) / 3],   // back-left
};

/** Label rendered below each sphere */
function SphereLabel({ position, label, color }) {
  return (
    <Html
      position={[position[0], position[1] - 0.9, position[2]]}
      center
      distanceFactor={10}
      zIndexRange={[1, 0]}
      style={{ pointerEvents: "none" }}
    >
      <span
        className="text-xs font-medium whitespace-nowrap select-none"
        style={{ color, textShadow: `0 0 10px ${color}` }}
      >
        {label}
      </span>
    </Html>
  );
}

const LERP_FACTOR = 0.038;
/** Power > 1 pulls toward dominant bias; kept moderate so user node cannot overlap agent nodes */
const WEIGHT_POWER = 1.75;
/** Limit how far toward corners the center can go (0–1); keeps user ball away from overlapping agents */
const MAX_PULL_RATIO = 0.62;
/** During a turn, pull the ball slightly toward the node that is currently speaking */
const SPEAKER_PULL = 0.1;

/** Center node: drifts to score-based position between rounds and at end; drifts a little toward current speaker during turns */
function DecisionCenter({ scores, centerPos, setCenterPos, isDebating, currentSpeaker }) {
  const currentRef = useRef(new THREE.Vector3(centerPos[0], centerPos[1], centerPos[2]));

  useFrame(() => {
    const total = BIAS_AGENT_KEYS.reduce((s, k) => s + (scores[k] || 0), 0) || 100;
    const weights = BIAS_AGENT_KEYS.map((k) =>
      Math.pow((scores[k] || 0) / total, WEIGHT_POWER)
    );
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;
    let x = 0, y = 0, z = 0;
    BIAS_AGENT_KEYS.forEach((key, i) => {
      const w = weights[i] / sumW;
      const p = SPHERE_POSITIONS[key];
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
    });
    const target = new THREE.Vector3(x, y, z);
    const len = target.length();
    if (len > 0.001) {
      const maxLen = Math.max(...BIAS_AGENT_KEYS.map((k) => new THREE.Vector3(...SPHERE_POSITIONS[k]).length()));
      target.normalize().multiplyScalar(Math.min(len, maxLen * MAX_PULL_RATIO));
    }
    // While someone is speaking, nudge target toward that node so the ball drifts a little in their direction
    if (isDebating && currentSpeaker && SPHERE_POSITIONS[currentSpeaker]) {
      const speakerPos = new THREE.Vector3(...SPHERE_POSITIONS[currentSpeaker]);
      target.lerp(speakerPos, SPEAKER_PULL);
    }
    currentRef.current.lerp(target, LERP_FACTOR);
    setCenterPos([currentRef.current.x, currentRef.current.y, currentRef.current.z]);
  });

  return (
    <>
      <AgentSphere
        position={centerPos}
        color="#E2E8F0"
        score={50}
        isDominant={false}
        isDebating={isDebating}
        isSpeaking={false}
        agentName="user"
        radius={0.42}
      />
      <SphereLabel position={centerPos} label="You" color="#E2E8F0" />
    </>
  );
}

/** The Three.js scene with all spheres and connections */
function Scene({
  scores,
  dominantAgent,
  currentSpeaker,
  isDebating,
  activeTurn,
  onCloseBubble,
  onNextBubble,
  onPrevBubble,
  hasNextBubble,
  hasPrevBubble,
}) {
  const orbitRef = useRef();
  const [centerPos, setCenterPos] = useState([0, 0, 0]);

  // Positions for connection lines: moving center first, then the four bias corners
  const linePositions = useMemo(
    () => [
      centerPos,
      SPHERE_POSITIONS.loss_aversion,
      SPHERE_POSITIONS.sunk_cost,
      SPHERE_POSITIONS.optimism_bias,
      SPHERE_POSITIONS.status_quo,
    ],
    [centerPos]
  );

  // Compute the camera target position (the sphere the bubble is on)
  const cameraTarget = activeTurn ? SPHERE_POSITIONS[activeTurn.agent] || null : null;

  return (
    <>
      {/* Background */}
      <color attach="background" args={['#111118']} />

      {/* Camera controller — lerps camera toward the active speaker */}
      <CameraController
        targetPosition={cameraTarget}
        orbitRef={orbitRef}
        defaultPosition={[0, 0, 10]}
        offset={[0, 2.5, 9]}
        damping={0.08}
      />

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={0.9}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
      <pointLight position={[-10, -10, -5]} intensity={0.3} color="#A855F7" />

      {/* Aurora ground plane */}
      <AuroraFloor y={-4.5} />

      {/* Connection lines: center first (moves with scores), then bias corners */}
      <ConnectionLines positions={linePositions} />

      {/* Center node — drifts to score-based spot between rounds and at end; drifts slightly toward current speaker during turns */}
      <DecisionCenter
        scores={scores}
        centerPos={centerPos}
        setCenterPos={setCenterPos}
        isDebating={isDebating}
        currentSpeaker={currentSpeaker}
      />

      {/* Bias agent spheres + chat bubble on active speaker */}
      {["loss_aversion", "sunk_cost", "optimism_bias", "status_quo"].map(
        (agent) => {
          const isActiveBubble = activeTurn?.agent === agent;
          return (
            <group key={agent}>
              <AgentSphere
                position={SPHERE_POSITIONS[agent]}
                color={AGENT_COLORS[agent]}
                score={scores[agent] || 25}
                isDominant={dominantAgent === agent}
                isDebating={isDebating}
                isSpeaking={currentSpeaker === agent}
                agentName={agent}
              />
              <SphereLabel
                position={SPHERE_POSITIONS[agent]}
                label={AGENT_DISPLAY_NAMES[agent]}
                color={AGENT_COLORS[agent]}
              />
              {/* Chat bubble — only rendered on the active agent */}
              {isActiveBubble && (
                <ChatBubble
                  position={SPHERE_POSITIONS[agent]}
                  agentName={AGENT_DISPLAY_NAMES[agent]}
                  color={AGENT_COLORS[agent]}
                  text={activeTurn.text}
                  summary={activeTurn.summary}
                  roundNum={activeTurn.round}
                  onClose={onCloseBubble}
                  onNext={onNextBubble}
                  onPrev={onPrevBubble}
                  hasNext={hasNextBubble}
                  hasPrev={hasPrevBubble}
                  visible={true}
                />
              )}
            </group>
          );
        }
      )}

      <OrbitControls
        ref={orbitRef}
        enableZoom={false}
        enablePan={false}
        autoRotate={!activeTurn}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

/** Down-arrow icon SVG */
function ChevronDown() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function MainWindow() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hasStartedRef = useRef(false);

  const { dilemma, primaryConcern } = location.state || {};

  const {
    rounds,
    scores,
    dominantAgent,
    currentSpeaker,
    isDebating,
    finalResult,
    error,
    startDebate,
    stopDebate,
    dialogueQueue,
    activeDialogueIndex,
    advanceDialogue,
    retreatDialogue,
    closeDialogue,
    goToDialogue,
  } = useDebateStream();

  // Compute the active dialogue turn
  const activeTurn =
    activeDialogueIndex != null ? dialogueQueue[activeDialogueIndex] || null : null;
  const hasNextBubble =
    activeDialogueIndex != null && activeDialogueIndex < dialogueQueue.length - 1;
  const hasPrevBubble =
    activeDialogueIndex != null && activeDialogueIndex > 0;

  // Auto-start the debate when the component mounts with a dilemma
  // Use a ref to prevent double-calling in Strict Mode
  useEffect(() => {
    if (dilemma && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startDebate(dilemma, primaryConcern);
    }
    return () => stopDebate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close the last debate bubble after 3 seconds
  useEffect(() => {
    if (!activeTurn || hasNextBubble) return;
    const t = setTimeout(() => {
      closeDialogue();
    }, 3000);
    return () => clearTimeout(t);
  }, [activeTurn, hasNextBubble, closeDialogue]);

  return (
    <div className="relative w-full h-screen bg-[#111118] overflow-hidden">
      {/* Re-Prompt button — top-right */}
      <button
        onClick={() => navigate("/")}
        className="!absolute top-5 right-5 z-50
                   px-5 py-2 rounded-full
                   glass glass-texture
                   text-white/80 text-sm font-medium
                   hover:bg-white/[0.12] hover:border-white/25
                   transition-all duration-300 cursor-pointer"
      >
        Re-Prompt
      </button>

      {/* Full-screen Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 10], fov: 45 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene
          scores={scores}
          dominantAgent={dominantAgent}
          currentSpeaker={currentSpeaker}
          isDebating={isDebating}
          activeTurn={activeTurn}
          onCloseBubble={closeDialogue}
          onNextBubble={advanceDialogue}
          onPrevBubble={retreatDialogue}
          hasNextBubble={hasNextBubble}
          hasPrevBubble={hasPrevBubble}
        />
      </Canvas>

      {/* Chat Button — visible when chat is closed */}
      <AnimatePresence>
        {!isChatOpen && (
          <div className="absolute bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsChatOpen(true)}
              className="pointer-events-auto
                         px-8 py-3 rounded-full
                         glass glass-texture
                         text-white/80 text-sm font-medium
                         hover:bg-white/[0.12] hover:border-white/25
                         transition-colors duration-300 cursor-pointer"
            >
              Chat
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Glassy Chat Overlay — open or collapsed only */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            key="chat-panel"
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50
                       glass-strong glass-texture
                       rounded-t-2xl
                       flex flex-col"
            style={{ position: "absolute", height: "50vh" }}
          >
            {/* Down arrow to close */}
            <div className="flex items-center justify-center w-full py-2">
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white/20 hover:text-white/80 transition-colors cursor-pointer"
                aria-label="Close chat"
              >
                <ChevronDown />
              </button>
            </div>

            {/* Chat header */}
            <div className="px-6 pb-2 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/60">
                Debate Stream
              </h3>
            </div>

            {/* Debate stream content — stopPropagation prevents drag="y" from swallowing clicks */}
            <div
              className="flex-1 overflow-y-auto"
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              <DebateStream
                rounds={rounds}
                finalResult={finalResult}
                currentSpeaker={currentSpeaker}
                error={error}
                onDialogueClick={goToDialogue}
                activeDialogueIndex={activeDialogueIndex}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final results panel — right side of display, shown after the last debate popup closes */}
      <AnimatePresence>
        {finalResult && !isDebating && activeTurn == null && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed right-8 top-1/2 -translate-y-1/2 z-40 w-[300px] rounded-2xl overflow-hidden
                       glass-strong glass-texture
                       border border-white/[0.1]"
          >
            <div className="px-4 py-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-semibold text-white/80 tracking-tight">
                Final result
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-1">
                  Dominant bias
                </p>
                <p
                  className="text-base font-bold"
                  style={{ color: AGENT_COLORS[finalResult.dominant_bias] || "#E2E8F0" }}
                >
                  {AGENT_DISPLAY_NAMES[finalResult.dominant_bias] || finalResult.dominant_bias}
                  <span className="text-white/50 text-sm font-normal ml-1.5">
                    {finalResult.dominance_percentage}%
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-2">
                  Weightages
                </p>
                <div className="space-y-1.5">
                  {BIAS_AGENT_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: AGENT_COLORS[key] }}
                        />
                        <span className="text-xs text-white/75">
                          {AGENT_DISPLAY_NAMES[key]}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-white/85 tabular-nums">
                        {scores[key] ?? 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {finalResult.bias_corrected_recommendation && (
                <div className="pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-semibold mb-1">
                    Recommendation
                  </p>
                  <p className="text-xs text-white/65 leading-relaxed">
                    {finalResult.bias_corrected_recommendation}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help button + panel — bottom-left */}
      <HelpPanel />
    </div>
  );
}
