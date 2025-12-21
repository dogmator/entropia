/**
 * Hook для ефектів частинок
 *
 * Створює та управляє:
 * - CosmicBackground (космічний фон)
 * - ParticleSystem (система частинок для ефектів)
 * - TrailSystem (сліди організмів)
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CosmicBackground } from '../effects/CosmicBackground';
import { ParticleSystem, TrailSystem } from '../effects/ParticleSystem';

export interface ParticleEffects {
  cosmicBackground: CosmicBackground;
  particleSystem: ParticleSystem;
  trailSystem: TrailSystem;
}

export function useParticleEffects(scene: THREE.Scene | null) {
  const effectsRef = useRef<ParticleEffects | null>(null);

  useEffect(() => {
    if (!scene) return;

    // Створити системи ефектів
    const cosmicBackground = new CosmicBackground(scene);
    const particleSystem = new ParticleSystem(scene);
    const trailSystem = new TrailSystem(scene);

    effectsRef.current = {
      cosmicBackground,
      particleSystem,
      trailSystem,
    };

    // Cleanup
    return () => {
      cosmicBackground.dispose();
      particleSystem.dispose();
      trailSystem.dispose();
    };
  }, [scene]);

  return effectsRef.current;
}
