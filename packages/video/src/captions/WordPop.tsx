import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { getActiveWordIndex } from "./timing.js";
import { BOTTOM_SAFE_PCT } from "./SafeZone.js";
import type { CaptionStyleProps } from "./ClassicBar.js";

/** Shows only the current word, big and center-low, popping in with a
 * spring as it becomes active. */
export function WordPop({ words, currentMs, accentColor }: CaptionStyleProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const index = getActiveWordIndex(words, currentMs);
  if (index === -1) return null;
  const word = words[index];
  if (!word) return null;

  const wordStartFrame = Math.round((word.startMs / 1000) * fps);
  const pop = spring({
    frame: frame - wordStartFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });
  const scale = 0.7 + pop * 0.3;

  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        bottom: `${BOTTOM_SAFE_PCT + 4}%`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 64,
          fontWeight: 800,
          color: accentColor,
          textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          transform: `scale(${scale})`,
        }}
      >
        {word.text}
      </div>
    </div>
  );
}
