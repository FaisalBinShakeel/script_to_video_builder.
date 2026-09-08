import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Background } from "./Background.js";
import { OnScreenText } from "./OnScreenText.js";
import { Captions } from "../captions/index.js";
import type { RenderSceneInput } from "../types.js";
import type { Template } from "../templates/types.js";

const ACCENT_BY_TEMPLATE: Record<Template["name"], string> = {
  energetic: "#FF5C4D",
  professional: "#4D8DFF",
  calm: "#7CD9C4",
};

const TRANSITION_FRAMES = 10;

export interface SceneProps {
  input: RenderSceneInput;
  durationInFrames: number;
  template: Template;
  isFirst: boolean;
  isLast: boolean;
}

function useTransitionOpacity(
  transition: Template["transition"],
  durationInFrames: number,
  isFirst: boolean,
): number {
  const frame = useCurrentFrame();
  if (transition === "cut") return 1;

  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - TRANSITION_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(fadeIn, fadeOut);
}

function useSlideOffset(
  transition: Template["transition"],
  durationInFrames: number,
  isFirst: boolean,
): number {
  const frame = useCurrentFrame();
  if (transition !== "slide" || isFirst) return 0;
  return interpolate(frame, [0, TRANSITION_FRAMES], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function Scene({ input, durationInFrames, template, isFirst }: SceneProps) {
  const frame = useCurrentFrame();
  const currentMs = (frame / 30) * 1000;
  const accentColor = ACCENT_BY_TEMPLATE[template.name];

  const opacity = useTransitionOpacity(template.transition, durationInFrames, isFirst);
  const slideX = useSlideOffset(template.transition, durationInFrames, isFirst);

  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${slideX}px)` }}>
      <Background footage={input.footage} durationInFrames={durationInFrames} />
      <OnScreenText
        text={input.scene.onScreenText}
        animation={template.textAnimation}
        accentColor={accentColor}
      />
      <Captions
        style={template.captionStyle}
        words={input.audio.words}
        currentMs={currentMs}
        accentColor={accentColor}
      />
    </AbsoluteFill>
  );
}
