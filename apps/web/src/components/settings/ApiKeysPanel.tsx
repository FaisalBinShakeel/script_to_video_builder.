"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { CredentialField, CredentialsStatus } from "@/lib/types";
import { SecretField } from "./SecretField";

interface Section {
  title: string;
  description: string;
  helpUrl: string;
  helpLabel: string;
}

const SECTIONS: Record<string, Section> = {
  openrouter: {
    title: "OpenRouter",
    description: "Writes the scene-by-scene script for each video.",
    helpUrl: "https://openrouter.ai/keys",
    helpLabel: "Get a key",
  },
  pexels: {
    title: "Pexels",
    description: "Primary stock footage source.",
    helpUrl: "https://www.pexels.com/api/",
    helpLabel: "Get a key",
  },
  pixabay: {
    title: "Pixabay",
    description: "Fallback stock footage source.",
    helpUrl: "https://pixabay.com/api/docs/",
    helpLabel: "Get a key",
  },
  azure: {
    title: "Azure Speech",
    description: "Generates the narration voiceover.",
    helpUrl: "https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices",
    helpLabel: "Get a key",
  },
  r2: {
    title: "Cloudflare R2",
    description: "Stores rendered videos; downloads are signed, never public.",
    helpUrl: "https://developers.cloudflare.com/r2/get-started/",
    helpLabel: "Get credentials",
  },
};

function SectionHeader({ section }: { section: Section }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <div>
        <h3 className="text-sm font-semibold">{section.title}</h3>
        <p className="text-xs text-white/40">{section.description}</p>
      </div>
      <a
        href={section.helpUrl}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-xs text-accent hover:underline"
      >
        {section.helpLabel} &rarr;
      </a>
    </div>
  );
}

export function ApiKeysPanel() {
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<CredentialField, string>>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CredentialsStatus>("/account/credentials").then(setStatus).catch(() => {});
  }, []);

  function setDraft(field: CredentialField, value: string) {
    setDrafts((d) => ({ ...d, [field]: value }));
  }

  async function save(sectionKey: string, fields: CredentialField[]) {
    const body: Record<string, string> = {};
    for (const f of fields) {
      const v = drafts[f];
      if (v !== undefined && v !== "") body[f] = v;
    }
    if (Object.keys(body).length === 0) return;

    setSavingSection(sectionKey);
    setError(null);
    setSavedSection(null);
    try {
      const updated = await apiFetch<CredentialsStatus>("/account/credentials", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setStatus(updated);
      setDrafts((d) => {
        const next = { ...d };
        for (const f of fields) delete next[f];
        return next;
      });
      setSavedSection(sectionKey);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your keys");
    } finally {
      setSavingSection(null);
    }
  }

  async function clear(field: CredentialField) {
    setError(null);
    try {
      const updated = await apiFetch<CredentialsStatus>("/account/credentials", {
        method: "PUT",
        body: JSON.stringify({ [field]: null }),
      });
      setStatus(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't clear that key");
    }
  }

  if (!status) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
        <p className="mt-1 text-sm text-white/50">
          Bring your own provider keys instead of relying on the app&apos;s defaults. Stored
          encrypted; we only ever show whether a key is set, never the value.
        </p>
      </div>

      <section>
        <SectionHeader section={SECTIONS.openrouter!} />
        <SecretField
          label="API key"
          isSet={status.openrouterApiKeySet}
          value={drafts.openrouterApiKey ?? ""}
          onChange={(v) => setDraft("openrouterApiKey", v)}
          onClear={() => clear("openrouterApiKey")}
        />
        <SaveButton
          disabled={!drafts.openrouterApiKey}
          saving={savingSection === "openrouter"}
          saved={savedSection === "openrouter"}
          onClick={() => save("openrouter", ["openrouterApiKey"])}
        />
      </section>

      <section>
        <SectionHeader section={SECTIONS.pexels!} />
        <SecretField
          label="API key"
          isSet={status.pexelsApiKeySet}
          value={drafts.pexelsApiKey ?? ""}
          onChange={(v) => setDraft("pexelsApiKey", v)}
          onClear={() => clear("pexelsApiKey")}
        />
        <SaveButton
          disabled={!drafts.pexelsApiKey}
          saving={savingSection === "pexels"}
          saved={savedSection === "pexels"}
          onClick={() => save("pexels", ["pexelsApiKey"])}
        />
      </section>

      <section>
        <SectionHeader section={SECTIONS.pixabay!} />
        <SecretField
          label="API key"
          isSet={status.pixabayApiKeySet}
          value={drafts.pixabayApiKey ?? ""}
          onChange={(v) => setDraft("pixabayApiKey", v)}
          onClear={() => clear("pixabayApiKey")}
        />
        <SaveButton
          disabled={!drafts.pixabayApiKey}
          saving={savingSection === "pixabay"}
          saved={savedSection === "pixabay"}
          onClick={() => save("pixabay", ["pixabayApiKey"])}
        />
      </section>

      <section>
        <SectionHeader section={SECTIONS.azure!} />
        <div className="flex flex-col gap-3">
          <SecretField
            label="Speech key"
            isSet={status.azureSpeechKeySet}
            value={drafts.azureSpeechKey ?? ""}
            onChange={(v) => setDraft("azureSpeechKey", v)}
            onClear={() => clear("azureSpeechKey")}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Region</span>
            <input
              value={drafts.azureSpeechRegion ?? status.azureSpeechRegion ?? ""}
              onChange={(e) => setDraft("azureSpeechRegion", e.target.value)}
              placeholder="eastus"
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <SaveButton
          disabled={!drafts.azureSpeechKey && !drafts.azureSpeechRegion}
          saving={savingSection === "azure"}
          saved={savedSection === "azure"}
          onClick={() => save("azure", ["azureSpeechKey", "azureSpeechRegion"])}
        />
      </section>

      <section>
        <SectionHeader section={SECTIONS.r2!} />
        <div className="flex flex-col gap-3">
          <SecretField
            label="Account ID"
            isSet={status.r2AccountIdSet}
            value={drafts.r2AccountId ?? ""}
            onChange={(v) => setDraft("r2AccountId", v)}
            onClear={() => clear("r2AccountId")}
          />
          <SecretField
            label="Access key ID"
            isSet={status.r2AccessKeyIdSet}
            value={drafts.r2AccessKeyId ?? ""}
            onChange={(v) => setDraft("r2AccessKeyId", v)}
            onClear={() => clear("r2AccessKeyId")}
          />
          <SecretField
            label="Secret access key"
            isSet={status.r2SecretAccessKeySet}
            value={drafts.r2SecretAccessKey ?? ""}
            onChange={(v) => setDraft("r2SecretAccessKey", v)}
            onClear={() => clear("r2SecretAccessKey")}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/60">Bucket name</span>
            <input
              value={drafts.r2Bucket ?? status.r2Bucket ?? ""}
              onChange={(e) => setDraft("r2Bucket", e.target.value)}
              placeholder="my-video-builder-bucket"
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <SaveButton
          disabled={
            !drafts.r2AccountId && !drafts.r2AccessKeyId && !drafts.r2SecretAccessKey && !drafts.r2Bucket
          }
          saving={savingSection === "r2"}
          saved={savedSection === "r2"}
          onClick={() => save("r2", ["r2AccountId", "r2AccessKeyId", "r2SecretAccessKey", "r2Bucket"])}
        />
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function SaveButton({
  disabled,
  saving,
  saved,
  onClick,
}: {
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || saving}
        className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-30"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {saved && <span className="text-xs text-emerald-400">Saved.</span>}
    </div>
  );
}
