/**
 * PyramidSpace — Depth: Layer 1 bg, Layer 2 canvas, Layer 3 glass panels, Layer 4 typography.
 * No global blur. Glass panels float above 3D. Help panel replaces hover tooltips.
 */

import { useState, useRef, useEffect } from "react";
const EASE = [0.25, 0.46, 0.45, 0.94];
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import PyramidScene from "./PyramidScene";
import ChatOverlay from "./ChatOverlay";
import HelpPanel from "./HelpPanel";

const PULSE_DECAY_MS = 1600;

function useSpeakingPulse(rounds) {
  const [pulse, setPulse] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState(null);
  const decayRef = useRef(null);

  useEffect(() => {
    if (!rounds?.length) return;
    const lastRound = rounds[rounds.length - 1];
    const dialogue = lastRound?.dialogue;
    if (dialogue?.length) {
      const lastTurn = dialogue[dialogue.length - 1];
      if (lastTurn?.agent) {
        setSpeakingAgent(lastTurn.agent);
        setPulse(1);
        if (decayRef.current) cancelAnimationFrame(decayRef.current);
        const start = performance.now();
        const tick = () => {
          const elapsed = performance.now() - start;
          const t = Math.max(0, 1 - elapsed / PULSE_DECAY_MS);
          setPulse(t);
          if (t > 0) decayRef.current = requestAnimationFrame(tick);
        };
        decayRef.current = requestAnimationFrame(tick);
      }
    }
  }, [rounds?.length]);

  return { speakingAgent, pulse };
}

export default function PyramidSpace({
  rounds,
  scores = {},
  dominantAgent,
  isDebating,
  onNewChat,
  calibration = {},
  finalResult,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const { speakingAgent, pulse } = useSpeakingPulse(rounds ?? []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Layer 1: Space background */}
      <div
        className="absolute inset-0 z-0 bg-[#0B0F14] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/pyramid-bg.jpg')",
          backgroundColor: "#0B0F14",
        }}
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(to bottom, rgba(11,15,20,0.42) 0%, rgba(11,15,20,0.78) 50%, rgba(11,15,20,0.94) 100%)",
        }}
      />
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(11,15,20,0.25) 100%)",
        }}
      />

      {/* Layer 2: Canvas */}
      <div className="absolute inset-0 z-10">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <PyramidScene
            scores={scores}
            dominantAgent={dominantAgent}
            speakingAgent={speakingAgent}
            pulse={pulse}
          />
        </Canvas>
      </div>

      {/* Layer 4: Typography */}
      <div className="absolute top-4 left-4 z-40">
        <h1 className="brand-glass text-lg font-medium tracking-tight">
          Parallax
        </h1>
      </div>

      <div className="absolute top-4 right-4 z-40">
        <motion.button
          type="button"
          onClick={onNewChat}
          transition={{ duration: 0.3, ease: EASE }}
          className="glass-button rounded-xl px-4 py-2 text-sm font-medium text-white/88"
        >
          New Chat
        </motion.button>
      </div>

      {!chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="absolute bottom-8 right-8 z-40 md:right-10"
        >
          <motion.button
            type="button"
            onClick={() => setChatOpen(true)}
            className="glass-button flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white/88"
          >
            <span>💬</span>
            Chat
          </motion.button>
        </motion.div>
      )}

      <ChatOverlay
        rounds={rounds}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        finalResult={finalResult}
      />

      {/* Help panel — fixed bottom-left */}
      <HelpPanel />
    </div>
  );
}
