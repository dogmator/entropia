/* eslint-disable @typescript-eslint/no-magic-numbers */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { SerializedSimulationStateV1 } from '@/types';
import { EngineState } from '@/types';

import { SimulationEngine } from '../engine/Engine';

// Measurement harness for the genealogy and the snapshot size of a long run. Seeds and checkpoints are fixed, so the
// counts are repeatable. Timing and heap figures depend on the machine: they are reported, never asserted.
// ENDURANCE_REPORT=1 prints the measurement table. ENDURANCE_CHECKPOINTS=300,900,1500 extends the run for a report.
const SEEDS = [4242, 1, 0xdeadbeef];
const EXTINCTION_SEED = 4242;
const SHORT_CHECKPOINT = 100;
const LONG_CHECKPOINT = 300;
const DEFAULT_CHECKPOINTS = [SHORT_CHECKPOINT, LONG_CHECKPOINT];
// The run pauses once the population has been empty for EXTINCTION_FAILSAFE_TICKS (TickLoop.service.ts). The observation
// window is longer than that, so the pause is part of what is checked.
const EXTINCTION_OBSERVATION_TICKS = 200;
const RESTORE_SEED = 99;
const CONTINUATION_TICKS = 30;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const isReportEnabled = process.env['ENDURANCE_REPORT'] === '1';
const REPORT_PATH = process.env['ENDURANCE_REPORT_PATH'];
// A long report run takes minutes. The regular suite never runs it, so it gets its own time budget.
const REPORT_TIMEOUT_MS = 600_000;
const REPORT_CHECKPOINTS = process.env['ENDURANCE_CHECKPOINTS']?.split(',').map(Number) ?? DEFAULT_CHECKPOINTS;

interface Sample {
  seed: number;
  tick: number;
  founders: number;
  births: number;
  deaths: number;
  organisms: number;
  genealogyNodes: number;
  snapshotBytes: number;
  genealogyBytes: number;
  msPerTick: number;
  heapMegabytes: number;
}

// The state with its wall-clock metadata removed, so two runs can be compared.
const comparable = (engine: SimulationEngine): string =>
  JSON.stringify(engine.exportState(), (key, value: unknown) => (key === 'spawnTime' ? undefined : value));

const advanceTo = (engine: SimulationEngine, tick: number): void => {
  while (engine.getTick() < tick && engine.state === EngineState.RUNNING) engine.update();
};

// Runs one seed and samples it at each checkpoint. A run that goes extinct stops advancing, and its samples show that.
const sampleRun = (seed: number, checkpoints: readonly number[]): Sample[] => {
  const engine = new SimulationEngine(1, { seed });
  engine.start();
  const samples: Sample[] = [];
  for (const target of checkpoints) {
    const startTick = engine.getTick();
    const started = performance.now();
    advanceTo(engine, target);
    const advanced = engine.getTick() - startTick;
    const elapsed = performance.now() - started;
    samples.push({
      seed,
      tick: engine.getTick(),
      founders: engine.geneticRoots.length,
      births: engine.getStats().totalBirths,
      deaths: engine.getStats().totalDeaths,
      organisms: engine.organisms.size,
      genealogyNodes: engine.geneticTree.size,
      snapshotBytes: new TextEncoder().encode(JSON.stringify(engine.exportState())).byteLength,
      genealogyBytes: new TextEncoder().encode(JSON.stringify(engine.exportState().geneticTree)).byteLength,
      msPerTick: advanced > 0 ? elapsed / advanced : 0,
      heapMegabytes: process.memoryUsage().heapUsed / BYTES_PER_MEGABYTE,
    });
  }
  return samples;
};

describe.each(SEEDS)('genealogy accounting for seed %i', (seed) => {
  it('adds exactly one genealogy node per birth, on top of the founders', () => {
    for (const sample of sampleRun(seed, DEFAULT_CHECKPOINTS)) {
      expect(sample.genealogyNodes, `tick ${String(sample.tick)}`).toBe(sample.founders + sample.births);
    }
  });

  it('restores a long history with every genealogy node, and continues like the source run', () => {
    const source = new SimulationEngine(1, { seed });
    source.start();
    advanceTo(source, LONG_CHECKPOINT);

    const snapshot = JSON.parse(JSON.stringify(source.exportState())) as SerializedSimulationStateV1;
    const restored = new SimulationEngine(1, { seed: RESTORE_SEED });
    restored.importState(snapshot);

    expect(restored.geneticTree.size).toBe(source.geneticTree.size);
    expect(restored.geneticRoots).toEqual(source.geneticRoots);
    restored.start();
    for (let i = 0; i < CONTINUATION_TICKS; i++) {
      source.update();
      restored.update();
    }
    expect(comparable(restored)).toBe(comparable(source));
  });
});

describe('genealogy under extinction', () => {
  it('keeps the whole history and pauses the run when the population goes extinct', () => {
    const engine = new SimulationEngine(1, { seed: EXTINCTION_SEED });
    engine.start();
    advanceTo(engine, SHORT_CHECKPOINT);
    const nodesBefore = engine.geneticTree.size;
    const rootsBefore = engine.geneticRoots.length;

    engine.organisms.clear();
    for (let i = 0; i < EXTINCTION_OBSERVATION_TICKS && engine.state === EngineState.RUNNING; i++) engine.update();

    expect(engine.state).toBe(EngineState.PAUSED);
    expect(engine.geneticTree.size).toBe(nodesBefore);
    expect(engine.geneticRoots.length).toBe(rootsBefore);
  });
});

// Prints the measurements for the report. Skipped unless ENDURANCE_REPORT=1, so the regular suite stays fast.
it.runIf(isReportEnabled)('prints the genealogy and snapshot measurements', () => {
  const rows = SEEDS.flatMap(seed => sampleRun(seed, REPORT_CHECKPOINTS));
  const lines = [
    'seed,tick,founders,births,deaths,organisms,genealogyNodes,snapshotBytes,genealogyBytes,msPerTick,heapMegabytes',
    ...rows.map(row => [
      row.seed, row.tick, row.founders, row.births, row.deaths, row.organisms,
      row.genealogyNodes, row.snapshotBytes, row.genealogyBytes, row.msPerTick.toFixed(3), row.heapMegabytes.toFixed(1),
    ].join(',')),
  ];
  console.log(lines.join('\n'));
  if (REPORT_PATH !== undefined) writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`);
  expect(rows.length).toBe(SEEDS.length * REPORT_CHECKPOINTS.length);
}, REPORT_TIMEOUT_MS);
