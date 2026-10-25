import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '../../..');
process.chdir(root);
const run = (binary, args) => execFileSync(binary, args, { encoding: 'utf8' }).trim();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sourcePath = 'src/simulation/__tests__/BaselineFingerprint.test.ts';
const baselineCommit = 'afad92b84c9b547802a5a785588ba112a1a05331';
const expected = {
  4242: ['d33c81bd', 'ce63bed1'],
  1: ['37f34d1d', 'ef5ec3c7'],
  3735928559: ['b2ec13f5', '50f4f152']
};
const scopePolicy = JSON.parse(readFileSync('docs/specs/food-accessibility-and-budget/scope-policy.json','utf8'));
const genomeInventory = scopePolicy.genomeInventory;
const genomeStrict = scopePolicy.genomeStrict;
const allowedExact = new Set(scopePolicy.allowedExact);
const allowedPatterns = scopePolicy.allowedPatterns.map(p => new RegExp(p));
const permittedFile = name => allowedExact.has(name) || allowedPatterns.some(pattern => pattern.test(name));
function verifyPreflight() {
  const spec = readFileSync('docs/specs/food-accessibility-and-budget/specification.md', 'utf8');
  const plan = readFileSync('docs/specs/food-accessibility-and-budget/execution-plan.md', 'utf8');
  const ids = [...spec.matchAll(/^\| (FOOD-[A-Z]\d{2}) \|/gm)].map(m => m[1]);
  const counts = { R: 8, B: 8, I: 8, A: 14, D: 6, P: 5, T: 12 };
  assert(ids.length === 61 && new Set(ids).size === 61, 'Requirement count or uniqueness failed');
  for (const [prefix, quantity] of Object.entries(counts))
    assert(ids.filter(id => id.startsWith('FOOD-' + prefix)).length === quantity, prefix + ' count failed');
  assert(existsSync(sourcePath), 'Missing baseline source file');
  const source = readFileSync(sourcePath, 'utf8');
  const recorded = source.match(/const RECORDED:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  assert(recorded, 'Could not parse RECORDED');
  const fromCommit = run('git', ['show', baselineCommit + ':' + sourcePath]);
  assert(fromCommit.includes(recorded[0]), 'RECORDED does not match recorded commit SHA');
  for (const [seed, list] of Object.entries(expected)) {
    const row = recorded[1].match(new RegExp('^\\s*' + seed + ':\\s*\\[([^\\]]+)\\]', 'm'));
    assert(row, 'Missing seed ' + seed);
    const hashes = [...row[1].matchAll(/'([0-9a-f]{8})'/g)].map(m => m[1]);
    assert(JSON.stringify(hashes) === JSON.stringify(list), 'Incorrect baseline values ' + seed);
    for (const hash of hashes) assert(plan.includes(hash), 'Hash absent from plan ' + hash);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const key of ['depcruise', 'check:dead-code', 'check:strict'])
    assert(typeof pkg.scripts[key] === 'string' && pkg.scripts[key].length > 0, 'Missing script ' + key);
  assert(/MAX_TOTAL_ORGANISMS\s*=\s*400\s*;/.test(readFileSync('src/config/population.constants.ts', 'utf8')),
    'Unexpected population cap');
  assert(readFileSync('src/config/world.config.ts', 'utf8').includes('MAX_TOTAL_ORGANISMS * volumeScale'), 'Scaling formula changed');
  for (const name of genomeInventory) assert(existsSync(name), 'Missing genome source ' + name);
  assert(plan.includes('verify-review.mjs'), 'Plan does not link verification');
  return {
    status: 'PASS', commit: run('git', ['rev-parse', 'HEAD']), baselineSourceCommit: baselineCommit,
    requirementCount: ids.length, counts, recorded: expected,
    scripts: Object.fromEntries(['depcruise','check:dead-code','check:strict'].map(k => [k,pkg.scripts[k]])),
    maxOrganismsAtScale1: 400, genomeInventory
  };
}
const sha256 = data => createHash('sha256').update(data).digest('hex');
function genomeHashes(base, dirtyManifest = {}) {
  const entries = [];
  for (const file of genomeInventory) {
    assert(existsSync(file), 'Missing genome file: ' + file);
    const baselineBytes = execFileSync('git', ['show', base + ':' + file]);
    const baselineSha256 = sha256(baselineBytes);
    const currentSha256 = sha256(readFileSync(file));
    let status = 'MATCH';
    if (baselineSha256 !== currentSha256) {
      if (dirtyManifest[file] === currentSha256) status = 'PREEXISTING_DIRTY';
      else status = 'CHANGED';
    }
    entries.push({ file, baselineSha256, currentSha256, status });
  }
  return { base, results: entries, count: entries.length, changed: entries.filter(x => x.status === 'CHANGED').length };
}
function getChanges(base) {
  // Review implementation files across the repository, not only src/tests.
  // This directory is documentation and review tooling, not simulation implementation.
  const code = name => /\.(?:[cm]?[jt]sx?|json|vue|svelte)$/.test(name)
    && !name.startsWith('docs/specs/food-accessibility-and-budget/');
  const tracked = run('git', ['diff','--name-only',base]).split('\n').filter(code);
  const untracked = run('git',['ls-files','--others','--exclude-standard']).split('\n').filter(code);
  return { tracked:new Set(tracked), untracked:new Set(untracked), all:[...new Set([...tracked,...untracked])].sort() };
}
function scopeCheck(base, manifest) {
  assert(/^[0-9a-f]{40}$/.test(base), 'Require full baseline commit SHA');
  const { tracked, untracked, all } = getChanges(base);
  const ignored = [], considered = [], errors = [], newFileChecks=[];
  for (const file of all) {
    const body = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
    if (manifest[file] && manifest[file] === sha256(body)) {
      ignored.push(file);
      continue;
    }
    considered.push(file);
    if (!permittedFile(file)) errors.push('Outside allowlist: ' + file);
    if (genomeStrict.includes(file)) errors.push('Protected genome file modified: ' + file);
    if (/(?:genom|genet|mutat|reproduc|utility.?ai|neuroevol)/i.test(file)) {
      errors.push('Genome or AI module path: ' + file);
    }
    const source = body.toString('utf8');
    if (untracked.has(file)) {
      const forbidden = /\b(?:UtilityAI|Utility\s+AI|NeuroEvolution|NeuralEvolution|EvolutionaryIntelligence)\b/i;
      const match = source.match(forbidden);
      newFileChecks.push({file, bytes:body.length, scanned:true, forbiddenTerm:match?.[0] ?? null});
      if (match) errors.push('Forbidden AI content in untracked file: '+file+' ('+match[0]+')');
    }
    if (tracked.has(file)) {
      const patch = run('git',['diff','--unified=0',base,'--',file]);
      for (const line of patch.split('\n')) {
        if (/^[+-](?![+-])/.test(line) && /\b(genome|genetic|mutat|reproduc|inherit)/i.test(line)) {
          errors.push('Genome-related source change in '+file+': '+line.slice(0,140));
        }
        if (/^\+(?!\+)/.test(line) && /\b(?:UtilityAI|Utility\s+AI|NeuroEvolution|NeuralEvolution)\b/i.test(line)) {
          errors.push('Forbidden AI source change in '+file+': '+line.slice(0,140));
        }
      }
    }
  }
  const hashes=genomeHashes(base,manifest);
  for (const result of hashes.results) {
    if (result.status === 'CHANGED') errors.push('Genome inventory SHA256 changed: ' + result.file);
  }
  return {
    status: errors.length?'FAIL':'PASS', base, considered, baselineDirtyIgnored:ignored,
    genomeHashes:hashes, untrackedScanned:newFileChecks, genomeStrict, errors,
    warning:'SHA256 and text guards are necessary but not sufficient for semantic equivalence. Review mixed files manually.'
  };
}
const command = process.argv[2] ?? 'preflight';
if (command === 'preflight') {
  console.log(JSON.stringify({...verifyPreflight(),
    requirementCheckScope:'structure-only; checks ID count and uniqueness, not semantic correctness'}, null, 2));
} else if (command === 'genome-sha256') {
  const base = process.argv[3] ?? baselineCommit;
  const manifest = process.argv[4] ? JSON.parse(readFileSync(process.argv[4],'utf8')) : {};
  const data=genomeHashes(base,manifest);
  console.log(JSON.stringify(data,null,2));
  if(data.changed)process.exitCode=1;
} else if (command === 'scope') {
  const base = process.argv[3];
  const manifest = process.argv[4] ? JSON.parse(readFileSync(process.argv[4],'utf8')) : {};
  const output=scopeCheck(base,manifest);
  console.log(JSON.stringify(output,null,2));
  if(output.status==='FAIL')process.exitCode=1;
} else {
  throw new Error('Usage: node verify-review.mjs preflight | genome-sha256 <base-sha> [dirty-manifest.json] | scope <base-sha> [dirty-manifest.json]');
}
