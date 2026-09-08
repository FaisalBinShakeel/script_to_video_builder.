import type { Template } from "./types.js";
import type { TemplateName } from "../types.js";

/**
 * A template is a config object, not a separate component tree: every
 * composition renders the same way and just reads a different Template.
 * File names below are resolved against assets/sfx/ at mix time; the actual
 * audio files are supplied separately (see assets/sfx/README.md).
 */
export const TEMPLATES: Record<TemplateName, Template> = {
  energetic: {
    name: "energetic",
    transition: "slide",
    textAnimation: "pop",
    captionStyle: "wordPop",
    sfxMap: {
      sceneTransition: ["whoosh-1.mp3", "whoosh-2.mp3", "whoosh-3.mp3"],
      textAppear: ["pop-1.mp3", "pop-2.mp3"],
      hook: ["impact-1.mp3", "impact-2.mp3"],
      finalScene: ["resolve-1.mp3"],
    },
  },
  professional: {
    name: "professional",
    transition: "fade",
    textAnimation: "fade",
    captionStyle: "classicBar",
    sfxMap: {
      sceneTransition: ["whoosh-soft-1.mp3", "whoosh-soft-2.mp3"],
      textAppear: ["pop-soft-1.mp3"],
      hook: ["impact-soft-1.mp3"],
      finalScene: ["resolve-soft-1.mp3"],
    },
  },
  calm: {
    name: "calm",
    transition: "fade",
    textAnimation: "slideUp",
    captionStyle: "karaokeFill",
    sfxMap: {
      sceneTransition: ["whisper-1.mp3", "whisper-2.mp3"],
      textAppear: ["chime-1.mp3"],
      hook: ["chime-2.mp3"],
      finalScene: ["chime-3.mp3"],
    },
  },
};

export function getTemplate(name: TemplateName): Template {
  return TEMPLATES[name];
}
