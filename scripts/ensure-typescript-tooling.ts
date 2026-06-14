import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const FORBIDDEN_TOOLING_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.mts']);
const IGNORED_DIRECTORIES = new Set(['.git', 'coverage', 'dist', 'node_modules', '.idea', '.pnpm-store']);

const violations = findForbiddenFiles(process.cwd());

if (violations.length > 0) {
  console.error('Violations found:');
  violations.forEach(v => { console.error(`- ${v}`); });
  process.exit(1);
} else {
  console.log('No forbidden tooling files found.');
}

function findForbiddenFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : findForbiddenFiles(absolutePath);
    }

    return hasForbiddenExtension(entry.name) ? [relative(process.cwd(), absolutePath)] : [];
  });
}

function hasForbiddenExtension(fileName: string): boolean {
  // Allow certain common JS files if they are absolutely necessary, 
  // but according to Canon, we want to eliminate them.
  // Exceptions for now (like postcss.config.js) might need to be converted to .ts if supported
  // or added to ignored list if they are standard.
  const allowedExceptions = new Set(['postcss.config.js', 'eslint.config.js', 'postcss.config.js']);
  if (allowedExceptions.has(fileName)) return false;

  return [...FORBIDDEN_TOOLING_EXTENSIONS].some((extension) => fileName.endsWith(extension));
}
