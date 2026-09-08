import { AbsoluteFill, Loop, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";
import type { SceneFootage } from "@video-builder/core";
import { FPS } from "../types.js";

export interface BackgroundProps {
  footage: SceneFootage;
  durationInFrames: number;
}

const KEN_BURNS_START_SCALE = 1.0;
const KEN_BURNS_END_SCALE = 1.05;

function useKenBurnsScale(durationInFrames: number): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, durationInFrames], [KEN_BURNS_START_SCALE, KEN_BURNS_END_SCALE], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Cheap deterministic hash so the same scene always gets the same gradient
 * angle/hue, instead of every gradient scene looking identical. */
function seedToHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

function GradientBackground({ seed, durationInFrames }: { seed: string; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const baseHue = seedToHue(seed);
  const angle = interpolate(frame, [0, durationInFrames], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + angle}deg, hsl(${baseHue},70%,35%) 0%, hsl(${
          (baseHue + 60) % 360
        },70%,20%) 100%)`,
      }}
    />
  );
}

export function Background({ footage, durationInFrames }: BackgroundProps) {
  const scale = useKenBurnsScale(durationInFrames);

  if (footage.kind === "gradient") {
    return <GradientBackground seed={footage.seed} durationInFrames={durationInFrames} />;
  }

  const clipFrames = Math.round(footage.durationSec * FPS);
  const video = (
    <OffthreadVideo
      src={footage.fileUrl}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `scale(${scale})`,
      }}
      muted
    />
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {clipFrames < durationInFrames ? (
        <Loop durationInFrames={Math.max(clipFrames, 1)}>{video}</Loop>
      ) : (
        video
      )}
    </AbsoluteFill>
  );
}
