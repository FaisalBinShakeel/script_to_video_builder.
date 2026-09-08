const STEPS: { key: string; label: string }[] = [
  { key: "topic", label: "Topic" },
  { key: "options", label: "Style" },
  { key: "script", label: "Script" },
  { key: "render", label: "Render" },
  { key: "preview", label: "Preview" },
];

export function StepHeader({ current }: { current: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="mb-10 flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
              i <= currentIndex ? "bg-accent text-white" : "bg-white/10 text-white/40"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`hidden text-xs sm:inline ${i <= currentIndex ? "text-white/80" : "text-white/30"}`}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 ${i < currentIndex ? "bg-accent" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
