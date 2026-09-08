import { AbsoluteFill, Sequence } from "remotion";
import { Scene } from "./Scene.js";
import { Watermark } from "./Watermark.js";
import { getTemplate } from "../templates/index.js";
import { msToFrames, type RenderVideoProps } from "../types.js";

export function SocialVideo(props: RenderVideoProps) {
  const template = getTemplate(props.template);

  let cursorFrame = 0;
  const sequences = props.scenes.map((sceneInput, i) => {
    const durationInFrames = msToFrames(sceneInput.audio.durationMs);
    const from = cursorFrame;
    cursorFrame += durationInFrames;

    return (
      <Sequence key={sceneInput.scene.id} from={from} durationInFrames={durationInFrames}>
        <Scene
          input={sceneInput}
          durationInFrames={durationInFrames}
          template={template}
          isFirst={i === 0}
          isLast={i === props.scenes.length - 1}
        />
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {sequences}
      {props.watermark ? <Watermark /> : null}
    </AbsoluteFill>
  );
}
