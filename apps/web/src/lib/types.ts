export type Format = "portrait" | "square" | "landscape";
export type Tone = "energetic" | "professional" | "calm" | "story";
export type Language = "en" | "ur";
export type MusicMood = "upbeat" | "ambient" | "cinematic" | "corporate";
export type Emphasis = "hook" | "normal" | "cta";
export type TargetDuration = 15 | 30 | 45 | 60;

export interface Scene {
  id: number;
  narration: string;
  onScreenText: string;
  searchKeywords: string[];
  duration: number;
  emphasis: Emphasis;
}

export interface VideoScript {
  title: string;
  language: Language;
  tone: Tone;
  musicMood: MusicMood;
  scenes: Scene[];
  estimatedDuration: number;
}

export interface Project {
  id: string;
  userId: string;
  brandKitId: string | null;
  title: string;
  topic: string;
  format: Format;
  language: Language;
  tone: Tone;
  musicMood: MusicMood;
  status: string;
  scriptJson: VideoScript | null;
  createdAt: string;
  updatedAt: string;
}

export type RenderStatus = "queued" | "running" | "succeeded" | "failed";

export interface Render {
  id: string;
  projectId: string;
  userId: string;
  status: RenderStatus;
  stage: string | null;
  percent: number;
  outputUrl: string | null;
  errorMessage: string | null;
  costCents: number | null;
  durationMs: number | null;
  creditsCharged: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  credits: number;
}

export interface BrandKit {
  id: string;
  userId: string;
  name: string;
  primaryColor: string | null;
  accentColor: string | null;
  font: string | null;
  logoUrl: string | null;
  watermarkEnabled: boolean;
}

export const VOICE_OPTIONS: { id: string; label: string; language: Language }[] = [
  { id: "en-US-JennyNeural", label: "Jenny (US English, warm)", language: "en" },
  { id: "en-US-GuyNeural", label: "Guy (US English, energetic)", language: "en" },
  { id: "en-GB-SoniaNeural", label: "Sonia (British English)", language: "en" },
  { id: "ur-PK-UzmaNeural", label: "Uzma (Urdu)", language: "ur" },
  { id: "ur-PK-AsadNeural", label: "Asad (Urdu)", language: "ur" },
];
