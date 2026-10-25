import { readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_TOOLING_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.mts']);
const IGNORED_DIRECTORIES = new Set(['.git', 'coverage', 'dist', 'node_modules', '.idea', '.pnpm-store', '.tmp']);

/**
 * Exact JavaScript exceptions with documented runtime constraints.
 * Keep production tooling in TypeScript; research-only probes are direct Node ESM entrypoints.
 * Remove an exception when its runtime supports the equivalent TypeScript entrypoint.
 */
export const DOCUMENTED_EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  [
    '.dependency-cruiser.mjs',
    'dependency-cruiser 17 imports only .js/.cjs/.mjs configs; any other extension is parsed as JSON5, so TypeScript is not supported.',
  ],
  [
    'postcss.config.mjs',
    'Vitest bundles Vite 5, which loads a .ts PostCSS config through ts-node as CJS; this package is "type": "module", so it fails with ERR_REQUIRE_ESM.',
  ],
  [
    'docs/specs/food-accessibility-and-budget/verify-review.mjs',
    'Research-only verification: direct node ESM runner used in the documented reproducible food-spec review.',
  ],
  [
    'docs/specs/food-accessibility-and-budget/m0-measure.mjs',
    'Research-only benchmark: direct Node ESM with Vite SSR instrumentation, not an application module.',
  ],
  [
    'docs/specs/food-accessibility-and-budget/collision-geometry-check.mjs',
    'Research-only collision diagnostic: direct Node ESM with Vite SSR, not an application module.',
  ],
]);

export function isForbiddenTooling(relativePath: string): boolean {
  if (DOCUMENTED_EXCEPTIONS.has(relativePath)) {
    return false;
  }

  return FORBIDDEN_TOOLING_EXTENSIONS.has(extname(relativePath));
}

export function findForbiddenFiles(directory: string, root: string = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : findForbiddenFiles(absolutePath, root);
    }

    const relativePath = relative(root, absolutePath);
    return isForbiddenTooling(relativePath) ? [relativePath] : [];
  });
}

const isEntryPoint = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryPoint) {
  const violations = findForbiddenFiles(process.cwd());

  if (violations.length > 0) {
    console.error('Violations found:');
    violations.forEach(v => { console.error(`- ${v}`); });
    process.exit(1);
  } else {
    console.log('No forbidden tooling files found.');
  }
}
