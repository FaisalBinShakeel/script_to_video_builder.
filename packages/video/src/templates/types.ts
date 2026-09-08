export type TransitionStyle = "cut" | "fade" | "slide";
export type TextAnimationStyle = "fade" | "pop" | "slideUp";
export type CaptionStyle = "classicBar" | "wordPop" | "karaokeFill";

export type SfxEventName = "sceneTransition" | "textAppear" | "hook" | "finalScene";

export type SfxMap = Record<SfxEventName, string[]>;

export interface Template {
  name: "energetic" | "professional" | "calm";
  transition: TransitionStyle;
  textAnimation: TextAnimationStyle;
  captionStyle: CaptionStyle;
  sfxMap: SfxMap;
}
