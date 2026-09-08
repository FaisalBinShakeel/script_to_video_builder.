import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Loads the repo-root .env so CLIs work the same whether run from the
 * workspace root or from packages/core. */
export function loadEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  config({ path: path.resolve(here, "../../../../.env") });
}

/** Minimal `--flag value` / `--flag=value` parser, no external dependency. */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const eq = key.indexOf("=");
    if (eq !== -1) {
      out[key.slice(0, eq)] = key.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}
