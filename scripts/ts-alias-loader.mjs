import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const base = new URL(`src/${relative}`, projectRoot);
    const candidates = [new URL(`${base.href}.ts`), new URL(`${base.href}/index.ts`)];
    const found = candidates.find((candidate) => existsSync(fileURLToPath(candidate)));
    if (found) return { url: pathToFileURL(fileURLToPath(found)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
