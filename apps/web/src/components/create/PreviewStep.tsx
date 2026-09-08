"use client";

export function PreviewStep({
  downloadUrl,
  onEditScenes,
  onRegenerate,
}: {
  downloadUrl: string;
  onEditScenes: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight sm:text-3xl">It&apos;s ready</h1>
      <p className="mb-8 text-sm text-white/50">Preview it below, then download or keep tweaking.</p>

      <video
        src={downloadUrl}
        controls
        className="mb-8 max-h-[70vh] w-full max-w-xs rounded-2xl border border-surface-border bg-black"
      />

      <div className="flex w-full max-w-xs flex-col gap-3">
        <a
          href={downloadUrl}
          className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          Download video
        </a>
        <button
          onClick={onEditScenes}
          className="rounded-lg border border-surface-border px-4 py-3 text-sm font-medium text-white/70 hover:border-white/30"
        >
          Edit scenes
        </button>
        <button
          onClick={onRegenerate}
          className="rounded-lg border border-surface-border px-4 py-3 text-sm font-medium text-white/70 hover:border-white/30"
        >
          Regenerate render
        </button>
        <a href="/" className="text-center text-sm text-white/40 hover:text-white/70">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
