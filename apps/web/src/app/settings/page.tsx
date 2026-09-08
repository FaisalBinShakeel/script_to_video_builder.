"use client";

import { useState } from "react";
import { BrandKitForm } from "@/components/settings/BrandKitForm";
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel";

const TABS = [
  { key: "brand", label: "Brand kit" },
  { key: "keys", label: "API keys" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("brand");

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <a href="/" className="mb-8 inline-block text-sm text-white/50 hover:text-white">
        &larr; Back
      </a>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="mb-8 flex gap-1 rounded-lg border border-surface-border bg-surface-raised p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-accent text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "brand" ? <BrandKitForm /> : <ApiKeysPanel />}
    </main>
  );
}
