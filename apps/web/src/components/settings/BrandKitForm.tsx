"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BrandKit } from "@/lib/types";

export function BrandKitForm() {
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7C5CFF");
  const [accentColor, setAccentColor] = useState("#7C5CFF");
  const [font, setFont] = useState("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BrandKit>("/brand-kit")
      .then((kit) => {
        setName(kit.name);
        setPrimaryColor(kit.primaryColor ?? "#7C5CFF");
        setAccentColor(kit.accentColor ?? "#7C5CFF");
        setFont(kit.font ?? "");
        setWatermarkEnabled(kit.watermarkEnabled);
      })
      .catch(() => {
        /* no brand kit yet -- defaults above are fine */
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSaved(false);
    try {
      await apiFetch<BrandKit>("/brand-kit", {
        method: "PUT",
        body: JSON.stringify({ name, primaryColor, accentColor, font, watermarkEnabled }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold tracking-tight">Brand kit</h2>
      <p className="mb-6 text-sm text-white/50">Applied to every video you generate.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/60">Brand name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Primary color</span>
            <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-6 w-6 rounded border-0 bg-transparent"
              />
              <span className="text-sm">{primaryColor}</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Accent color</span>
            <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-6 w-6 rounded border-0 bg-transparent"
              />
              <span className="text-sm">{accentColor}</span>
            </div>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/60">Font (optional)</span>
          <input
            value={font}
            onChange={(e) => setFont(e.target.value)}
            placeholder="Inter"
            className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-3 py-3">
          <input
            type="checkbox"
            checked={watermarkEnabled}
            onChange={(e) => setWatermarkEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm">Show watermark on rendered videos</span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">Saved.</p>}

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save brand kit"}
        </button>
      </form>
    </div>
  );
}
