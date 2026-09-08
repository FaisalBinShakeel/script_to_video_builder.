/** Shared between apps/api (producer) and apps/worker (consumer) so the
 * queue name and job payload shape can never drift between them. */
export const RENDER_QUEUE_NAME = "render";

export interface RenderJobData {
  renderId: string;
}

export interface RenderJobProgress {
  stage: RenderStage;
  percent: number;
}

export const RENDER_STAGES = [
  "script",
  "footage",
  "voice",
  "compose",
  "encode",
  "upload",
] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];
