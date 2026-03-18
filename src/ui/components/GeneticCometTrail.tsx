import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { BUFFER_LAYOUT } from '@/config';
import type { ISimulationEngine } from '@/simulation/interfaces/ISimulationEngine';

import { useSimulation } from '../context/SimulationContext';
import { TrailSystem } from '../effects/ParticleSystem';

interface GeneticCometTrailProps {
  engine: ISimulationEngine;
}

type Species = 'prey' | 'predator';

interface ActiveComet {
  id: string;
  species: Species;
  expiresAt: number;
}

interface AliveEntitySnapshot {
  id: string;
  species: Species;
  x: number;
  y: number;
  z: number;
}

interface CometRenderItem {
  id: string;
  species: Species;
}

const COMET_TTL_SECONDS = 2.8;
const COMET_MAX_ACTIVE = 28;
const COMET_MAX_NEW_PER_FRAME = 4;
const COMET_INTRO_COUNT = 12;
const COMET_TRAIL_LENGTH = 56;
const COMET_CORE_TRAIL_LENGTH = 18;
const HISTORY_GC_FRAMES = 300;
const HISTORY_GC_INTERVAL_FRAMES = 30;
const COMET_HEAD_BASE_SCALE = 1.2;
const COMET_AURA_BASE_SCALE = 2.8;
const COMET_HEAD_PULSE_SPEED = 8;
const COMET_HEAD_PULSE_GAIN = 0.25;
const COMET_HEAD_SEGMENTS = 14;
const COMET_AURA_SEGMENTS = 12;
const COMET_HEAD_SCALE_BASE_OFFSET = 0.7;
const COMET_HEAD_SCALE_TTL_GAIN = 0.6;
const COMET_AURA_SCALE_BASE_OFFSET = 0.6;
const COMET_AURA_SCALE_TTL_GAIN = 0.8;
const COMET_HEAD_OPACITY_BASE = 0.85;
const COMET_AURA_OPACITY_BASE = 0.35;

const PREY_TRAIL_COLOR = 0x66ffff;
const PREDATOR_TRAIL_COLOR = 0xffaa33;
const COMET_CORE_TRAIL_COLOR = 0xffffff;
const PREY_HEAD_COLOR = 0x88ffff;
const PREDATOR_HEAD_COLOR = 0xffdd88;
const PREY_AURA_COLOR = 0x33ccff;
const PREDATOR_AURA_COLOR = 0xff8833;

const getTrailColor = (species: Species): number => (
  species === 'prey' ? PREY_TRAIL_COLOR : PREDATOR_TRAIL_COLOR
);

const getHeadColor = (species: Species): number => (
  species === 'prey' ? PREY_HEAD_COLOR : PREDATOR_HEAD_COLOR
);

const getAuraColor = (species: Species): number => (
  species === 'prey' ? PREY_AURA_COLOR : PREDATOR_AURA_COLOR
);

const scanAliveSnapshots = (
  data: Float32Array,
  count: number,
  species: Species,
  currentFrame: number,
  knownAlive: Map<string, number>,
  aliveMap: Map<string, AliveEntitySnapshot>,
  aliveList: AliveEntitySnapshot[],
  newbornCandidates: AliveEntitySnapshot[],
  idCache: Map<number, string>,
  snapshotCache: Map<string, AliveEntitySnapshot>,
): void => {
  for (let i = 0; i < count; i++) {
    const offset = i * BUFFER_LAYOUT.STRIDE;
    const isDead = (data[offset + BUFFER_LAYOUT.OFFSETS.IS_DEAD] ?? 0) > BUFFER_LAYOUT.DEAD_THRESHOLD;
    if (isDead) {
      continue;
    }

    const numId = data[offset + BUFFER_LAYOUT.OFFSETS.ID] ?? 0;
    let id = idCache.get(numId);
    if (!id) {
      id = `${species}_${Math.round(numId)}`;
      idCache.set(numId, id);
    }

    let snapshot = snapshotCache.get(id);
    if (!snapshot) {
      snapshot = { id, species, x: 0, y: 0, z: 0 };
      snapshotCache.set(id, snapshot);
    }

    snapshot.x = data[offset + BUFFER_LAYOUT.OFFSETS.X] ?? 0;
    snapshot.y = data[offset + BUFFER_LAYOUT.OFFSETS.Y] ?? 0;
    snapshot.z = data[offset + BUFFER_LAYOUT.OFFSETS.Z] ?? 0;

    aliveMap.set(id, snapshot);
    aliveList.push(snapshot);

    const previousSeen = knownAlive.get(id);
    if (previousSeen === undefined) {
      newbornCandidates.push(snapshot);
    }
    knownAlive.set(id, currentFrame);
  }
};

const pushIntroSeeds = (
  alive: AliveEntitySnapshot[],
  maxCount: number,
  target: AliveEntitySnapshot[],
): void => {
  if (alive.length <= maxCount) {
    for (const item of alive) {
      target.push(item);
    }
    return;
  }

  const step = Math.max(1, Math.floor(alive.length / maxCount));
  for (let i = 0; i < alive.length && target.length < maxCount; i += step) {
    const candidate = alive[i];
    if (candidate) {
      target.push(candidate);
    }
  }
};

const syncRenderItems = (
  activeComets: Map<string, ActiveComet>,
  setRenderComets: React.Dispatch<React.SetStateAction<CometRenderItem[]>>
): void => {
  const next = Array.from(activeComets.values()).map(c => ({ id: c.id, species: c.species }));
  setRenderComets(prev => {
    if (prev.length === next.length && prev.every((item, index) => item.id === next[index]?.id && item.species === next[index]?.species)) {
      return prev;
    }
    return next;
  });
};

const setupCometMaterial = (mesh: THREE.Mesh): void => {
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.transparent = true;
};

// eslint-disable-next-line max-lines-per-function
export const GeneticCometTrail: React.FC<GeneticCometTrailProps> = ({ engine }) => {
  const { scene } = useThree();
  const { stats } = useSimulation();

  const trailSystem = useMemo(() => new TrailSystem(scene, COMET_TRAIL_LENGTH), [scene]);
  const coreTrailSystem = useMemo(() => new TrailSystem(scene, COMET_CORE_TRAIL_LENGTH), [scene]);

  const headGeometry = useMemo(() => new THREE.SphereGeometry(1, COMET_HEAD_SEGMENTS, COMET_HEAD_SEGMENTS), []);
  const auraGeometry = useMemo(() => new THREE.SphereGeometry(1, COMET_AURA_SEGMENTS, COMET_AURA_SEGMENTS), []);

  const [renderComets, setRenderComets] = useState<CometRenderItem[]>([]);

  const activeCometsRef = useRef<Map<string, ActiveComet>>(new Map());
  const knownAliveRef = useRef<Map<string, number>>(new Map());
  const aliveMapRef = useRef<Map<string, AliveEntitySnapshot>>(new Map());
  const aliveListRef = useRef<AliveEntitySnapshot[]>([]);
  const newbornCandidatesRef = useRef<AliveEntitySnapshot[]>([]);
  const spawnQueueRef = useRef<AliveEntitySnapshot[]>([]);
  const snapshotCacheRef = useRef<Map<string, AliveEntitySnapshot>>(new Map());
  const preyIdCacheRef = useRef<Map<number, string>>(new Map());
  const predatorIdCacheRef = useRef<Map<number, string>>(new Map());
  const headRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const auraRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const frameRef = useRef(0);
  const lastGenerationRef = useRef(0);
  const totalsRef = useRef({ births: 0, initialized: false, introPlayed: false });

  useEffect(() => {
    return () => {
      trailSystem.dispose();
      coreTrailSystem.dispose();
      headGeometry.dispose();
      auraGeometry.dispose();
    };
  }, [trailSystem, coreTrailSystem, headGeometry, auraGeometry]);

  // eslint-disable-next-line max-lines-per-function, complexity, sonarjs/cognitive-complexity
  useFrame(({ clock }) => {
    frameRef.current += 1;
    const now = clock.getElapsedTime();

    trailSystem.beginFrame();
    coreTrailSystem.beginFrame();

    if (stats.generation < lastGenerationRef.current) {
      trailSystem.clear();
      coreTrailSystem.clear();
      activeCometsRef.current.clear();
      knownAliveRef.current.clear();
      aliveMapRef.current.clear();
      aliveListRef.current.length = 0;
      newbornCandidatesRef.current.length = 0;
      spawnQueueRef.current.length = 0;
      totalsRef.current.introPlayed = false;
      syncRenderItems(activeCometsRef.current, setRenderComets);
    }
    lastGenerationRef.current = stats.generation;

    const buffers = engine.getRenderData();
    const aliveMap = aliveMapRef.current;
    const alive = aliveListRef.current;
    const newbornCandidates = newbornCandidatesRef.current;
    const spawnQueue = spawnQueueRef.current;
    aliveMap.clear();
    alive.length = 0;
    newbornCandidates.length = 0;
    spawnQueue.length = 0;

    scanAliveSnapshots(
      buffers.prey,
      buffers.preyCount,
      'prey',
      frameRef.current,
      knownAliveRef.current,
      aliveMap,
      alive,
      newbornCandidates,
      preyIdCacheRef.current,
      snapshotCacheRef.current
    );
    scanAliveSnapshots(
      buffers.predators,
      buffers.predatorCount,
      'predator',
      frameRef.current,
      knownAliveRef.current,
      aliveMap,
      alive,
      newbornCandidates,
      predatorIdCacheRef.current,
      snapshotCacheRef.current
    );

    if (frameRef.current % HISTORY_GC_INTERVAL_FRAMES === 0) {
      for (const [id, lastSeen] of knownAliveRef.current.entries()) {
        if (frameRef.current - lastSeen > HISTORY_GC_FRAMES) {
          knownAliveRef.current.delete(id);
          snapshotCacheRef.current.delete(id);
        }
      }
    }

    const birthsDelta = totalsRef.current.initialized
      ? Math.max(0, stats.totalBirths - totalsRef.current.births)
      : 0;

    if (!totalsRef.current.initialized) {
      totalsRef.current.initialized = true;
      totalsRef.current.births = stats.totalBirths;
    }

    if (!totalsRef.current.introPlayed && alive.length > 0) {
      pushIntroSeeds(alive, COMET_INTRO_COUNT, spawnQueue);
      totalsRef.current.introPlayed = true;
    }

    const allowedByDelta = Math.max(COMET_MAX_NEW_PER_FRAME, birthsDelta);
    for (const candidate of newbornCandidates) {
      if (spawnQueue.length >= allowedByDelta) {
        break;
      }
      spawnQueue.push(candidate);
    }

    let activeCometsChanged = false;
    for (const entity of spawnQueue) {
      if (activeCometsRef.current.size >= COMET_MAX_ACTIVE) {
        break;
      }
      const hadComet = activeCometsRef.current.has(entity.id);
      activeCometsRef.current.set(entity.id, {
        id: entity.id,
        species: entity.species,
        expiresAt: now + COMET_TTL_SECONDS
      });
      if (!hadComet) {
        activeCometsChanged = true;
      }
    }

    totalsRef.current.births = stats.totalBirths;

    for (const [id, comet] of activeCometsRef.current.entries()) {
      if (comet.expiresAt <= now || !aliveMap.has(id)) {
        activeCometsRef.current.delete(id);
        trailSystem.removeTrail(id);
        coreTrailSystem.removeTrail(`${id}_core`);
        headRefs.current.delete(id);
        auraRefs.current.delete(id);
        activeCometsChanged = true;
      }
    }

    if (activeCometsChanged) {
      syncRenderItems(activeCometsRef.current, setRenderComets);
    }

    for (const comet of activeCometsRef.current.values()) {
      const entity = aliveMap.get(comet.id);
      if (!entity) {
        continue;
      }

      trailSystem.updateTrail(comet.id, {
        position: { x: entity.x, y: entity.y, z: entity.z },
        color: getTrailColor(comet.species),
        enabled: true
      });
      coreTrailSystem.updateTrail(`${comet.id}_core`, {
        position: { x: entity.x, y: entity.y, z: entity.z },
        color: COMET_CORE_TRAIL_COLOR,
        enabled: true
      });

      const ttlRatio = Math.max(0, Math.min(1, (comet.expiresAt - now) / COMET_TTL_SECONDS));
      const pulse = 1 + Math.sin(now * COMET_HEAD_PULSE_SPEED) * COMET_HEAD_PULSE_GAIN;

      const headMesh = headRefs.current.get(comet.id);
      if (headMesh) {
        headMesh.position.set(entity.x, entity.y, entity.z);
        headMesh.scale.setScalar(
          COMET_HEAD_BASE_SCALE * pulse * (COMET_HEAD_SCALE_BASE_OFFSET + ttlRatio * COMET_HEAD_SCALE_TTL_GAIN)
        );
        const headMaterial = headMesh.material as THREE.MeshBasicMaterial;
        headMaterial.opacity = COMET_HEAD_OPACITY_BASE * ttlRatio;
      }

      const auraMesh = auraRefs.current.get(comet.id);
      if (auraMesh) {
        auraMesh.position.set(entity.x, entity.y, entity.z);
        auraMesh.scale.setScalar(
          COMET_AURA_BASE_SCALE * pulse * (COMET_AURA_SCALE_BASE_OFFSET + ttlRatio * COMET_AURA_SCALE_TTL_GAIN)
        );
        const auraMaterial = auraMesh.material as THREE.MeshBasicMaterial;
        auraMaterial.opacity = COMET_AURA_OPACITY_BASE * ttlRatio;
      }
    }

    trailSystem.prune();
    coreTrailSystem.prune();
  });

  return (
    <group>
      {renderComets.map(comet => (
        <group key={comet.id}>
          <mesh
            ref={mesh => {
              if (mesh) {
                mesh.renderOrder = 30;
                setupCometMaterial(mesh);
                headRefs.current.set(comet.id, mesh);
              } else {
                headRefs.current.delete(comet.id);
              }
            }}
            geometry={headGeometry}
          >
            <meshBasicMaterial
              color={getHeadColor(comet.species)}
              transparent
              opacity={COMET_HEAD_OPACITY_BASE}
              depthWrite={false}
            />
          </mesh>

          <mesh
            ref={mesh => {
              if (mesh) {
                mesh.renderOrder = 29;
                setupCometMaterial(mesh);
                auraRefs.current.set(comet.id, mesh);
              } else {
                auraRefs.current.delete(comet.id);
              }
            }}
            geometry={auraGeometry}
          >
            <meshBasicMaterial
              color={getAuraColor(comet.species)}
              transparent
              opacity={COMET_AURA_OPACITY_BASE}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};
