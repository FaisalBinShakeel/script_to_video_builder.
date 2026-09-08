import type { WebpackOverrideFn } from "@remotion/bundler";

/**
 * The project is authored with explicit ".js" extensions on relative
 * imports (TypeScript's NodeNext-style convention, so the same source runs
 * unmodified under tsx/Node's ESM loader elsewhere in the monorepo). tsc
 * resolves that fine under "moduleResolution": "bundler", but webpack
 * doesn't by default -- this teaches it to fall back from .js to .ts/.tsx.
 *
 * remotion.config.ts applies this automatically for the `remotion studio`/
 * `remotion render` CLIs; renderVideo() in render.ts passes it explicitly
 * to bundle() since programmatic calls don't read remotion.config.ts.
 */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    extensionAlias: {
      ".js": [".js", ".ts", ".tsx"],
    },
  },
});
