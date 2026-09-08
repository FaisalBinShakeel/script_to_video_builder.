import { redirect } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import type { AuthUser, Project } from "@/lib/types";
import { SignOutButton } from "@/components/SignOutButton";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  rendering: "Rendering",
  rendered: "Rendered",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const { data: user, status } = await serverApiFetch<AuthUser>("/auth/me");
  if (status === 401 || !user) redirect("/login");

  const { data: projects } = await serverApiFetch<Project[]>("/projects?limit=50");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your videos</h1>
          <p className="mt-1 text-sm text-white/50">
            {user.credits} credit{user.credits === 1 ? "" : "s"} remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/settings" className="text-sm text-white/50 hover:text-white">
            Settings
          </a>
          <SignOutButton />
        </div>
      </header>

      <a
        href="/create"
        className="mb-10 flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-hover"
      >
        + New Video
      </a>

      {(!projects || projects.length === 0) && (
        <p className="rounded-xl border border-dashed border-surface-border px-5 py-10 text-center text-sm text-white/40">
          No videos yet. Start with a topic and we&apos;ll write the script for you.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {projects?.map((project) => (
          <li key={project.id}>
            <a
              href={`/create?project=${project.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-raised px-5 py-4 transition hover:border-white/20"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{project.title}</p>
                <p className="mt-0.5 truncate text-xs text-white/40">
                  {project.format} &middot; {project.tone} &middot; {formatDate(project.createdAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                {STATUS_LABEL[project.status] ?? project.status}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
