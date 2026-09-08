import type { Format, Language, Tone, TargetDuration, Project } from "@/lib/types";

export interface CreateOptions {
  topic: string;
  format: Format;
  targetDuration: TargetDuration;
  tone: Tone;
  language: Language;
  voice: string;
}

export const DEFAULT_OPTIONS: CreateOptions = {
  topic: "",
  format: "portrait",
  targetDuration: 30,
  tone: "energetic",
  language: "en",
  voice: "en-US-JennyNeural",
};

export type WizardStep = "topic" | "options" | "script" | "render" | "preview";

export interface WizardState {
  step: WizardStep;
  options: CreateOptions;
  project: Project | null;
  renderId: string | null;
  downloadUrl: string | null;
}
