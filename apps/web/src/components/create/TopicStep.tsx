"use client";

import { useState } from "react";

export function TopicStep({
  topic,
  onNext,
}: {
  topic: string;
  onNext: (topic: string) => void;
}) {
  const [value, setValue] = useState(topic);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        What&apos;s the video about?
      </h1>
      <p className="mb-6 text-sm text-white/50">
        A topic, a headline, or a rough script idea. We&apos;ll turn it into a scene-by-scene script.
      </p>

      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="5 benefits of green tea"
        className="w-full resize-none rounded-xl border border-surface-border bg-surface-raised px-4 py-3.5 text-base outline-none focus:border-accent"
      />

      <button
        onClick={() => value.trim() && onNext(value.trim())}
        disabled={!value.trim()}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40 sm:w-auto sm:px-8"
      >
        Continue
      </button>
    </div>
  );
}
