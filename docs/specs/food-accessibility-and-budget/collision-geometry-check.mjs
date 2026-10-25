import { createServer } from 'vite';

const root = process.cwd();
const alias = Object.fromEntries([
  ['@', root + '/src'], ['@simulation', root + '/src/simulation'],
  ['@core', root + '/src/core'], ['@shared', root + '/src/shared'], ['@ui', root + '/src/ui']
]);
const vite = await createServer({
  configFile: false, root, server: { middlewareMode: true }, appType: 'custom',
  resolve: { alias }, optimizeDeps: { noDiscovery: true }
});
try {
  const { CollisionSystem } = await vite.ssrLoadModule('/src/simulation/systems/Collision.system.ts');
  const { MathUtils } = await vite.ssrLoadModule('/src/simulation/MathUtils.utils.ts');
  const examples = [0.5, 1, 2].map(scale => {
    const worldSize = 600 * scale;
    const a = { position: { x: 1, y: 140, z: 170 }, radius: 2 };
    const b = { position: { x: worldSize - 1, y: 140, z: 170 }, radius: 2 };
    const actual = CollisionSystem.prototype.isColliding.call({}, a, b);
    const expected = MathUtils.toroidalDistanceSq(a.position, b.position, worldSize) <
      (a.radius + b.radius) ** 2;
    return { scale, worldSize, collisionActual: actual, collisionExpected: expected, matches: actual === expected };
  });
  if (!examples[1].matches || examples[0].matches || examples[2].matches) {
    throw new Error('Collision geometry no longer matches documented baseline; review required');
  }
  console.log(JSON.stringify({
    status: 'CONFIRMED_GEOMETRY_DEFECT',
    commit: 'afad92b84c9b547802a5a785588ba112a1a05331',
    source: 'Collision.system.ts isColliding vs explicit worldSize toroidalDistanceSq',
    cases: examples,
    acceptance: 'FOOD-T08 BLOCKED for nondefault world scales',
    note: 'Diagnostic only; no physical simulation code changed.'
  }));
} finally {
  await vite.close();
  process.exit(process.exitCode ?? 0);
}
