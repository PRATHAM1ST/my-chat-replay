/**
 * Lets `node --test` run the TypeScript sources directly.
 *
 * Node strips the types itself; the only thing it will not do is guess a file
 * extension, so this hook maps the project's extensionless relative imports
 * (`./types`) and its `@/` alias onto real `.ts` files. No build step, no test
 * framework, nothing to keep in sync with the lockfile.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const ROOT = new URL("../", import.meta.url);

function firstExisting(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    const url = candidate.startsWith("file:") ? new URL(candidate) : pathToFileURL(candidate);
    if (existsSync(fileURLToPath(url))) return url.href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const hit = firstExisting(resolvePath(fileURLToPath(ROOT), "src", specifier.slice(2)));
      if (hit) return { url: hit, shortCircuit: true };
    }
    if (specifier.startsWith(".") && !/\.(ts|tsx|js|mjs|json)$/.test(specifier)) {
      const hit = firstExisting(new URL(specifier, context.parentURL).href);
      if (hit) return { url: hit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
