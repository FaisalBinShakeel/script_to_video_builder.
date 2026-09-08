import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TOP_SAFE_PCT } from "../captions/SafeZone.js";
import type { TextAnimationStyle } from "../templates/types.js";

export interface OnScreenTextProps {
  text: string;
  animation: TextAnimationStyle;
  accentColor: string;
}

const ENTRY_DURATION_FRAMES = 15;

export function OnScreenText({ text, animation, accentColor }: OnScreenTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let translateY = 0;
  let scale = 1;

  if (animation === "fade") {
    opacity = interpolate(frame, [0, ENTRY_DURATION_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (animation === "slideUp") {
    const p = interpolate(frame, [0, ENTRY_DURATION_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    opacity = p;
    translateY = (1 - p) * 24;
  } else {
    const pop = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.5 } });
    opacity = Math.min(pop * 1.4, 1);
    scale = 0.85 + pop * 0.15;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: `${TOP_SAFE_PCT + 4}%`,
        left: "8%",
        right: "8%",
        textAlign: "center",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 52,
          fontWeight: 800,
          color: "white",
          textShadow: `0 2px 16px rgba(0,0,0,0.6)`,
          borderBottom: `4px solid ${accentColor}`,
          paddingBottom: 6,
        }}
      >
        {text}
      </span>
    </div>
  );
}
