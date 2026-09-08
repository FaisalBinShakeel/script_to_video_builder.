import { getActiveLine, wordFillProgress } from "./timing.js";
import { BOTTOM_SAFE_PCT } from "./SafeZone.js";
import type { CaptionStyleProps } from "./ClassicBar.js";

const MAX_WORDS_PER_LINE = 6;

/** Renders the current line in a neutral color with a left-to-right color
 * wipe per word, classic karaoke-style, driven by word timings. */
export function KaraokeFill({ words, currentMs, accentColor }: CaptionStyleProps) {
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
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 46,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {line.map((word, i) => {
          const progress = wordFillProgress(word, currentMs);
          return (
            <span
              key={`${word.text}-${i}`}
              style={{
                marginRight: 10,
                backgroundImage: `linear-gradient(to right, ${accentColor} ${
                  progress * 100
                }%, white ${progress * 100}%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
