"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { API_URL } from "@/lib/config";
import type { Render } from "@/lib/types";

const STAGE_LABEL: Record<string, string> = {
  script: "Reading your script",
  footage: "Sourcing footage",
  voice: "Recording narration",
  compose: "Composing scenes",
  encode: "Encoding video",
  upload: "Uploading",
};

export function RenderStep({
  projectId,
  onDone,
  onBack,
}: {
  projectId: string;
  onDone: (result: { renderId: string; downloadUrl: string | null; error: string | null }) => void;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    let source: EventSource | undefined;

    (async () => {
      try {
        const render = await apiFetch<Render>(`/projects/${projectId}/render`, { method: "POST" });
        if (cancelled) return;

        source = new EventSource(`${API_URL}/renders/${render.id}/stream`, { withCredentials: true });

        source.addEventListener("progress", (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          setStage(data.stage);
          setPercent(data.percent);
        });

        source.addEventListener("done", (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          source?.close();
          if (data.status === "succeeded") {
            onDone({ renderId: render.id, downloadUrl: data.downloadUrl, error: null });
          } else {
            onDone({ renderId: render.id, downloadUrl: null, error: data.errorMessage ?? "Render failed" });
          }
        });

        source.addEventListener("error", () => {
          source?.close();
          setError("Lost connection to the render stream.");
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't start the render");
      }
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [projectId, onDone]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">Rendering your video</h1>
      <p className="mb-10 text-sm text-white/50">This usually takes a minute or two.</p>

      <div className="w-full max-w-sm">
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-white/60">
          {stage ? (STAGE_LABEL[stage] ?? stage) : "Starting..."} &middot; {percent}%
        </p>
      </div>

      {error && (
        <div className="mt-8">
          <p className="mb-4 text-sm text-red-400">{error}</p>
          <button
            onClick={onBack}
            className="rounded-lg border border-surface-border px-5 py-2.5 text-sm font-medium text-white/70 hover:border-white/30"
          >
            Back to script
          </button>
        </div>
      )}
    </div>
  );
}
