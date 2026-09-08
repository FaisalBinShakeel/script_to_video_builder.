"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { StepHeader } from "@/components/create/StepHeader";
import { TopicStep } from "@/components/create/TopicStep";
import { OptionsStep } from "@/components/create/OptionsStep";
import { ScriptStep } from "@/components/create/ScriptStep";
import { RenderStep } from "@/components/create/RenderStep";
import { PreviewStep } from "@/components/create/PreviewStep";
import { DEFAULT_OPTIONS, type CreateOptions, type WizardStep } from "@/components/create/types";

function CreateWizard() {
  const searchParams = useSearchParams();
  const existingProjectId = searchParams.get("project");

  const [step, setStep] = useState<WizardStep>("topic");
  const [options, setOptions] = useState<CreateOptions>(DEFAULT_OPTIONS);
  const [project, setProject] = useState<Project | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingProjectId) return;
    apiFetch<Project>(`/projects/${existingProjectId}`)
      .then((p) => {
        setProject(p);
        setOptions((o) => ({ ...o, topic: p.topic, format: p.format, tone: p.tone, language: p.language }));
        setStep("script");
      })
      .catch(() => {
        /* fall back to a fresh wizard */
      });
  }, [existingProjectId]);

  async function generateScript(finalOptions: CreateOptions) {
    setLoading(true);
    setError(null);
    try {
      const created = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          topic: finalOptions.topic,
          format: finalOptions.format,
          targetDuration: finalOptions.targetDuration,
          tone: finalOptions.tone,
          language: finalOptions.language,
        }),
      });
      setOptions(finalOptions);
      setProject(created);
      setStep("script");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the script");
    } finally {
      setLoading(false);
    }
  }

  const handleRenderDone = useCallback((result: { downloadUrl: string | null }) => {
    if (result.downloadUrl) {
      setDownloadUrl(result.downloadUrl);
      setStep("preview");
    }
    // A failed render is shown (with a "back to script" action) by
    // RenderStep itself, which stays mounted since step doesn't change.
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <StepHeader current={step} />

      {loading && <p className="text-sm text-white/50">Writing your script...</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {!loading && step === "topic" && (
        <TopicStep
          topic={options.topic}
          onNext={(topic) => {
            setOptions((o) => ({ ...o, topic }));
            setStep("options");
          }}
        />
      )}

      {!loading && step === "options" && (
        <OptionsStep
          initial={options}
          onBack={() => setStep("topic")}
          onNext={(finalOptions) => generateScript(finalOptions)}
        />
      )}

      {!loading && step === "script" && project?.scriptJson && (
        <ScriptStep project={project} onBack={() => setStep("options")} onNext={() => setStep("render")} />
      )}

      {step === "render" && project && (
        <RenderStep
          projectId={project.id}
          onBack={() => setStep("script")}
          onDone={handleRenderDone}
        />
      )}

      {step === "preview" && downloadUrl && (
        <PreviewStep
          downloadUrl={downloadUrl}
          onEditScenes={() => setStep("script")}
          onRegenerate={() => {
            setDownloadUrl(null);
            setStep("render");
          }}
        />
      )}
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateWizard />
    </Suspense>
  );
}
