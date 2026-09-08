import { Composition, registerRoot } from "remotion";
import { SocialVideo } from "./compositions/SocialVideo.js";
import { FORMAT_DIMENSIONS, FPS, totalDurationMs, msToFrames } from "./types.js";
import type { RenderVideoProps } from "./types.js";
import { sampleProps } from "./fixtures/sample-props.js";

function RemotionRoot() {
  return (
    <>
      <Composition
        id="SocialVideo"
        component={SocialVideo}
        durationInFrames={msToFrames(totalDurationMs(sampleProps.scenes))}
        fps={FPS}
        width={FORMAT_DIMENSIONS[sampleProps.format].width}
        height={FORMAT_DIMENSIONS[sampleProps.format].height}
        defaultProps={sampleProps}
        calculateMetadata={({ props }) => {
          const p = props as RenderVideoProps;
          const dims = FORMAT_DIMENSIONS[p.format];
          return {
            durationInFrames: Math.max(1, msToFrames(totalDurationMs(p.scenes))),
            width: dims.width,
            height: dims.height,
            fps: FPS,
          };
        }}
      />
    </>
  );
}

registerRoot(RemotionRoot);
