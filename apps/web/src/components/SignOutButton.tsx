"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await apiFetch("/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-white/50 hover:text-white"
    >
      Sign out
    </button>
  );
}
