"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Project, Scene, VideoScript } from "@/lib/types";

const EMPHASIS_COLOR: Record<Scene["emphasis"], string> = {
  hook: "from-orange-500/40 to-rose-500/30",
  normal: "from-slate-500/30 to-slate-700/30",
  cta: "from-accent/40 to-purple-500/30",
};

function SceneCard({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (scene: Scene) => void;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`h-14 w-9 shrink-0 rounded-lg bg-gradient-to-br ${EMPHASIS_COLOR[scene.emphasis]}`}
          title="Placeholder -- the real clip is chosen during render"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/40">Scene {scene.id}</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
              {scene.emphasis}
            </span>
          </div>
        </div>
      </div>

      <label className="mb-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-white/50">Narration</span>
        <textarea
          value={scene.narration}
          onChange={(e) => onChange({ ...scene, narration: e.target.value })}
          rows={2}
          className="resize-none rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="mb-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-white/50">On-screen text</span>
        <input
          value={scene.onScreenText}
          onChange={(e) => onChange({ ...scene, onScreenText: e.target.value })}
          className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-white/50">Footage keywords</span>
        <input
          value={scene.searchKeywords.join(", ")}
          onChange={(e) =>
            onChange({ ...scene, searchKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
          }
          className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

export function ScriptStep({
  project,
  onBack,
  onNext,
}: {
  project: Project;
  onBack: () => void;
  onNext: () => void;
}) {
  const [script, setScript] = useState<VideoScript>(project.scriptJson!);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateScene(updated: Scene) {
    setScript((s) => ({ ...s, scenes: s.scenes.map((sc) => (sc.id === updated.id ? updated : sc)) }));
  }

  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/projects/${project.id}/script`, {
        method: "PATCH",
        body: JSON.stringify(script),
      });
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your edits");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight sm:text-3xl">{script.title}</h1>
      <p className="mb-6 text-sm text-white/50">
        Review and edit each scene. Footage matching the keywords is chosen during render.
      </p>

      <div className="flex flex-col gap-3">
        {script.scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} onChange={updateScene} />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-surface-border px-5 py-3 text-sm font-medium text-white/70 hover:border-white/30"
        >
          Back
        </button>
        <button
          onClick={saveAndContinue}
          disabled={saving}
          className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 sm:flex-none sm:px-8"
        >
          {saving ? "Saving..." : "Render video"}
        </button>
      </div>
    </div>
  );
}
