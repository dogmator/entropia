/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    // ── Circular dependencies ──────────────────────────────────────────────
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make code hard to reason about and refactor.',
      from: {},
      to: { circular: true },
    },

    // ── Layer: shared → core/simulation (forbidden) ────────────────────────
    {
      name: 'shared-no-upward-imports',
      severity: 'error',
      comment: 'shared/ is a primitive layer — must not import from core/ or simulation/.',
      from: { path: '^src/shared/' },
      to: { path: '^src/(core|simulation)/' },
    },

    // ── Layer: core → simulation/ui (forbidden) ────────────────────────────
    {
      name: 'core-no-upward-imports',
      severity: 'error',
      comment: 'core/ must not depend on simulation/ or ui/.',
      from: { path: '^src/core/' },
      to: { path: '^src/(simulation|ui)/' },
    },

    // ── Layer: simulation → ui (forbidden) ────────────────────────────────
    {
      name: 'simulation-no-ui-imports',
      severity: 'error',
      comment: 'simulation/ (worker) must not import from ui/.',
      from: { path: '^src/simulation/' },
      to: { path: '^src/ui/' },
    },

    // ── Layer: ui → simulation internals (forbidden) ───────────────────────
    // ui may ONLY touch simulation through the ISimulationEngine boundary.
    // Exception: simulation/interfaces/ISimulationEngine.ts and WorkerMessages (type-only).
    {
      name: 'ui-no-simulation-internals',
      severity: 'error',
      comment: 'ui/ must not reach into simulation internals. Use ISimulationEngine boundary.',
      from: { path: '^src/ui/' },
      to: {
        path: '^src/simulation/',
        pathNot: '^src/simulation/(interfaces/ISimulationEngine|interfaces/IPersistableEngine|WorkerMessages|engine/EngineProxy|Entity)\\.ts$',
      },
    },

    // ── scripts/ → src/ (forbidden except types) ──────────────────────────
    {
      name: 'scripts-no-src-runtime',
      severity: 'warn',
      comment: 'scripts/ should not depend on runtime src/ code.',
      from: { path: '^scripts/' },
      to: { path: '^src/', pathNot: '^src/types\\.ts$' },
    },

    // ── Orphan detection ───────────────────────────────────────────────────
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Files unreachable from entry points may be dead code.',
      from: { orphan: true, pathNot: '(\\.(test|spec)\\.ts|__tests__|vitest\\.config|vite\\.config|\\.d\\.ts|interfaces/.*\\.ts|RemoteTransport\\.ts|useCameraState\\.ts)$' },
      to: {},
    },
  ],

  options: {
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
