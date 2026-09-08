import type { ReactElement } from "react";
import type { CaptionStyle } from "../templates/types.js";
import { ClassicBar, type CaptionStyleProps } from "./ClassicBar.js";
import { WordPop } from "./WordPop.js";
import { KaraokeFill } from "./KaraokeFill.js";

export type { CaptionStyleProps };
export { getActiveWordIndex, getActiveLine, wordFillProgress } from "./timing.js";
export { TOP_SAFE_PCT, BOTTOM_SAFE_PCT } from "./SafeZone.js";

const CAPTION_COMPONENTS: Record<CaptionStyle, (props: CaptionStyleProps) => ReactElement | null> = {
  classicBar: ClassicBar,
  wordPop: WordPop,
  karaokeFill: KaraokeFill,
};

export function Captions(props: CaptionStyleProps & { style: CaptionStyle }) {
  const Component = CAPTION_COMPONENTS[props.style];
  return <Component {...props} />;
}
