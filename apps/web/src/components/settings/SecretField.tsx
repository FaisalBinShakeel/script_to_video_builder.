"use client";

import { useState } from "react";

export function SecretField({
  label,
  isSet,
  value,
  onChange,
  onClear,
  placeholder,
}: {
  label: string;
  isSet: boolean;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isSet ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/40"
          }`}
        >
          {isSet ? "Configured" : "Not set"}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isSet ? "•••••••••••••• (leave blank to keep)" : (placeholder ?? "Paste your key")}
          className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          className="shrink-0 rounded-lg border border-surface-border px-3 text-xs text-white/50 hover:border-white/30"
        >
          {reveal ? "Hide" : "Show"}
        </button>
        {isSet && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg border border-surface-border px-3 text-xs text-white/50 hover:border-red-400/50 hover:text-red-400"
          >
            Clear
          </button>
        )}
      </div>
    </label>
  );
}
