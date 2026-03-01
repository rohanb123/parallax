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

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import AgentSphere from "./AgentSphere";
import ConnectionLines from "./ConnectionLines";
import AuroraFloor from "./AuroraFloor";
import DebateStream from "./DebateStream";
import ChatBubble from "./ChatBubble";
import CameraController from "../hooks/useCameraControl";
import HelpPanel from "./HelpPanel";
import { useDebateStream } from "../hooks/useDebateStream";
import { AGENT_COLORS, AGENT_DISPLAY_NAMES } from "../utils/agentColors";

// Tetrahedral (triangular pyramid) vertex positions — user in center
const R = 3;
const SPHERE_POSITIONS = {
  user: [0, 0, 0],
  loss_aversion: [0, R, 0],                                                // apex
  sunk_cost: [0, -R / 3, (2 * R * Math.SQRT2) / 3],                       // front
  optimism_bias: [(R * Math.sqrt(6)) / 3, -R / 3, -(R * Math.SQRT2) / 3], // back-right
  status_quo: [-(R * Math.sqrt(6)) / 3, -R / 3, -(R * Math.SQRT2) / 3],   // back-left
};

// All positions array for ConnectionLines (user first, then biases)
const ALL_POSITIONS = [
  SPHERE_POSITIONS.user,
  SPHERE_POSITIONS.loss_aversion,
  SPHERE_POSITIONS.sunk_cost,
  SPHERE_POSITIONS.optimism_bias,
  SPHERE_POSITIONS.status_quo,
];

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

      {/* Connection lines between all spheres */}
      <ConnectionLines positions={ALL_POSITIONS} />

      {/* User center ball */}
      <AgentSphere
        position={SPHERE_POSITIONS.user}
        color="#E2E8F0"
        score={50}
        isDominant={false}
        isDebating={isDebating}
        isSpeaking={false}
        agentName="user"
      />
      <SphereLabel
        position={SPHERE_POSITIONS.user}
        label="You"
        color="#E2E8F0"
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
  const [chatSize, setChatSize] = useState("large"); // "small" = 25vh, "large" = 75vh
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

  // Auto-open the chat panel when the first round arrives
  useEffect(() => {
    if (rounds.length === 1 && !isChatOpen) {
      setChatSize("small");
      setIsChatOpen(true);
    }
  }, [rounds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-screen bg-[#111118] overflow-hidden">
      {/* Re-Prompt button — top-left */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-5 left-5 z-50
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

      {/* Glassy Chat Overlay — slides up from bottom, draggable, snaps to 25vh / 75vh */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            key="chat-panel"
            initial={{ y: "100%" }}
            animate={{ y: "0%", height: chatSize === "large" ? "75vh" : "25vh" }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={(_e, info) => {
              const draggedDown = info.offset.y > 0;
              const distance = Math.abs(info.offset.y);

              if (draggedDown && distance > 60) {
                if (chatSize === "large") {
                  // Large → snap to small
                  setChatSize("small");
                } else {
                  // Small → close
                  setIsChatOpen(false);
                  setChatSize("large");
                }
              } else if (!draggedDown && distance > 60) {
                if (chatSize === "small") {
                  // Small → snap to large
                  setChatSize("large");
                }
              }
            }}
            className="absolute bottom-0 left-0 right-0 z-50
                       glass-strong glass-texture
                       rounded-t-2xl
                       flex flex-col"
            style={{ position: 'absolute', touchAction: 'none' }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center w-full pt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Up arrow to expand (25% only) / Down arrow to close */}
            <div className="flex items-center justify-center w-full py-2 gap-3">
              {chatSize === "small" && (
                <button
                  onClick={() => setChatSize("large")}
                  className="text-white/20 hover:text-white/80 transition-colors cursor-pointer rotate-180"
                >
                  <ChevronDown />
                </button>
              )}
              <button
                onClick={() => {
                  if (chatSize === "large") {
                    setChatSize("small");
                  } else {
                    setIsChatOpen(false);
                    setChatSize("large");
                  }
                }}
                className="text-white/20 hover:text-white/80 transition-colors cursor-pointer"
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

      {/* Help button + panel — bottom-left */}
      <HelpPanel />
    </div>
  );
}
