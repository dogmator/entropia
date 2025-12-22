/**
 * Hook для головного анімаційного циклу
 *
 * Управляє:
 * - requestAnimationFrame циклом
 * - Оновленням симуляції
 * - Оновленням ефектів
 * - Оновленням instanced meshes
 * - Рендерингом сцени
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { EntityType } from '../../types';
import { COLORS, RENDER } from '../../constants';
import { ThreeScene } from './useThreeScene';
import { SceneObjects } from './useSceneObjects';
import { ParticleEffects } from './useParticleEffects';

interface AnimationLoopOptions {
  speed: number;
  sceneData: ThreeScene | null;
  sceneObjects: SceneObjects | null;
  particleEffects: ParticleEffects | null;
  engine: SimulationEngine;
  updateHoveredEntity: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    foodMesh: THREE.InstancedMesh,
    obstacleMeshes: THREE.Mesh[],
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
      food: Map<number, string>;
    },
    engine: SimulationEngine
  ) => void;
}

export function useAnimationLoop(options: AnimationLoopOptions) {
  const {
    speed,
    sceneData,
    sceneObjects,
    particleEffects,
    engine,
    updateHoveredEntity,
  } = options;

  const requestRef = useRef<number>(0);
  const speedAccumulator = useRef(0);
  const lastTime = useRef(0);
  const time = useRef(0);
  const frameCount = useRef(0);

  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!sceneData || !sceneObjects || !particleEffects) return;

    const { scene, camera, renderer, controls } = sceneData;
    const {
      preyMesh,
      predMesh,
      foodMesh,
      obstacleMeshes,
      dummy,
      forward,
      idMaps,
      preyMat,
      predMat,
      foodMat,
      boxMat,
    } = sceneObjects;
    const { cosmicBackground, particleSystem, trailSystem } = particleEffects;

    const MAX_INSTANCES = RENDER.maxInstances;

    const animate = (currentTime: number) => {
      frameCount.current++;

      const deltaTime = Math.min(
        (currentTime - lastTime.current) / 1000,
        0.1
      );
      lastTime.current = currentTime;

      // Smart Rendering: при speed = 0 рендеримо на 1 FPS (тільки для camera controls)
      const currentSpeed = speedRef.current;
      const isStopped = currentSpeed === 0;

      if (isStopped && frameCount.current % 60 !== 0) {
        // При паузі пропускаємо більшість кадрів
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Оновлення часу тільки якщо не зупинено
      if (!isStopped) {
        time.current += deltaTime;
      }

      // Оновлення симуляції
      if (!isStopped) {
        speedAccumulator.current += currentSpeed;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;
        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      // Оновлення ефектів (тільки якщо не зупинено і showParticles = true)
      if (!isStopped && engine.config.showParticles) {
        cosmicBackground.update(deltaTime);
        particleSystem.update(deltaTime);
      }

      // Оновлення матеріалів (анімація їжі зупиняється при speed = 0)
      foodMat.emissiveIntensity = isStopped
        ? 0.4
        : 0.4 + Math.sin(time.current * 3) * 0.25;
      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;

      // Оновити видимість перешкод
      obstacleMeshes.forEach(m => {
        m.visible = engine.config.showObstacles;
      });

      // Очистити idMaps
      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      let preyIdx = 0;
      let predIdx = 0;

      // Оновити організми
      engine.organisms.forEach((o) => {
        if (o.isDead) return;

        dummy.position.set(o.position.x, o.position.y, o.position.z);
        const scale = o.radius * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        // Орієнтація по напрямку руху
        const spd = Math.sqrt(
          o.velocity.x ** 2 + o.velocity.y ** 2 + o.velocity.z ** 2
        );
        if (spd > 0.01) {
          const dir = new THREE.Vector3(
            o.velocity.x / spd,
            o.velocity.y / spd,
            o.velocity.z / spd
          );
          dummy.quaternion.setFromUnitVectors(forward, dir);
        }

        dummy.updateMatrix();

        // Додати до відповідного instanced mesh
        if (o.type === EntityType.PREY && preyIdx < MAX_INSTANCES) {
          idMaps.prey.set(preyIdx, o.id);
          preyMesh.setMatrixAt(preyIdx++, dummy.matrix);
        } else if (
          o.type === EntityType.PREDATOR &&
          predIdx < MAX_INSTANCES
        ) {
          idMaps.pred.set(predIdx, o.id);
          predMesh.setMatrixAt(predIdx++, dummy.matrix);
        }

        // Оновити сліди (індивідуальний контроль через trailEnabled)
        if (o.trailEnabled) {
          const color = o.isPrey ? COLORS.prey.base : COLORS.predator.base;
          trailSystem.updateTrail(o.id, o.position, color, true);
        } else {
          trailSystem.removeTrail(o.id);
        }
      });

      preyMesh.count = preyIdx;
      preyMesh.instanceMatrix.needsUpdate = true;
      predMesh.count = predIdx;
      predMesh.instanceMatrix.needsUpdate = true;

      let foodIdx = 0;

      // Оновити їжу
      engine.food.forEach((f) => {
        if (f.consumed || foodIdx >= MAX_INSTANCES) return;

        const scale = f.radius * 2.5 * engine.config.foodScale;

        // Кристал
        dummy.position.set(f.position.x, f.position.y, f.position.z);
        dummy.scale.set(scale, scale, scale);

        // Обертання зупиняється при speed = 0
        const rotationTime = isStopped ? 0 : time.current;
        dummy.rotation.set(rotationTime * 0.5, rotationTime * 0.3, 0);
        dummy.updateMatrix();
        idMaps.food.set(foodIdx, f.id);
        foodMesh.setMatrixAt(foodIdx++, dummy.matrix);
      });

      foodMesh.count = foodIdx;
      foodMesh.instanceMatrix.needsUpdate = true;

      // Оновити hovered entity
      updateHoveredEntity(
        camera,
        preyMesh,
        predMesh,
        foodMesh,
        obstacleMeshes,
        idMaps,
        engine
      );

      // Рендер
      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [sceneData, sceneObjects, particleEffects, engine, updateHoveredEntity]);
}
