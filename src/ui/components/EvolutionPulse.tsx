import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { BUFFER_LAYOUT, COLORS } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { useSimulation } from '../context/SimulationContext';

type PulseKind = 'birth' | 'death';

interface PulseRecord {
  id: string;
  kind: PulseKind;
  age: number;
  ttl: number;
  startScale: number;
  endScale: number;
  position: THREE.Vector3;
}

interface PulseRenderItem {
  id: string;
  kind: PulseKind;
}

interface EvolutionPulseProps {
  engine: ISimulationEngine;
}

const MAX_PULSES = 60;
const MAX_EVENTS_PER_TICK = 6;
const SAMPLE_ATTEMPTS = 10;
const WORLD_SIZE_FALLBACK = 100;
const BIRTH_PULSE_OPACITY = 0.6;
const DEATH_PULSE_OPACITY = 0.45;
const PULSE_RENDER_ORDER = 20;
const PULSE_SEGMENTS = 20;
const UNIT_SCALE = 1;
const INTRO_PULSE_COUNT = 10;

const isDeadAt = (data: Float32Array, offset: number): boolean => (
  (data[offset + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD
);

const readPositionAt = (data: Float32Array, offset: number): THREE.Vector3 => new THREE.Vector3(
  data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0,
  data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0,
  data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0
);

const sampleByRandom = (
  data: Float32Array,
  count: number,
  acceptDead: boolean
): THREE.Vector3 | null => {
  for (let i = 0; i < SAMPLE_ATTEMPTS; i++) {
    const index = Math.floor(Math.random() * count); // eslint-disable-line sonarjs/pseudo-random
    const offset = index * BUFFER_LAYOUT.STRIDE;
    if (isDeadAt(data, offset) === acceptDead) {
      return readPositionAt(data, offset);
    }
  }

  return null;
};

const sampleByScan = (
  data: Float32Array,
  count: number,
  acceptDead: boolean
): THREE.Vector3 | null => {
  for (let index = 0; index < count; index++) {
    const offset = index * BUFFER_LAYOUT.STRIDE;
    if (isDeadAt(data, offset) === acceptDead) {
      return readPositionAt(data, offset);
    }
  }

  return null;
};

const samplePosition = (
  data: Float32Array,
  count: number,
  acceptDead: boolean
): THREE.Vector3 | null => {
  if (count <= 0) {
    return null;
  }

  return sampleByRandom(data, count, acceptDead) ?? sampleByScan(data, count, acceptDead);
};

const createFallbackPosition = (worldSize: number): THREE.Vector3 => new THREE.Vector3(
  Math.random() * worldSize, // eslint-disable-line sonarjs/pseudo-random
  Math.random() * worldSize, // eslint-disable-line sonarjs/pseudo-random
  Math.random() * worldSize // eslint-disable-line sonarjs/pseudo-random
);

const getPulsePosition = (engine: ISimulationEngine, kind: PulseKind, worldSize: number): THREE.Vector3 => {
  const buffers = engine.getRenderData();
  const acceptDead = kind === 'death';

  return (
    samplePosition(buffers.prey, buffers.preyCount, acceptDead)
    ?? samplePosition(buffers.predators, buffers.predatorCount, acceptDead)
    ?? createFallbackPosition(worldSize)
  );
};

const createPulse = (
  id: string,
  kind: PulseKind,
  position: THREE.Vector3
): PulseRecord => {
  if (kind === 'birth') {
    return {
      id,
      kind,
      age: 0,
      ttl: 1.25,
      startScale: 2.4,
      endScale: 20,
      position,
    };
  }

  return {
    id,
    kind,
    age: 0,
    ttl: 0.95,
    startScale: 1.6,
    endScale: 14,
    position,
  };
};

interface PulseBatchParams {
  engine: ISimulationEngine;
  worldSize: number;
  kind: PulseKind;
  count: number;
  nextId: () => string;
}

const createPulsesForKind = ({
  engine,
  worldSize,
  kind,
  count,
  nextId,
}: PulseBatchParams): PulseRecord[] => Array.from({ length: count }, () => {
  const id = nextId();
  return createPulse(id, kind, getPulsePosition(engine, kind, worldSize));
});

const trimToMax = <T,>(items: T[], max: number): T[] => {
  if (items.length <= max) {
    return items;
  }

  return items.slice(items.length - max);
};

const getPulseOpacity = (kind: PulseKind): number => (
  kind === 'birth' ? BIRTH_PULSE_OPACITY : DEATH_PULSE_OPACITY
);

const applyMaterialStyle = (mesh: THREE.Mesh, kind: PulseKind): void => {
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.blending = kind === 'birth' ? THREE.AdditiveBlending : THREE.NormalBlending;
  material.depthWrite = false;
  material.transparent = true;
};

const advancePulseMesh = (
  mesh: THREE.Mesh,
  pulse: PulseRecord,
  delta: number
): boolean => {
  pulse.age += delta;
  const t = Math.min(1, pulse.age / pulse.ttl);

  const scale = THREE.MathUtils.lerp(pulse.startScale, pulse.endScale, t);
  mesh.position.copy(pulse.position);
  mesh.scale.setScalar(scale);

  const material = mesh.material as THREE.MeshBasicMaterial;
  material.opacity = getPulseOpacity(pulse.kind) * (1 - t);

  return t >= UNIT_SCALE;
};

// eslint-disable-next-line max-lines-per-function
export const EvolutionPulse: React.FC<EvolutionPulseProps> = ({ engine }) => {
  const { stats } = useSimulation();

  const [renderPulses, setRenderPulses] = useState<PulseRenderItem[]>([]);
  const pulseMapRef = useRef<Map<string, PulseRecord>>(new Map());
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const counterRef = useRef(0);
  const totalsRef = useRef({ births: 0, deaths: 0, initialized: false, introPlayed: false });

  const geometry = useMemo(() => new THREE.SphereGeometry(UNIT_SCALE, PULSE_SEGMENTS, PULSE_SEGMENTS), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    if (!totalsRef.current.initialized) {
      totalsRef.current = {
        births: stats.totalBirths,
        deaths: stats.totalDeaths,
        initialized: true,
        introPlayed: false
      };
      return;
    }

    const worldSize = engine.worldConfig?.WORLD_SIZE ?? WORLD_SIZE_FALLBACK;
    const birthDelta = Math.max(0, stats.totalBirths - totalsRef.current.births);
    const deathDelta = Math.max(0, stats.totalDeaths - totalsRef.current.deaths);

    const plannedKinds: PulseKind[] = [
      ...Array.from({ length: Math.min(MAX_EVENTS_PER_TICK, birthDelta) }, () => 'birth' as const),
      ...Array.from({ length: Math.min(MAX_EVENTS_PER_TICK, deathDelta) }, () => 'death' as const),
    ];

    const nextId = () => `pulse_${counterRef.current++}`;
    const records: PulseRecord[] = [];

    if (!totalsRef.current.introPlayed && (stats.preyCount + stats.predatorCount > 0)) {
      records.push(...createPulsesForKind({ engine, worldSize, kind: 'birth', count: INTRO_PULSE_COUNT, nextId }));
      totalsRef.current.introPlayed = true;
    }

    if (plannedKinds.length > 0) {
      for (const kind of plannedKinds) {
        records.push(...createPulsesForKind({ engine, worldSize, kind, count: 1, nextId }));
      }
    }

    if (records.length > 0) {
      records.forEach(record => {
        pulseMapRef.current.set(record.id, record);
      });

      setRenderPulses(prev => {
        const next = [...prev, ...records.map(r => ({ id: r.id, kind: r.kind }))];
        const trimmed = trimToMax(next, MAX_PULSES);

        const keep = new Set(trimmed.map(p => p.id));
        for (const id of Array.from(pulseMapRef.current.keys())) {
          if (!keep.has(id)) {
            pulseMapRef.current.delete(id);
            meshMapRef.current.delete(id);
          }
        }

        return trimmed;
      });
    }

    totalsRef.current.births = stats.totalBirths;
    totalsRef.current.deaths = stats.totalDeaths;
  }, [engine, stats.preyCount, stats.predatorCount, stats.totalBirths, stats.totalDeaths]);

  useFrame((_, delta) => {
    if (renderPulses.length === 0) {
      return;
    }

    const expiredIds: string[] = [];

    for (const pulse of pulseMapRef.current.values()) {
      const mesh = meshMapRef.current.get(pulse.id);
      if (!mesh) {
        continue;
      }

      if (advancePulseMesh(mesh, pulse, delta)) {
        expiredIds.push(pulse.id);
      }
    }

    if (expiredIds.length === 0) {
      return;
    }

    const expiredSet = new Set(expiredIds);
    expiredIds.forEach(id => {
      pulseMapRef.current.delete(id);
      meshMapRef.current.delete(id);
    });

    setRenderPulses(prev => prev.filter(item => !expiredSet.has(item.id)));
  });

  return (
    <group>
      {renderPulses.map(item => (
        <mesh
          key={item.id}
          ref={mesh => {
            if (mesh) {
              mesh.renderOrder = PULSE_RENDER_ORDER;
              applyMaterialStyle(mesh, item.kind);
              meshMapRef.current.set(item.id, mesh);
            } else {
              meshMapRef.current.delete(item.id);
            }
          }}
          geometry={geometry}
        >
          <meshBasicMaterial
            color={item.kind === 'birth' ? COLORS.prey.glow : COLORS.predator.death}
            transparent
            opacity={getPulseOpacity(item.kind)}
          />
        </mesh>
      ))}
    </group>
  );
};
