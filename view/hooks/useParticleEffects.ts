/**
 * Hook для ефектів частинок
 *
 * Створює та управляє:
 * - CosmicBackground (космічний фон)
 * - ParticleSystem (система частинок для ефектів)
 * - TrailSystem (сліди організмів)
 */

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { CosmicBackground } from '../effects/CosmicBackground';
import { ParticleSystem, TrailSystem } from '../effects/ParticleSystem';

export interface ParticleEffects {
  cosmicBackground: CosmicBackground;
  particleSystem: ParticleSystem;
  trailSystem: TrailSystem;
}

export function useParticleEffects(scene: THREE.Scene | null) {
  const [effectsData, setEffectsData] = useState<ParticleEffects | null>(null);

  useEffect(() => {
    if (!scene) return;

    // Створити системи ефектів
    const cosmicBackground = new CosmicBackground(scene);
    const particleSystem = new ParticleSystem(scene);
    const trailSystem = new TrailSystem(scene);

    setEffectsData({
      cosmicBackground,
      particleSystem,
      trailSystem,
    });

    // Cleanup
    return () => {
      cosmicBackground.dispose();
      particleSystem.dispose();
      trailSystem.dispose();
    };
  }, [scene]);

  return effectsData;
}
