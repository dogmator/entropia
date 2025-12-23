/**
 * Спеціалізований програмний інтерфейс (хук) для управління головним анімаційним циклом системи.
 * 
 * Забезпечує координацію наступних процесів:
 * - Цикл планування кадрів (requestAnimationFrame)
 * - Хронологічне оновлення стану симуляційного двигуна
 * - Модуляція візуальних ефектів та систем часток
 * - Актуалізація об'єктів групової візуалізації (Instanced Meshes)
 * - Термінальний рендеринг графічної сцени
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

    /**
     * Головна ітераційна функція відтворення кадру.
     */
    const animate = (currentTime: number) => {
      frameCount.current++;

      // Обчислення дельти часу з обмеженням для уникнення стрибків при втраті фокусу
      const deltaTime = Math.min(
        (currentTime - lastTime.current) / 1000,
        0.1
      );
      lastTime.current = currentTime;

      const currentSpeed = speedRef.current;
      const isStopped = currentSpeed === 0;

      // Актуалізація внутрішнього таймера системи (за умови активної симуляції)
      if (!isStopped) {
        time.current += deltaTime;
      }

      // Оновлення обчислювального стану симуляційного двигуна
      if (!isStopped) {
        speedAccumulator.current += currentSpeed;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;
        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      // Модуляція систем часток та фонових ефектів
      if (!isStopped && engine.config.showParticles) {
        cosmicBackground.update(deltaTime);
        particleSystem.update(deltaTime);
      }

      // Динамічне коригування параметрів матеріалів
      foodMat.emissiveIntensity = isStopped
        ? 0.4
        : 0.4 + Math.sin(time.current * 3) * 0.25;
      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;

      // Оптимізація видимості пасивних перешкод
      obstacleMeshes.forEach(m => {
        m.visible = engine.config.showObstacles;
      });

      // Скидання мап відповідності ідентифікаторів
      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      let preyIdx = 0;
      let predIdx = 0;

      // Ітераційне оновлення геометричного стану активних організмів
      engine.organisms.forEach((o) => {
        if (o.isDead) return;

        dummy.position.set(o.position.x, o.position.y, o.position.z);
        const scale = o.radius * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        // Математичне визначення орієнтації суб'єкта на основі вектора швидкості
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

        // Агрегація даних у відповідні масиви інстансів
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

        // Керування станом систем трасування траєкторій (слідів)
        if (o.trailEnabled) {
          const color = o.isPrey ? COLORS.prey.base : COLORS.predator.base;
          trailSystem.updateTrail(o.id, o.position, color, true);
        } else {
          trailSystem.removeTrail(o.id);
        }
      });

      // Синхронізація матриць інстансів організмів із графічним конвеєром
      preyMesh.count = preyIdx;
      preyMesh.instanceMatrix.needsUpdate = true;
      preyMesh.updateMatrixWorld(); // Необхідно для коректного функціонування проекційного детектування
      preyMesh.computeBoundingSphere();

      predMesh.count = predIdx;
      predMesh.instanceMatrix.needsUpdate = true;
      predMesh.updateMatrixWorld();
      predMesh.computeBoundingSphere();

      let foodIdx = 0;

      // Оновлення просторового розміщення ресурсів (їжі)
      engine.food.forEach((f) => {
        if (f.consumed || foodIdx >= MAX_INSTANCES) return;

        const geometryRadius = 2; // Відповідає THREE.SphereGeometry(2, 8, 8) у useSceneObjects
        const scale = (f.radius / geometryRadius) * 2.5 * engine.config.foodScale;

        dummy.position.set(f.position.x, f.position.y, f.position.z);
        dummy.scale.set(scale, scale, scale);

        const rotationTime = isStopped ? 0 : time.current;
        dummy.rotation.set(rotationTime * 0.5, rotationTime * 0.3, 0);
        dummy.updateMatrix();
        idMaps.food.set(foodIdx, f.id);
        foodMesh.setMatrixAt(foodIdx++, dummy.matrix);
      });

      // Актуалізація стану об'єктів їжі
      foodMesh.count = foodIdx;
      foodMesh.instanceMatrix.needsUpdate = true;
      foodMesh.updateMatrixWorld(); // Критичний крок для забезпечення точності рейкастингу
      foodMesh.computeBoundingSphere(); // ОБОВ'ЯЗКОВО: оновлення граничної сфери після зміни матриць інстансів

      // Оновлення стану інтерактивного наведення
      updateHoveredEntity(
        camera,
        preyMesh,
        predMesh,
        foodMesh,
        obstacleMeshes,
        idMaps,
        engine
      );

      // Виклик термінальних методів рендерингу
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
