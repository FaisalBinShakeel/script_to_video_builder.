"use client";

import { useState } from "react";
import type { Format, Language, Tone, TargetDuration } from "@/lib/types";
import { VOICE_OPTIONS } from "@/lib/types";
import type { CreateOptions } from "./types";

const FORMATS: { id: Format; label: string; ratio: string }[] = [
  { id: "portrait", label: "Portrait", ratio: "9:16" },
  { id: "square", label: "Square", ratio: "1:1" },
  { id: "landscape", label: "Landscape", ratio: "16:9" },
];

const DURATIONS: TargetDuration[] = [15, 30, 45, 60];

const TONES: Tone[] = ["energetic", "professional", "calm", "story"];

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ur", label: "Urdu" },
];

function previewVoice(voiceId: string, language: Language) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(
    language === "ur" ? "یہ آپ کی آواز کا نمونہ ہے" : "This is a preview of your video's voice",
  );
  utterance.lang = language === "ur" ? "ur-PK" : "en-US";
  const match = window.speechSynthesis
    .getVoices()
    .find((v) => v.name.toLowerCase().includes(voiceId.split("-")[2]?.replace("Neural", "").toLowerCase() ?? ""));
  if (match) utterance.voice = match;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function OptionsStep({
  initial,
  onBack,
  onNext,
}: {
  initial: CreateOptions;
  onBack: () => void;
  onNext: (options: CreateOptions) => void;
}) {
  const [format, setFormat] = useState(initial.format);
  const [targetDuration, setTargetDuration] = useState(initial.targetDuration);
  const [tone, setTone] = useState(initial.tone);
  const [language, setLanguage] = useState(initial.language);
  const [voice, setVoice] = useState(initial.voice);

  const voicesForLanguage = VOICE_OPTIONS.filter((v) => v.language === language);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pick a style</h1>
      <p className="mb-8 text-sm text-white/50">This shapes pacing, visuals, and voice.</p>

      <div className="flex flex-col gap-8">
        <div>
          <p className="mb-2.5 text-xs font-medium text-white/60">Format</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`rounded-xl border px-3 py-3 text-center transition ${
                  format === f.id
                    ? "border-accent bg-accent/10"
                    : "border-surface-border bg-surface-raised hover:border-white/20"
                }`}
              >
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-white/40">{f.ratio}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium text-white/60">Length</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setTargetDuration(d)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  targetDuration === d
                    ? "border-accent bg-accent/10"
                    : "border-surface-border bg-surface-raised hover:border-white/20"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium text-white/60">Tone</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition ${
                  tone === t
                    ? "border-accent bg-accent/10"
                    : "border-surface-border bg-surface-raised hover:border-white/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium text-white/60">Language</p>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setLanguage(l.id);
                  const first = VOICE_OPTIONS.find((v) => v.language === l.id);
                  if (first) setVoice(first.id);
                }}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  language === l.id
                    ? "border-accent bg-accent/10"
                    : "border-surface-border bg-surface-raised hover:border-white/20"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium text-white/60">Voice</p>
          <div className="flex flex-col gap-2">
            {voicesForLanguage.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  voice === v.id
                    ? "border-accent bg-accent/10"
                    : "border-surface-border bg-surface-raised"
                }`}
              >
                <button onClick={() => setVoice(v.id)} className="text-left text-sm">
                  {v.label}
                </button>
                <button
                  onClick={() => previewVoice(v.id, language)}
                  className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/30"
                >
                  Preview
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-surface-border px-5 py-3 text-sm font-medium text-white/70 hover:border-white/30"
        >
          Back
        </button>
        <button
          onClick={() => onNext({ topic: initial.topic, format, targetDuration, tone, language, voice })}
          className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover sm:flex-none sm:px-8"
        >
          Generate script
        </button>
      </div>
    </div>
  );
}
