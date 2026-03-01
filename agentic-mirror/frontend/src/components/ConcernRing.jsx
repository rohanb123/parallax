/**
 * ConcernRing — A swipeable ring selector for primary concern.
 *
 * Renders a tilted ellipse (ring seen from above at an angle) with 4 labels
 * placed around it. Drag/swipe rotates the ring; on release it snaps to the
 * nearest concern, centering it at the bottom (closest to viewer).
 *
 * Props:
 *   values   — [{ id, label }]  (array of 4 concerns)
 *   selected — currently selected id (or null)
 *   onChange — (id) => void
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useSpring, animate } from "framer-motion";

// Layout constants
const RING_WIDTH = 320;         // ellipse X radius in px
const RING_HEIGHT = 80;         // ellipse Y radius — foreshortened for tilt
const LABEL_OFFSET_Y = -12;     // nudge labels outward from ring edge

/**
 * Return the (x, y) position on the tilted ellipse for a given angle (radians).
 * 0 = bottom-center (closest to viewer).
 * `spread` controls how far labels fan out (0 = all stacked, 1 = full ring).
 */
function ellipsePos(angle, spread = 1) {
  const a = angle * spread;
  return {
    x: Math.sin(a) * RING_WIDTH / 2,
    y: -Math.cos(a) * RING_HEIGHT / 2,
  };
}

/**
 * Map an angle to a "depth" factor (0 = back/far, 1 = front/near).
 * Used for scale + opacity to sell the 3D tilt illusion.
 */
function depthFactor(angle) {
  // cos(angle) = 1 at bottom (front), -1 at top (back)
  return 0.5 + 0.5 * Math.cos(angle);
}

/** Normalize angle into [-PI, PI) */
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export default function ConcernRing({ values = [], selected, onChange }) {
  const count = values.length;
  const sliceAngle = (Math.PI * 2) / count;

  // `rotation` is the ring's current angular offset in radians.
  // When rotation=0, index 0 is at the bottom (front-center).
  const rotation = useMotionValue(0);
  const smoothRotation = useSpring(rotation, { stiffness: 300, damping: 30 });

  // `spread` controls how far labels fan out (0 = all stacked, 1 = full ring).
  // Start at 1 so labels appear at their correct ring positions on load.
  const spread = useMotionValue(1);
  const smoothSpread = useSpring(spread, { stiffness: 200, damping: 25 });
  const hasInteracted = useRef(false);

  // Track drag state
  const containerRef = useRef(null);
  const dragStart = useRef(null);
  const rotationAtDragStart = useRef(0);
  const isDragging = useRef(false);
  const pointerIdRef = useRef(null);
  const DRAG_THRESHOLD = 5; // px of movement before entering drag mode

  /** Fan labels out to their ring positions */
  const fanOut = useCallback(() => {
    if (hasInteracted.current) return;
    hasInteracted.current = true;
    spread.set(1);
  }, [spread]);

  // Pointer handlers for drag
  const handlePointerDown = useCallback((e) => {
    // Don't capture yet — wait until drag threshold is exceeded
    // so label click events can still fire for quick taps
    pointerIdRef.current = e.pointerId;
    dragStart.current = { x: e.clientX, y: e.clientY };
    rotationAtDragStart.current = rotation.get();
    isDragging.current = false;
    fanOut();
  }, [rotation, fanOut]);

  const handlePointerMove = useCallback((e) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Only enter drag mode after exceeding threshold
    if (!isDragging.current) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      isDragging.current = true;
      // NOW capture the pointer so drag continues even outside the container
      try { e.currentTarget.setPointerCapture(pointerIdRef.current); } catch (_) {}
    }
    // Map horizontal drag pixels to rotation (negative = clockwise looks right)
    const dragSensitivity = 0.008;
    rotation.set(rotationAtDragStart.current + dx * dragSensitivity);
  }, [rotation]);

  /** Snap to the nearest concern and fire onChange */
  const snapToNearest = useCallback(() => {
    const current = rotation.get();
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const itemAngle = wrapAngle(current + i * sliceAngle);
      const dist = Math.abs(itemAngle);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const targetRotation = -bestIdx * sliceAngle;
    const diff = wrapAngle(targetRotation - current);
    const finalTarget = current + diff;

    animate(rotation, finalTarget, {
      type: "spring",
      stiffness: 400,
      damping: 35,
    });
    onChange?.(values[bestIdx].id);
  }, [rotation, count, sliceAngle, values, onChange]);

  const handlePointerUp = useCallback(() => {
    const wasDragging = isDragging.current;
    dragStart.current = null;
    isDragging.current = false;
    pointerIdRef.current = null;
    // Only snap-to-nearest after a real drag; clicks are handled by label onClick
    if (wasDragging) snapToNearest();
  }, [snapToNearest]);

  // Click to select a specific item
  const handleItemClick = useCallback((idx) => {
    fanOut();
    const current = rotation.get();
    const targetRotation = -idx * sliceAngle;
    const diff = wrapAngle(targetRotation - current);
    animate(rotation, current + diff, {
      type: "spring",
      stiffness: 400,
      damping: 35,
    });
    onChange?.(values[idx].id);
  }, [rotation, sliceAngle, values, onChange]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
        Primary Concern
      </span>

      {/* Ring container */}
      <div
        ref={containerRef}
        className="relative select-none cursor-grab active:cursor-grabbing"
        style={{ width: RING_WIDTH + 40, height: RING_HEIGHT * 2 + 60 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* The ring outline (SVG ellipse) */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={RING_WIDTH + 40}
          height={RING_HEIGHT * 2 + 60}
          viewBox={`0 0 ${RING_WIDTH + 40} ${RING_HEIGHT * 2 + 60}`}
        >
          <ellipse
            cx={(RING_WIDTH + 40) / 2}
            cy={(RING_HEIGHT * 2 + 60) / 2}
            rx={RING_WIDTH / 2}
            ry={RING_HEIGHT / 2}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        </svg>

        {/* Labels positioned around the ellipse */}
        {values.map((value, i) => (
          <ConcernLabel
            key={value.id}
            value={value}
            index={i}
            count={count}
            sliceAngle={sliceAngle}
            smoothRotation={smoothRotation}
            smoothSpread={smoothSpread}
            isSelected={selected === value.id}
            containerWidth={RING_WIDTH + 40}
            containerHeight={RING_HEIGHT * 2 + 60}
            onClick={() => handleItemClick(i)}
            isDraggingRef={isDragging}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual label that reads the spring-driven rotation via useMotionValue
 * and positions + scales itself each frame.
 */
function ConcernLabel({
  value,
  index,
  count,
  sliceAngle,
  smoothRotation,
  smoothSpread,
  isSelected,
  containerWidth,
  containerHeight,
  onClick,
  isDraggingRef,
}) {
  const labelRef = useRef(null);
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  // Subscribe to both motion values and update DOM directly (no re-renders)
  useEffect(() => {
    function update() {
      if (!labelRef.current) return;
      const rot = smoothRotation.get();
      const sp = smoothSpread.get();
      const angle = rot + index * sliceAngle;
      const pos = ellipsePos(angle, sp);
      const depth = depthFactor(angle * sp);

      const x = centerX + pos.x;
      const y = centerY + pos.y + LABEL_OFFSET_Y;
      // When spread is 0, all labels stack — keep them full opacity/scale
      const scale = sp < 0.01 ? 1 : 0.7 + depth * 0.5;
      const opacity = sp < 0.01 ? 0.7 : 0.25 + depth * 0.75;

      labelRef.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
      labelRef.current.style.opacity = opacity;
      labelRef.current.style.zIndex = Math.round(depth * 10);
    }

    const unsub1 = smoothRotation.on("change", update);
    const unsub2 = smoothSpread.on("change", update);
    // Initial position
    update();
    return () => { unsub1(); unsub2(); };
  }, [smoothRotation, smoothSpread, index, sliceAngle, centerX, centerY]);

  return (
    <div
      ref={labelRef}
      onClick={(e) => {
        e.stopPropagation();
        // Only handle click if we weren't dragging
        if (!isDraggingRef?.current) onClick();
      }}
      className={`
        absolute top-0 left-0
        px-4 py-2 rounded-lg
        text-sm font-medium font-mono
        whitespace-nowrap
        cursor-pointer
        transition-colors duration-200
        ${isSelected
          ? "text-white glass-subtle border-white/25"
          : "text-white/50 hover:text-white/70 hover:bg-white/[0.06]"
        }
      `}
      style={{ willChange: "transform, opacity" }}
    >
      {value.label}
    </div>
  );
}
