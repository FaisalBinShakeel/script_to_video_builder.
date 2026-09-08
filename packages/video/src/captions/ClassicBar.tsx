import { getActiveLine } from "./timing.js";
import { BOTTOM_SAFE_PCT } from "./SafeZone.js";
import type { CaptionWord } from "../types.js";

export interface CaptionStyleProps {
  words: CaptionWord[];
  currentMs: number;
  accentColor: string;
}

const MAX_WORDS_PER_LINE = 7;

/** A solid bar near the bottom (outside the safe zone) showing the full
 * current line, with the active word highlighted in the template's accent
 * color. */
export function ClassicBar({ words, currentMs, accentColor }: CaptionStyleProps) {
  const line = getActiveLine(words, currentMs, MAX_WORDS_PER_LINE);
  if (!line || line.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        bottom: `${BOTTOM_SAFE_PCT + 2}%`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.6)",
          borderRadius: 12,
          padding: "14px 24px",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 44,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.3,
          color: "white",
        }}
      >
        {line.map((word, i) => {
          const active = currentMs >= word.startMs && currentMs < word.endMs;
          return (
            <span
              key={`${word.text}-${i}`}
              style={{ color: active ? accentColor : "white", marginRight: 10 }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
