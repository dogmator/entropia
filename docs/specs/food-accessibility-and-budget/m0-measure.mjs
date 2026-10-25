import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';

const seed = Number(process.argv[2] ?? 4242);
const ticks = Number(process.argv[3] ?? 40);
const warmup = Number(process.argv[4] ?? 10);
if (!Number.isInteger(seed) || !Number.isInteger(ticks) || !Number.isInteger(warmup) || ticks < 1 || warmup < 0) {
  throw new Error('Usage: node m0-measure.mjs [seed] [measured-ticks] [warmup-ticks]');
}
const root = process.cwd();
const alias = Object.fromEntries([
  ['@', root + '/src'],
  ['@simulation', root + '/src/simulation'],
  ['@core', root + '/src/core'],
  ['@shared', root + '/src/shared'],
  ['@ui', root + '/src/ui']
]);
const vite = await createServer({
  configFile: false, root, server: { middlewareMode: true }, appType: 'custom',
  resolve: { alias }, optimizeDeps: { noDiscovery: true }
});
const p = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = fraction => sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
  return { p50: at(0.50), p95: at(0.95) };
};
try {
  const { SimulationEngine } = await vite.ssrLoadModule('/src/simulation/engine/Engine.ts');
  const { EntityType } = await vite.ssrLoadModule('/src/types.ts');
  const engine = new SimulationEngine(1, { seed });
  if (engine.config.maxOrganisms !== 400 || engine.config.maxFood !== 400) {
    throw new Error('Unexpected default capacity; update the approved benchmark configuration');
  }
  let createdCount = 0;
  while (engine.organisms.size < engine.config.maxOrganisms) {
    const before = engine.organisms.size;
    const org = engine.spawnService.spawnOrganism(EntityType.PREY);
    if (!org) throw new Error('Could not fill the benchmark population');
    if (engine.organisms.size !== before) {
      throw new Error('spawnOrganism registered an organism; explicit add would duplicate it');
    }
    if (engine.organisms.has(org.id)) throw new Error('Duplicate organism identifier');
    engine.entityManager.addOrganism(org);
    if (engine.organisms.size !== before + 1) throw new Error('Organism registration count changed');
    createdCount++;
  }
  if (engine.organisms.size !== 400) throw new Error('Benchmark did not reach 400 organisms');
  const originalNearby = engine.gridManager.getNearby;
  const originalScan = engine.behaviorSystem.scanNeighbors;
  const originalApply = engine.behaviorSystem.applyBehaviors;
  if (typeof originalNearby !== 'function' || typeof originalScan !== 'function' || typeof originalApply !== 'function') {
    throw new Error('Instrumentation points changed; do not substitute a different metric');
  }
  let isPreySelection = false;
  let isScanning = false;
  let selectionTime = 0;
  let selectionCalls = 0;
  let nearbyCalls = 0;
  engine.gridManager.getNearby = function (...args) {
    const start = performance.now();
    if (isScanning) throw new Error('scanNeighbors now calls getNearby; timing would double count');
    try { return originalNearby.apply(this, args); }
    finally {
      if (isPreySelection) {
        selectionTime += performance.now() - start;
        nearbyCalls++;
      }
    }
  };
  engine.behaviorSystem.scanNeighbors = function (organism) {
    const start = performance.now();
    isScanning = true;
    try { return originalScan.call(this, organism); }
    finally {
      isScanning = false;
      if (organism.isPrey) {
        selectionTime += performance.now() - start;
        selectionCalls++;
      }
    }
  };
  engine.behaviorSystem.applyBehaviors = function (organism) {
    isPreySelection = organism.isPrey;
    try { return originalApply.call(this, organism); }
    finally { isPreySelection = false; }
  };
  const selectionSamples = [];
  const tickSamples = [];
  let checkedPreyCalls = 0;
  engine.start();
  if (engine.tick !== 0) throw new Error('engine.start advanced the tick; timed loop invalid');
  for (let i = 0; i < warmup + ticks; i++) {
    const expectedPreyCalls = [...engine.organisms.values()].filter(o => o.isPrey && !o.isDead).length;
    selectionTime = 0;
    selectionCalls = 0;
    nearbyCalls = 0;
    const tickBefore = engine.tick;
    const start = performance.now();
    engine.update();
    const tickMs = performance.now() - start;
    if (engine.tick !== tickBefore + 1) throw new Error('Background ticking or stopped engine detected');
    if (selectionCalls !== expectedPreyCalls) {
      throw new Error('Partial selection measurement: ' + String(selectionCalls) + ' calls for ' + String(expectedPreyCalls) + ' prey');
    }
    if (nearbyCalls !== expectedPreyCalls) {
      throw new Error('Partial neighbor measurement: ' + String(nearbyCalls) + ' calls for ' + String(expectedPreyCalls) + ' prey');
    }
    if (i < warmup) continue;
    checkedPreyCalls += selectionCalls;
    tickSamples.push(tickMs);
    selectionSamples.push(selectionTime);
  }
  engine.stop();
  const a = p(selectionSamples);
  const b = p(tickSamples);
  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const hardwareId = createHash('sha256')
    .update([platform(), arch(), cpuModel, process.version].join('|')).digest('hex').slice(0, 16);
  console.log(JSON.stringify({
    seed, tick: engine.tick, measuredTicks: ticks, warmupTicks: warmup,
    hardwareId, createdCount, selectionCalls: checkedPreyCalls,
    selectionCallsMatchedPreyPerTick: true,
    startAdvancedTick: false, spawnOrganismRegistered: false, scanNeighborsCallsGetNearby: false,
    config: { maxOrganisms: engine.config.maxOrganisms, maxFood: engine.config.maxFood },
    measurementMethod: 'ssr-instrumentation',
    targetSelectionDefinition: 'sum(prey getNearby + prey scanNeighbors) per engine tick',
    workerTickDefinition: 'synchronous engine.update duration; excludes Worker messages',
    targetSelectionMsP50: a.p50, targetSelectionMsP95: a.p95,
    workerTickMsP50: b.p50, workerTickMsP95: b.p95
  }));
} finally {
  await vite.close();
  // Imported simulation services can own live handles. This is a one-shot external probe.
  process.exit(process.exitCode ?? 0);
}
